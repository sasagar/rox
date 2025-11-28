'use client';

import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Image as ImageIcon, X, Globe, Home as HomeIcon, Lock, Mail, ChevronDown, Eye } from 'lucide-react';
import { MfmRenderer } from '../mfm/MfmRenderer';
import { Select, Button as RACButton, Popover, ListBox, ListBoxItem } from 'react-aria-components';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { ProgressBar } from '../ui/ProgressBar';
import { Spinner } from '../ui/Spinner';
import { InlineError } from '../ui/ErrorMessage';
import { EmojiPicker } from '../ui/EmojiPicker';
import { useAtom } from 'jotai';
import { currentUserAtom, tokenAtom } from '../../lib/atoms/auth';
import { addToastAtom } from '../../lib/atoms/toast';
import { notesApi } from '../../lib/api/notes';
import type { NoteVisibility } from '../../lib/api/notes';
import { uploadFile } from '../../lib/api/drive';
import { useDraft, useAutosaveDraft } from '../../hooks/useDraft';

export interface NoteComposerProps {
  /**
   * Callback when a note is successfully created
   */
  onNoteCreated?: () => void;
  /**
   * Initial text content for reply
   */
  replyTo?: string;
  /**
   * Reply target note ID
   */
  replyId?: string;
}

/**
 * Component for composing and posting new notes
 *
 * Features:
 * - Text input with auto-resize textarea
 * - File attachments (images)
 * - Content Warning (CW) toggle
 * - Visibility selector (public/home/followers/direct)
 * - Character counter
 * - Draft auto-save and recovery
 * - Submit with loading state
 */
