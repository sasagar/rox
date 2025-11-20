'use client';

import { useState, useRef } from 'react';
import { Trans } from '@lingui/react/macro';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { useAtom } from 'jotai';
import { currentUserAtom } from '../../lib/atoms/auth';
import { notesApi } from '../../lib/api/notes';
import type { NoteVisibility } from '../../lib/api/notes';

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
 * - Submit with loading state
 */
export function NoteComposer({ onNoteCreated, replyTo, replyId }: NoteComposerProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const [text, setText] = useState('');
  const [cw, setCw] = useState('');
  const [showCw, setShowCw] = useState(false);
  const [visibility, setVisibility] = useState<NoteVisibility>('public');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = async () => {
    if (!text.trim() && files.length === 0) {
      setError('Please enter text or attach files');
      return;
    }

    if (text.length > maxLength) {
      setError(`Text exceeds ${maxLength} characters`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Upload files first and get file IDs
      const fileIds: string[] = [];

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

      onNoteCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibilityOptions: { value: NoteVisibility; label: string; icon: string }[] = [
    { value: 'public', label: 'Public', icon: '🌐' },
    { value: 'home', label: 'Home', icon: '🏠' },
    { value: 'followers', label: 'Followers', icon: '🔒' },
    { value: 'direct', label: 'Direct', icon: '✉️' },
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
              <div className="text-sm text-gray-600">
                <Trans>Replying to</Trans> <span className="text-primary-600 font-medium">{replyTo}</span>
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
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {/* Main textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder={replyTo ? `Reply to ${replyTo}` : "What's happening?"}
              className="w-full min-h-[100px] resize-none rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isSubmitting}
            />

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
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* File upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || files.length >= 4}
                  className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  title="Add images"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
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
                  className={`p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 ${
                    showCw ? 'bg-primary-50 text-primary-600' : 'text-gray-600'
                  }`}
                  type="button"
                  title="Content Warning"
                >
                  CW
                </button>

                {/* Visibility selector */}
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as NoteVisibility)}
                  disabled={isSubmitting}
                  className="px-2 py-1 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {visibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                {/* Character counter */}
                <span
                  className={`text-sm ${
                    remainingChars < 0
                      ? 'text-red-600 font-bold'
                      : remainingChars < 100
                      ? 'text-orange-600'
                      : 'text-gray-500'
                  }`}
                >
                  {remainingChars}
                </span>

                {/* Submit button */}
                <Button
                  onPress={handleSubmit}
                  isDisabled={isSubmitting || (!text.trim() && files.length === 0) || text.length > maxLength}
                  variant="primary"
                  size="sm"
                >
                  {isSubmitting ? <Trans>Posting...</Trans> : replyId ? <Trans>Reply</Trans> : <Trans>Post</Trans>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
