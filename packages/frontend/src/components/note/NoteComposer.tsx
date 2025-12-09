"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  Image as ImageIcon,
  X,
  Globe,
  Home as HomeIcon,
  Lock,
  Mail,
  ChevronDown,
  Eye,
  Save,
  FileText,
  Trash2,
  HardDrive,
  Clock,
  AtSign,
} from "lucide-react";
import { NOTE_TEXT_MAX_LENGTH } from "shared";
import { MfmRenderer } from "../mfm/MfmRenderer";
import { Select, Button as RACButton, Popover, ListBox, ListBoxItem } from "react-aria-components";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { ProgressBar } from "../ui/ProgressBar";
import { Spinner } from "../ui/Spinner";
import { InlineError } from "../ui/ErrorMessage";
import { EmojiPicker } from "../ui/EmojiPicker";
import { useAtom, useAtomValue } from "jotai";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { addToastAtom } from "../../lib/atoms/toast";
import { notificationSoundAtom, notificationVolumeAtom } from "../../lib/atoms/uiSettings";
import { notesApi } from "../../lib/api/notes";
import { playPostSound } from "../../lib/utils/notificationSound";
import type { NoteVisibility } from "../../lib/api/notes";
import { uploadFile, type DriveFile } from "../../lib/api/drive";
import { useDraft } from "../../hooks/useDraft";
import { useMentionSuggestions } from "../../hooks/useMentionSuggestions";
import { useEmojiSuggestions } from "../../hooks/useEmojiSuggestions";
import { scheduledNotesApi } from "../../lib/api/scheduled-notes";
import { DrivePickerDialog } from "../drive/DrivePickerDialog";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";

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
  const notificationSound = useAtomValue(notificationSoundAtom);
  const notificationVolume = useAtomValue(notificationVolumeAtom);
  const [text, setText] = useState("");
  const [cw, setCw] = useState("");
  const [showCw, setShowCw] = useState(false);
  const [visibility, setVisibility] = useState<NoteVisibility>("public");
  const [files, setFiles] = useState<File[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Total file count (new uploads + drive files)
  const totalFileCount = files.length + driveFiles.length;

  // Draft management
  const {
    loadDraft,
    clearDraft,
    hasDraft,
    saveAsNewDraft,
    loadDraftById,
    deleteDraft,
    startNewDraft,
    drafts,
    currentDraftId,
  } = useDraft();
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [showDraftList, setShowDraftList] = useState(false);

  // Scheduled post state
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  // Mention suggestions
  const {
    suggestions: mentionSuggestions,
    isLoading: isMentionLoading,
    selectedIndex: mentionSelectedIndex,
    showSuggestions: showMentionSuggestions,
    handleTextChange: handleMentionTextChange,
    handleKeyDown: handleMentionKeyDown,
    selectSuggestion: selectMentionSuggestion,
    closeSuggestions: closeMentionSuggestions,
  } = useMentionSuggestions();

  // Emoji suggestions
  const {
    suggestions: emojiSuggestions,
    isLoading: isEmojiLoading,
    selectedIndex: emojiSelectedIndex,
    showSuggestions: showEmojiSuggestions,
    handleTextChange: handleEmojiTextChange,
    handleKeyDown: handleEmojiKeyDown,
    selectSuggestion: selectEmojiSuggestion,
    closeSuggestions: closeEmojiSuggestions,
  } = useEmojiSuggestions();

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
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }

      addToast({
        type: "success",
        message: t`Draft restored`,
      });
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
    addToast({
      type: "info",
      message: t`Draft discarded`,
    });
  };

  const handleSaveAsNewDraft = () => {
    if (!text.trim() && !cw.trim()) {
      addToast({
        type: "error",
        message: t`Cannot save empty draft`,
      });
      return;
    }

    saveAsNewDraft({ text, cw, showCw, visibility });
    addToast({
      type: "success",
      message: t`Draft saved`,
    });
  };

  const handleLoadDraft = (id: string) => {
    const draft = loadDraftById(id);
    if (draft) {
      setText(draft.text);
      setCw(draft.cw);
      setShowCw(draft.showCw);
      setVisibility(draft.visibility);
      setShowDraftList(false);

      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }

      addToast({
        type: "success",
        message: t`Draft loaded`,
      });
    }
  };

  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDraft(id);
    addToast({
      type: "info",
      message: t`Draft deleted`,
    });
  };

  const handleNewDraft = () => {
    startNewDraft();
    setText("");
    setCw("");
    setShowCw(false);
    setVisibility("public");
    setShowDraftList(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const maxLength = NOTE_TEXT_MAX_LENGTH;
  const remainingChars = maxLength - text.length;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setText(newText);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    // Trigger mention detection
    handleMentionTextChange(newText, cursorPosition);
    // Trigger emoji detection
    handleEmojiTextChange(newText, cursorPosition);
  };

  // Handle keyboard events for suggestions (mentions and emojis)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Check if mention suggestions should handle this event
      if (handleMentionKeyDown(e)) {
        e.preventDefault();
        // If Enter or Tab was pressed, select the current suggestion
        if (e.key === "Enter" || e.key === "Tab") {
          const suggestion = mentionSuggestions[mentionSelectedIndex];
          if (suggestion) {
            const newText = selectMentionSuggestion(suggestion);
            setText(newText);
            // Update cursor position after the inserted mention
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }, 0);
          }
        }
        return;
      }

      // Check if emoji suggestions should handle this event
      if (handleEmojiKeyDown(e)) {
        e.preventDefault();
        // If Enter or Tab was pressed, select the current suggestion
        if (e.key === "Enter" || e.key === "Tab") {
          const suggestion = emojiSuggestions[emojiSelectedIndex];
          if (suggestion) {
            const newText = selectEmojiSuggestion(suggestion);
            setText(newText);
            // Update cursor position after the inserted emoji
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }, 0);
          }
        }
      }
    },
    [
      handleMentionKeyDown,
      mentionSuggestions,
      mentionSelectedIndex,
      selectMentionSuggestion,
      handleEmojiKeyDown,
      emojiSuggestions,
      emojiSelectedIndex,
      selectEmojiSuggestion,
    ],
  );

  // Handle clicking on a mention suggestion
  const handleMentionClick = useCallback(
    (index: number) => {
      const suggestion = mentionSuggestions[index];
      if (suggestion) {
        const newText = selectMentionSuggestion(suggestion);
        setText(newText);
        // Focus back on textarea
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 0);
      }
    },
    [mentionSuggestions, selectMentionSuggestion],
  );

  // Handle clicking on an emoji suggestion
  const handleEmojiClick = useCallback(
    (index: number) => {
      const suggestion = emojiSuggestions[index];
      if (suggestion) {
        const newText = selectEmojiSuggestion(suggestion);
        setText(newText);
        // Focus back on textarea
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }, 0);
      }
    },
    [emojiSuggestions, selectEmojiSuggestion],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    // Limit to 4 files total (including drive files)
    const remainingSlots = 4 - totalFileCount;
    setFiles((prev) => [...prev, ...selectedFiles.slice(0, remainingSlots)]);
  };

  const removeDriveFile = (fileId: string) => {
    setDriveFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleDriveFilesSelect = (selectedFiles: DriveFile[]) => {
    setDriveFiles((prev) => {
      // Combine and limit to remaining slots
      const remainingSlots = 4 - files.length;
      return [...prev, ...selectedFiles].slice(0, remainingSlots);
    });
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
      file.type.startsWith("image/"),
    );

    if (droppedFiles.length > 0) {
      const remainingSlots = 4 - totalFileCount;
      setFiles((prev) => [...prev, ...droppedFiles.slice(0, remainingSlots)]);
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

  const handleSubmit = async (scheduleDate?: string) => {
    if (!text.trim() && totalFileCount === 0) {
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

    // Validate scheduled date is in the future
    if (scheduleDate) {
      const scheduledTime = new Date(scheduleDate).getTime();
      if (scheduledTime <= Date.now()) {
        setError(t`Scheduled time must be in the future`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Start with already-uploaded drive file IDs
      const fileIds: string[] = driveFiles.map((f) => f.id);

      // Upload new files and get their IDs
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
            console.error("Failed to upload file:", uploadError);
            throw new Error(t`Failed to upload ${file.name}`);
          }
        }

        setIsUploading(false);
        setUploadProgress(0);
      }

      if (scheduleDate) {
        // Create scheduled note
        await scheduledNotesApi.create({
          text: text.trim(),
          cw: showCw && cw.trim() ? cw.trim() : undefined,
          visibility,
          fileIds: fileIds.length > 0 ? fileIds : undefined,
          replyId,
          scheduledAt: scheduleDate,
        });

        addToast({
          type: "success",
          message: t`Note scheduled successfully`,
        });
      } else {
        // Create note immediately
        await notesApi.createNote({
          text: text.trim(),
          cw: showCw && cw.trim() ? cw.trim() : undefined,
          visibility,
          fileIds: fileIds.length > 0 ? fileIds : undefined,
          replyId,
        });

        // Play success sound
        playPostSound(notificationSound, notificationVolume);

        addToast({
          type: "success",
          message: t`Note posted successfully`,
        });
      }

      // Reset form
      setText("");
      setCw("");
      setShowCw(false);
      setVisibility("public");
      setFiles([]);
      setDriveFiles([]);
      setScheduledAt(null);
      setShowSchedulePicker(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Clear draft
      clearDraft();

      onNoteCreated?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create note";
      setError(errorMessage);

      // Show error toast
      addToast({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleScheduleSubmit = () => {
    if (scheduledAt) {
      handleSubmit(scheduledAt);
    }
  };

  const visibilityOptions: { value: NoteVisibility; label: ReactNode; icon: ReactNode }[] = [
    { value: "public", label: <Trans>Public</Trans>, icon: <Globe className="w-4 h-4" /> },
    { value: "home", label: <Trans>Home</Trans>, icon: <HomeIcon className="w-4 h-4" /> },
    { value: "followers", label: <Trans>Followers</Trans>, icon: <Lock className="w-4 h-4" /> },
    { value: "direct", label: <Trans>Direct</Trans>, icon: <Mail className="w-4 h-4" /> },
  ];

  if (!currentUser) {
    return null;
  }

  const userInitials = currentUser.name
    ? currentUser.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
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
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
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
                <Trans>Replying to</Trans>{" "}
                <span className="text-primary-600 dark:text-primary-400 font-medium">
                  {replyTo}
                </span>
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

            {/* Main textarea with character counter bar */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Delay closing to allow click on suggestions
                  setTimeout(() => {
                    closeMentionSuggestions();
                    closeEmojiSuggestions();
                  }, 150);
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                placeholder={replyTo ? `Reply to ${replyTo}` : "What's happening?"}
                className="w-full min-h-[100px] resize-none rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSubmitting}
              />
              {/* Character counter - fixed position in textarea corner */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                <span
                  className={`text-xs font-medium tabular-nums transition-colors ${
                    remainingChars < 0
                      ? "text-red-500"
                      : remainingChars < 100
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {remainingChars}
                </span>
                {/* Small circular indicator */}
                <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    strokeWidth="2"
                    className="text-gray-200 dark:text-gray-600"
                    stroke="currentColor"
                  />
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min(Math.max((text.length / maxLength) * 37.7, 0), 37.7)} 37.7`}
                    className={`transition-all duration-150 ${
                      remainingChars < 0
                        ? "text-red-500"
                        : remainingChars < 100
                          ? "text-yellow-500"
                          : "text-green-500"
                    }`}
                    stroke="currentColor"
                  />
                </svg>
              </div>

              {/* Mention suggestions popup */}
              {showMentionSuggestions && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden z-50 max-h-60 overflow-y-auto">
                  {isMentionLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      <Trans>Loading...</Trans>
                    </div>
                  ) : mentionSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      <Trans>No users found</Trans>
                    </div>
                  ) : (
                    mentionSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.user.id}
                        onClick={() => handleMentionClick(index)}
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                          index === mentionSelectedIndex
                            ? "bg-primary-50 dark:bg-primary-900/30"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                        role="option"
                        aria-selected={index === mentionSelectedIndex}
                      >
                        <Avatar
                          src={suggestion.user.avatarUrl}
                          alt={suggestion.user.name || suggestion.user.username}
                          fallback={suggestion.user.username.slice(0, 2).toUpperCase()}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {suggestion.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {suggestion.value}
                          </div>
                        </div>
                        <AtSign className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Emoji suggestions popup */}
              {showEmojiSuggestions && !showMentionSuggestions && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden z-50 max-h-60 overflow-y-auto">
                  {isEmojiLoading ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      <Trans>Loading...</Trans>
                    </div>
                  ) : emojiSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      <Trans>No emojis found</Trans>
                    </div>
                  ) : (
                    emojiSuggestions.map((suggestion, index) => (
                      <div
                        key={`${suggestion.name}-${index}`}
                        onClick={() => handleEmojiClick(index)}
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                          index === emojiSelectedIndex
                            ? "bg-primary-50 dark:bg-primary-900/30"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                        role="option"
                        aria-selected={index === emojiSelectedIndex}
                      >
                        {suggestion.isCustom && suggestion.url ? (
                          <img
                            src={getProxiedImageUrl(suggestion.url) || suggestion.url}
                            alt={suggestion.name}
                            className="w-6 h-6 object-contain"
                          />
                        ) : (
                          <span className="text-2xl leading-none">{suggestion.emoji}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            :{suggestion.name}:
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

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

            {/* File previews (new uploads + drive files) */}
            {totalFileCount > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {/* New upload files */}
                {files.map((file, index) => (
                  <div key={`new-${index}`} className="relative group">
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
                {/* Drive files */}
                {driveFiles.map((file) => (
                  <div key={`drive-${file.id}`} className="relative group">
                    <img
                      src={getProxiedImageUrl(file.thumbnailUrl || file.url) || ""}
                      alt={file.name}
                      className="w-full h-32 object-cover rounded-md"
                    />
                    {/* Drive badge */}
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary-500/80 rounded text-[10px] text-white font-medium flex items-center gap-0.5">
                      <HardDrive className="w-3 h-3" />
                    </div>
                    <button
                      onClick={() => removeDriveFile(file.id)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      type="button"
                      aria-label={`Remove ${file.name}`}
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
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap flex-1 min-w-0">
                {/* File upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || totalFileCount >= 4}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  title={t`Add images`}
                  aria-label={t`Add images`}
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

                {/* Drive picker button */}
                <button
                  onClick={() => setShowDrivePicker(true)}
                  disabled={isSubmitting || totalFileCount >= 4}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  title={t`Select from drive`}
                  aria-label={t`Select from drive`}
                >
                  <HardDrive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>

                {/* CW toggle button */}
                <button
                  onClick={() => setShowCw(!showCw)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${
                    showCw
                      ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                  type="button"
                  title="Content Warning"
                  aria-label="Toggle content warning"
                  aria-pressed={showCw}
                >
                  CW
                </button>

                {/* Emoji picker */}
                <EmojiPicker onEmojiSelect={handleEmojiSelect} isDisabled={isSubmitting} />

                {/* MFM Preview toggle */}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${
                    showPreview
                      ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                  type="button"
                  title="Preview MFM"
                  aria-label="Toggle MFM preview"
                  aria-pressed={showPreview}
                >
                  <Eye className="w-5 h-5" />
                </button>

                {/* Save draft button */}
                <button
                  onClick={handleSaveAsNewDraft}
                  disabled={isSubmitting || (!text.trim() && !cw.trim())}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400"
                  type="button"
                  title={t`Save draft`}
                  aria-label={t`Save draft`}
                >
                  <Save className="w-5 h-5" />
                </button>

                {/* Drafts list button */}
                <div className="relative">
                  <button
                    onClick={() => setShowDraftList(!showDraftList)}
                    disabled={isSubmitting}
                    className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${
                      showDraftList
                        ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                    type="button"
                    title={t`Drafts`}
                    aria-label={t`Drafts`}
                    aria-expanded={showDraftList}
                  >
                    <FileText className="w-5 h-5" />
                    {drafts.length > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-primary-500 rounded-full">
                        {drafts.length}
                      </span>
                    )}
                  </button>

                  {/* Drafts dropdown */}
                  {showDraftList && (
                    <div className="absolute bottom-full left-0 sm:left-auto sm:right-0 mb-2 w-[calc(100vw-2rem)] sm:w-72 max-w-72 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden z-50">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          <Trans>Drafts</Trans> ({drafts.length})
                        </span>
                        <button
                          onClick={handleNewDraft}
                          className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                          type="button"
                        >
                          <Trans>New</Trans>
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {drafts.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                            <Trans>No drafts saved</Trans>
                          </div>
                        ) : (
                          drafts.map((draft) => (
                            <div
                              key={draft.id}
                              onClick={() => handleLoadDraft(draft.id)}
                              onKeyDown={(e) => e.key === "Enter" && handleLoadDraft(draft.id)}
                              className={`flex items-start justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                currentDraftId === draft.id
                                  ? "bg-primary-50 dark:bg-primary-900/20"
                                  : ""
                              }`}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="flex-1 min-w-0 mr-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {draft.title || draft.text.slice(0, 30) || t`Empty draft`}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(draft.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <button
                                onClick={(e) => handleDeleteDraft(draft.id, e)}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-red-500"
                                type="button"
                                aria-label={t`Delete draft`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

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

                {/* Schedule post button (not available for replies) */}
                {!replyId && (
                  <div className="relative">
                    <button
                      onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                      disabled={isSubmitting}
                      className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${
                        showSchedulePicker || scheduledAt
                          ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                      type="button"
                      title={t`Schedule post`}
                      aria-label={t`Schedule post`}
                      aria-expanded={showSchedulePicker}
                    >
                      <Clock className="w-5 h-5" />
                    </button>

                    {/* Schedule picker dropdown */}
                    {showSchedulePicker && (
                      <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-60">
                        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            <Trans>Schedule post</Trans>
                          </span>
                        </div>
                        <div className="p-3 space-y-3">
                          <input
                            type="datetime-local"
                            value={scheduledAt || ""}
                            onChange={(e) => setScheduledAt(e.target.value || null)}
                            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {scheduledAt && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <Trans>
                                Will be posted at {new Date(scheduledAt).toLocaleString()}
                              </Trans>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onPress={() => {
                                setScheduledAt(null);
                                setShowSchedulePicker(false);
                              }}
                              className="flex-1"
                            >
                              <Trans>Cancel</Trans>
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onPress={handleScheduleSubmit}
                              isDisabled={
                                !scheduledAt ||
                                isSubmitting ||
                                isUploading ||
                                (!text.trim() && totalFileCount === 0) ||
                                text.length > maxLength
                              }
                              className="flex-1"
                            >
                              <Trans>Schedule</Trans>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit button */}
              <Button
                onPress={() => handleSubmit()}
                isDisabled={
                  isSubmitting ||
                  isUploading ||
                  (!text.trim() && totalFileCount === 0) ||
                  text.length > maxLength
                }
                variant="primary"
                size="sm"
                className="min-w-[72px] shrink-0"
              >
                <span className="flex items-center justify-center gap-2 whitespace-nowrap">
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
                </span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Drive Picker Dialog */}
      <DrivePickerDialog
        isOpen={showDrivePicker}
        onClose={() => setShowDrivePicker(false)}
        onSelect={handleDriveFilesSelect}
        maxFiles={4}
        currentFileCount={totalFileCount}
        fileTypes={["image"]}
      />
    </Card>
  );
}