export function NoteComposer({ onNoteCreated, replyTo, replyId }: NoteComposerProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);
  const [text, setText] = useState('');
  const [cw, setCw] = useState('');
  const [showCw, setShowCw] = useState(false);
  const [visibility, setVisibility] = useState<NoteVisibility>('public');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Draft management
  const { loadDraft, clearDraft, hasDraft } = useDraft();
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // Auto-save draft (only for non-reply posts)
  useAutosaveDraft(
    {
      text,
      cw,
      showCw,
      visibility,
    },
    1000 // Save every 1 second after user stops typing
  );

  // Load draft on mount (only if not replying)
  useEffect(() => {
    if (!replyId && hasDraft) {
      setShowDraftBanner(true);
    }
  }, [replyId, hasDraft]);

  const handleRestoreDraft = () => {
    const draft = loadDraft();
    if (draft) {
      setText(draft.text);
      setCw(draft.cw);
      setShowCw(draft.showCw);
      setVisibility(draft.visibility);
      setShowDraftBanner(false);

      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }

      addToast({
        type: 'success',
        message: t`Draft restored`,
      });
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
    addToast({
      type: 'info',
      message: t`Draft discarded`,
    });
  };

  const maxLength = 3000;
  const remainingChars = maxLength - text.length;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    // Limit to 4 files
    setFiles((prev) => [...prev, ...selectedFiles].slice(0, 4));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/'),
    );

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles].slice(0, 4));
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + emoji + text.substring(end);

    setText(newText);

    // Move cursor after the emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!text.trim() && files.length === 0) {
      setError(t`Please enter text or attach files`);
      return;
    }

    if (text.length > maxLength) {
      setError(t`Text exceeds ${maxLength} characters`);
      return;
    }

    if (!token) {
      setError(t`Authentication required`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload files first and get file IDs
      const fileIds: string[] = [];

      if (files.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;

          try {
            const uploadedFile = await uploadFile({ file }, token);
            fileIds.push(uploadedFile.id);

            // Update progress
            setUploadProgress(Math.round(((i + 1) / files.length) * 100));
          } catch (uploadError) {
            console.error('Failed to upload file:', uploadError);
            throw new Error(t`Failed to upload ${file.name}`);
          }
        }

        setIsUploading(false);
        setUploadProgress(0);
      }

      await notesApi.createNote({
        text: text.trim(),
        cw: showCw && cw.trim() ? cw.trim() : undefined,
        visibility,
        fileIds: fileIds.length > 0 ? fileIds : undefined,
        replyId,
      });

      // Reset form
      setText('');
      setCw('');
      setShowCw(false);
      setVisibility('public');
      setFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // Clear draft
      clearDraft();

      // Show success toast
      addToast({
        type: 'success',
        message: t`Note posted successfully`,
      });

      onNoteCreated?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create note';
      setError(errorMessage);

      // Show error toast
      addToast({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const visibilityOptions: { value: NoteVisibility; label: ReactNode; icon: ReactNode }[] = [
    { value: 'public', label: <Trans>Public</Trans>, icon: <Globe className="w-4 h-4" /> },
    { value: 'home', label: <Trans>Home</Trans>, icon: <HomeIcon className="w-4 h-4" /> },
    { value: 'followers', label: <Trans>Followers</Trans>, icon: <Lock className="w-4 h-4" /> },
    { value: 'direct', label: <Trans>Direct</Trans>, icon: <Mail className="w-4 h-4" /> },
  ];

  if (!currentUser) {
    return null;
  }

  const userInitials = currentUser.name
    ? currentUser.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : currentUser.username.slice(0, 2).toUpperCase();

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        {/* Draft banner */}
        {showDraftBanner && !replyId && (
          <div className="mb-4 rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  <Trans>You have an unsaved draft</Trans>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={handleRestoreDraft}
                  className="text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  <Trans>Restore</Trans>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={handleDiscardDraft}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <Trans>Discard</Trans>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Avatar
            src={currentUser.avatarUrl}
            alt={currentUser.name || currentUser.username}
            fallback={userInitials}
            size="md"
          />

          <div className="flex-1 space-y-3">
            {/* Reply indicator */}
            {replyTo && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <Trans>Replying to</Trans> <span className="text-primary-600 dark:text-primary-400 font-medium">{replyTo}</span>
              </div>
            )}

            {/* Content Warning */}
            {showCw && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={cw}
                  onChange={(e) => setCw(e.target.value)}
                  placeholder="Content Warning"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {/* Main textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              placeholder={replyTo ? `Reply to ${replyTo}` : "What's happening?"}
              className="w-full min-h-[100px] resize-none rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isSubmitting}
            />

            {/* MFM Preview */}
            {showPreview && text.trim() && (
              <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                  <Trans>Preview</Trans>
                </div>
                <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap wrap-break-word">
                  <MfmRenderer text={text} />
                </div>
              </div>
            )}

            {/* File previews */}
            {files.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {files.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-32 object-cover rounded-md"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      type="button"
                      aria-label={`Remove image ${index + 1}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload progress bar */}
            {isUploading && uploadProgress > 0 && (
              <div className="space-y-1">
                <ProgressBar value={uploadProgress} showPercent size="md" />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <Trans>Uploading files...</Trans> {uploadProgress}%
                </p>
              </div>
            )}

            {/* Error message */}
            {error && <InlineError message={error} />}

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* File upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || files.length >= 4}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  title="Add images"
                  aria-label="Add images"
                >
                  <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* CW toggle button */}
                <button
                  onClick={() => setShowCw(!showCw)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${
                    showCw ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
                  }`}
                  type="button"
                  title="Content Warning"
                  aria-label="Toggle content warning"
                  aria-pressed={showCw}
                >
                  CW
                </button>

                {/* Emoji picker */}
                <EmojiPicker
                  onEmojiSelect={handleEmojiSelect}
                  isDisabled={isSubmitting}
                />

                {/* MFM Preview toggle */}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${
                    showPreview ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
                  }`}
                  type="button"
                  title="Preview MFM"
                  aria-label="Toggle MFM preview"
                  aria-pressed={showPreview}
                >
                  <Eye className="w-5 h-5" />
                </button>

                {/* Visibility selector */}
                <Select
                  selectedKey={visibility}
                  onSelectionChange={(key) => setVisibility(key as NoteVisibility)}
                  isDisabled={isSubmitting}
                >
                  <RACButton className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-sm hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800">
                    {visibilityOptions.find((opt) => opt.value === visibility)?.icon}
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {visibilityOptions.find((opt) => opt.value === visibility)?.label}
                    </span>
                    <ChevronDown className="w-3 h-3 text-gray-500 dark:text-gray-400 ml-1" />
                  </RACButton>
                  <Popover className="mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                    <ListBox className="outline-none py-1">
                      {visibilityOptions.map((option) => (
                        <ListBoxItem
                          key={option.value}
                          id={option.value}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none data-selected:bg-primary-50 dark:data-selected:bg-primary-900/30 data-selected:text-primary-900 dark:data-selected:text-primary-100"
                        >
                          {option.icon}
                          <span>{option.label}</span>
                        </ListBoxItem>
                      ))}
                    </ListBox>
                  </Popover>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                {/* Character counter with circular progress */}
                <div className="relative flex items-center justify-center w-8 h-8">
                  {/* Circular progress background */}
                  <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      className="stroke-gray-200 dark:stroke-gray-600"
                      stroke={remainingChars < 0 ? '#ef4444' : undefined}
                      strokeWidth="2"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke={remainingChars < 0 ? '#ef4444' : remainingChars < 100 ? '#f97316' : '#3b82f6'}
                      strokeWidth="2"
                      strokeDasharray={`${(text.length / maxLength) * 87.96} 87.96`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Character count text */}
                  <span
                    className={`absolute text-xs font-medium ${
                      remainingChars < 0
                        ? 'text-red-600'
                        : remainingChars < 100
                        ? 'text-orange-600'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {text.length > maxLength - 100 ? remainingChars : ''}
                  </span>
                </div>

                {/* Submit button */}
                <Button
                  onPress={handleSubmit}
                  isDisabled={isSubmitting || isUploading || (!text.trim() && files.length === 0) || text.length > maxLength}
                  variant="primary"
                  size="sm"
                >
                  <div className="flex items-center gap-2">
                    {(isUploading || isSubmitting) && <Spinner size="xs" variant="white" />}
                    {isUploading ? (
                      <Trans>Uploading...</Trans>
                    ) : isSubmitting ? (
                      <Trans>Posting...</Trans>
                    ) : replyId ? (
                      <Trans>Reply</Trans>
                    ) : (
                      <Trans>Post</Trans>
                    )}
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
