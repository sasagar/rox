"use client";

import { useState, useEffect, memo, useMemo, useRef, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { Note, NoteFile } from "../../lib/types/note";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { MessageCircle, Repeat2, MoreHorizontal, Flag, Globe } from "lucide-react";
import { getRemoteInstanceInfo, type PublicRemoteInstance } from "../../lib/api/instance";
import { Card, CardContent } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { SpaLink } from "../ui/SpaLink";
import { ImageModal } from "../ui/ImageModal";
import { notesApi } from "../../lib/api/notes";
import { NoteComposer } from "./NoteComposer";
import { ReactionButton } from "./ReactionPicker";
import { ReportDialog } from "../report/ReportDialog";
import {
  createReaction,
  deleteReaction,
  getMyReactions,
  getReactionCountsWithEmojis,
} from "../../lib/api/reactions";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";
import { tokenAtom, currentUserAtom } from "../../lib/atoms/auth";
import { MfmRenderer } from "../mfm/MfmRenderer";
import { addToastAtom } from "../../lib/atoms/toast";

/**
 * Props for the NoteCard component
 */
export interface NoteCardProps {
  /** Note data to display */
  note: Note;
  /** Optional callback when note is deleted */
  onDelete?: () => void;
  /** Optional callback when note is deleted (alias) */
  onNoteDeleted?: () => void;
  /** Optional callback when a reply is created */
  onReplyCreated?: () => void | Promise<void>;
  /** Show detailed timestamp (full date/time) */
  showDetailedTimestamp?: boolean;
}

/**
 * NoteCard component for displaying a single note/post
 * Shows user info, content, attachments, and interaction buttons
 *
 * @param note - Note data to display
 * @param onDelete - Callback when note is deleted
 */
function NoteCardComponent({
  note,
  onDelete: _onDelete,
  onNoteDeleted: _onNoteDeleted,
  onReplyCreated: _onReplyCreated,
  showDetailedTimestamp: _showDetailedTimestamp,
}: NoteCardProps) {
  const [showCw, setShowCw] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const token = useAtomValue(tokenAtom);
  const currentUser = useAtomValue(currentUserAtom);
  const addToast = useSetAtom(addToastAtom);
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [localReactions, setLocalReactions] = useState<Record<string, number>>(
    note.reactions || {},
  );
  const [reactionEmojis, setReactionEmojis] = useState<Record<string, string>>(
    note.reactionEmojis || {},
  );
  const [remoteInstance, setRemoteInstance] = useState<PublicRemoteInstance | null>(null);

  // Refs for lazy loading with IntersectionObserver
  const cardRef = useRef<HTMLDivElement>(null);
  const hasLoadedReactionData = useRef(false);
  const hasLoadedInstanceInfo = useRef(false);

  // Callback to load reaction data when card becomes visible
  const loadReactionData = useCallback(async () => {
    if (hasLoadedReactionData.current) return;
    hasLoadedReactionData.current = true;

    try {
      // Load user's own reactions first if logged in
      let userReactions: string[] = [];
      if (token) {
        const reactions = await getMyReactions(note.id, token);
        userReactions = reactions.map((r) => r.reaction);
        setMyReactions(userReactions);
      }

      // Load custom emoji URLs
      // For remote user notes, fetch reactions from remote server
      const isRemoteNote = Boolean(note.user.host);
      const reactionData = await getReactionCountsWithEmojis(note.id, isRemoteNote);

      if (Object.keys(reactionData.counts).length > 0) {
        // Merge with user's own reactions to prevent count from jumping back
        const merged = { ...reactionData.counts };
        for (const reaction of userReactions) {
          if (merged[reaction] === undefined || merged[reaction] < 1) {
            merged[reaction] = Math.max(merged[reaction] || 0, 1);
          }
        }
        setLocalReactions(merged);
      }
      if (Object.keys(reactionData.emojis).length > 0) {
        setReactionEmojis(reactionData.emojis);
      }
    } catch (error) {
      console.error("Failed to load reaction data:", error);
    }
  }, [note.id, note.user.host, token]);

  // Callback to load remote instance info when card becomes visible
  const loadInstanceInfo = useCallback(async () => {
    if (hasLoadedInstanceInfo.current || !note.user.host) return;
    hasLoadedInstanceInfo.current = true;

    const info = await getRemoteInstanceInfo(note.user.host);
    if (info) {
      setRemoteInstance(info);
    }
  }, [note.user.host]);

  // Convert profileEmojis array to emoji map for MfmRenderer
  const userProfileEmojiMap = useMemo(() => {
    if (!note.user.profileEmojis || note.user.profileEmojis.length === 0) return {};
    return note.user.profileEmojis.reduce(
      (acc, emoji) => {
        acc[emoji.name] = emoji.url;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [note.user.profileEmojis]);

  // Convert renote user's profileEmojis to emoji map
  const renoteUserProfileEmojiMap = useMemo(() => {
    if (!note.renote?.user?.profileEmojis || note.renote.user.profileEmojis.length === 0) return {};
    return note.renote.user.profileEmojis.reduce(
      (acc, emoji) => {
        acc[emoji.name] = emoji.url;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [note.renote?.user?.profileEmojis]);

  // Convert reply user's profileEmojis to emoji map
  const replyUserProfileEmojiMap = useMemo(() => {
    if (!note.reply?.user?.profileEmojis || note.reply.user.profileEmojis.length === 0) return {};
    return note.reply.user.profileEmojis.reduce(
      (acc, emoji) => {
        acc[emoji.name] = emoji.url;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [note.reply?.user?.profileEmojis]);

  // Sync reactions from props when they change (e.g., from SSE updates)
  useEffect(() => {
    if (note.reactions) {
      setLocalReactions(note.reactions);
    }
  }, [note.reactions]);

  useEffect(() => {
    if (note.reactionEmojis) {
      setReactionEmojis(note.reactionEmojis);
    }
  }, [note.reactionEmojis]);

  // Lazy load reaction data and instance info when card becomes visible
  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          loadReactionData();
          loadInstanceInfo();
          observer.disconnect();
        }
      },
      { rootMargin: "100px", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [loadReactionData, loadInstanceInfo]);

  const handleReaction = async (reaction: string) => {
    if (isReacting || !token) return;
    setIsReacting(true);

    try {
      // Check if user already reacted with this emoji
      const isAlreadyReacted = myReactions.includes(reaction);

      if (isAlreadyReacted) {
        // Remove reaction
        await deleteReaction(note.id, reaction, token);
        setMyReactions(myReactions.filter((r) => r !== reaction));

        // Update local reaction count
        setLocalReactions((prev) => {
          const newReactions = { ...prev };
          const currentCount = newReactions[reaction] || 0;
          if (currentCount <= 1) {
            delete newReactions[reaction];
          } else {
            newReactions[reaction] = currentCount - 1;
          }
          return newReactions;
        });
      } else {
        // Add reaction
        const newReaction = await createReaction(note.id, reaction, token);
        setMyReactions([...myReactions, reaction]);

        // Update local reaction count
        setLocalReactions((prev) => ({
          ...prev,
          [reaction]: (prev[reaction] || 0) + 1,
        }));

        // Update emoji URL if this is a custom emoji with URL
        if (newReaction.customEmojiUrl) {
          setReactionEmojis((prev) => ({
            ...prev,
            [reaction]: newReaction.customEmojiUrl!,
          }));
        }

        addToast({
          type: "success",
          message: t`Reaction added`,
        });
      }
    } catch (error) {
      console.error("Failed to react:", error);
      addToast({
        type: "error",
        message: t`Failed to add reaction`,
      });
    } finally {
      setIsReacting(false);
    }
  };

  const handleRenote = async () => {
    try {
      await notesApi.renote(note.id);
      addToast({
        type: "success",
        message: t`Note renoted`,
      });
    } catch (error) {
      console.error("Failed to renote:", error);
      addToast({
        type: "error",
        message: t`Failed to renote`,
      });
    }
  };

  // Get user initials for avatar fallback
  const userInitials = note.user.name
    ? note.user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : note.user.username.slice(0, 2).toUpperCase();

  return (
    <Card
      ref={cardRef}
      hover
      className="transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      role="article"
      aria-label={`Post by ${note.user.name || note.user.username}`}
      tabIndex={0}
    >
      <CardContent className="p-4">
        {/* User Info */}
        <div className="mb-3 flex items-start gap-3">
          <SpaLink
            to={
              note.user.host
                ? `/@${note.user.username}@${note.user.host}`
                : `/${note.user.username}`
            }
            className="shrink-0"
            aria-label={`View profile of ${note.user.name || note.user.username}`}
          >
            <Avatar
              src={note.user.avatarUrl}
              alt={note.user.name || note.user.username}
              fallback={userInitials}
              size="md"
            />
          </SpaLink>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <SpaLink
                to={
                  note.user.host
                    ? `/@${note.user.username}@${note.user.host}`
                    : `/${note.user.username}`
                }
                className="font-semibold text-(--text-primary) truncate hover:underline"
              >
                {note.user.name ? (
                  <MfmRenderer text={note.user.name} plain customEmojis={userProfileEmojiMap} />
                ) : (
                  note.user.username
                )}
              </SpaLink>
              <SpaLink
                to={
                  note.user.host
                    ? `/@${note.user.username}@${note.user.host}`
                    : `/${note.user.username}`
                }
                className="text-sm text-(--text-muted) truncate hover:underline"
              >
                @{note.user.username}
                {note.user.host && `@${note.user.host}`}
              </SpaLink>
              {/* Remote instance badge with server info */}
              {note.user.host && (
                <a
                  href={`https://${note.user.host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded hover:opacity-80 transition-opacity truncate max-w-40 text-(--text-secondary)"
                  style={{
                    backgroundColor: remoteInstance?.themeColor
                      ? `${remoteInstance.themeColor}15`
                      : "var(--bg-tertiary)",
                    borderLeft: remoteInstance?.themeColor
                      ? `2px solid ${remoteInstance.themeColor}`
                      : "2px solid var(--border-color)",
                  }}
                  title={
                    remoteInstance
                      ? `${remoteInstance.name || note.user.host}${remoteInstance.softwareName ? ` (${remoteInstance.softwareName})` : ""}`
                      : `From ${note.user.host}`
                  }
                >
                  {remoteInstance?.iconUrl ? (
                    <img
                      src={getProxiedImageUrl(remoteInstance.iconUrl) || ""}
                      alt=""
                      className="w-3.5 h-3.5 rounded-sm object-contain"
                      loading="lazy"
                      onError={(e) => {
                        // Hide broken image and show fallback
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <Globe
                    className={`w-3 h-3 ${remoteInstance?.iconUrl ? "hidden" : ""}`}
                  />
                  <span className="truncate">
                    {remoteInstance?.name || note.user.host}
                  </span>
                </a>
              )}
            </div>
            <SpaLink
              to={`/notes/${note.id}`}
              className="text-xs text-(--text-muted) hover:underline"
              title={new Date(note.createdAt).toLocaleString()}
              suppressHydrationWarning
            >
              <span suppressHydrationWarning>
                {new Date(note.createdAt).toLocaleString()}
              </span>
            </SpaLink>
          </div>
        </div>

        {/* Renote Indicator */}
        {note.renote && (
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
            <Trans>Renoted</Trans>
          </div>
        )}

        {/* Content Warning */}
        {note.cw && !showCw && (
          <div className="mb-3">
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/30 p-3" role="alert">
              <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                <Trans>Content Warning</Trans>: {note.cw}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowCw(true)}
                className="mt-2"
                aria-expanded={showCw}
                aria-label={`Show content. Warning: ${note.cw}`}
              >
                <Trans>Show content</Trans>
              </Button>
            </div>
          </div>
        )}

        {/* Note Content */}
        {(!note.cw || showCw) && (
          <>
            {/* Text */}
            {note.text && (
              <div className="mb-3 whitespace-pre-wrap wrap-break-word text-gray-900 dark:text-gray-100">
                <MfmRenderer text={note.text} />
              </div>
            )}

            {/* Attachments */}
            {note.files && note.files.length > 0 && (
              <div
                className={`mb-3 grid gap-2 ${
                  note.files.length === 1
                    ? "grid-cols-1"
                    : note.files.length === 2
                      ? "grid-cols-2"
                      : note.files.length === 3
                        ? "grid-cols-3"
                        : "grid-cols-2"
                }`}
                role="group"
                aria-label={`${note.files.length} attached image${note.files.length > 1 ? "s" : ""}`}
              >
                {note.files.map((file: NoteFile, index: number) => (
                  <button
                    key={file.id}
                    onClick={() => {
                      setSelectedImageIndex(index);
                      setShowImageModal(true);
                    }}
                    className="relative overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    aria-label={`View image ${index + 1} of ${note.files?.length ?? 0}${file.comment ? `: ${file.comment}` : ""}`}
                  >
                    <img
                      src={getProxiedImageUrl(file.thumbnailUrl || file.url) || ""}
                      alt={
                        file.comment ||
                        `Image ${index + 1} from ${note.user.name || note.user.username}'s post`
                      }
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Image Modal */}
            {showImageModal && note.files && note.files.length > 0 && (
              <ImageModal
                images={note.files.map((file) => getProxiedImageUrl(file.url) || file.url)}
                initialIndex={selectedImageIndex}
                onClose={() => setShowImageModal(false)}
                alt={`${note.user.name || note.user.username}'s post`}
              />
            )}

            {/* Renoted Note */}
            {note.renote && (
              <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <SpaLink to={note.renote.user.host ? `/@${note.renote.user.username}@${note.renote.user.host}` : `/${note.renote.user.username}`} className="shrink-0">
                    <Avatar
                      src={note.renote.user.avatarUrl}
                      alt={note.renote.user.name || note.renote.user.username}
                      size="sm"
                    />
                  </SpaLink>
                  <SpaLink
                    to={note.renote.user.host ? `/@${note.renote.user.username}@${note.renote.user.host}` : `/${note.renote.user.username}`}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline"
                  >
                    {note.renote.user.name ? (
                      <MfmRenderer text={note.renote.user.name} plain customEmojis={renoteUserProfileEmojiMap} />
                    ) : (
                      note.renote.user.username
                    )}
                  </SpaLink>
                  <SpaLink
                    to={note.renote.user.host ? `/@${note.renote.user.username}@${note.renote.user.host}` : `/${note.renote.user.username}`}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    @{note.renote.user.username}{note.renote.user.host ? `@${note.renote.user.host}` : ""}
                  </SpaLink>
                </div>
                {note.renote.text && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap wrap-break-word">
                    <MfmRenderer text={note.renote.text} />
                  </div>
                )}
              </div>
            )}

            {/* Reply Source - Speech bubble style showing the note being replied to */}
            {note.reply && (
              <div className="mb-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <MessageCircle className="h-3 w-3" />
                    <Trans>In reply to</Trans>
                  </div>
                  <div className="flex items-start gap-2">
                    <SpaLink
                      to={note.reply.user.host ? `/@${note.reply.user.username}@${note.reply.user.host}` : `/${note.reply.user.username}`}
                      className="shrink-0"
                    >
                      <Avatar
                        src={note.reply.user.avatarUrl}
                        alt={note.reply.user.name || note.reply.user.username}
                        size="sm"
                      />
                    </SpaLink>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SpaLink
                          to={note.reply.user.host ? `/@${note.reply.user.username}@${note.reply.user.host}` : `/${note.reply.user.username}`}
                          className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline"
                        >
                          {note.reply.user.name ? (
                            <MfmRenderer text={note.reply.user.name} plain customEmojis={replyUserProfileEmojiMap} />
                          ) : (
                            note.reply.user.username
                          )}
                        </SpaLink>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          @{note.reply.user.username}{note.reply.user.host ? `@${note.reply.user.host}` : ""}
                        </span>
                      </div>
                      {note.reply.text && (
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap wrap-break-word line-clamp-3">
                          <MfmRenderer text={note.reply.text} plain />
                        </div>
                      )}
                    </div>
                    <SpaLink
                      to={`/notes/${note.reply.id}`}
                      className="text-xs text-primary-500 hover:text-primary-600 hover:underline shrink-0"
                    >
                      <Trans>View</Trans>
                    </SpaLink>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Interaction Buttons */}
        <div
          className="flex items-center gap-1 sm:gap-2 flex-wrap border-t border-gray-100 dark:border-gray-700 pt-3"
          role="group"
          aria-label="Post actions"
        >
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setShowReplyComposer(!showReplyComposer)}
            className="text-gray-600 dark:text-gray-400 hover:text-primary-600 min-w-[60px] flex items-center gap-1"
            aria-label={`Reply to post. ${note.repliesCount || 0} ${note.repliesCount === 1 ? "reply" : "replies"}`}
            aria-expanded={showReplyComposer}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{note.repliesCount || 0}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onPress={handleRenote}
            className="text-gray-600 dark:text-gray-400 hover:text-green-600 min-w-[60px] flex items-center gap-1"
            aria-label={`Renote post. ${note.renoteCount || 0} ${note.renoteCount === 1 ? "renote" : "renotes"}`}
          >
            <Repeat2 className="w-4 h-4" />
            <span>{note.renoteCount || 0}</span>
          </Button>
          {/* Reaction button - always shown, allows adding new reactions */}
          <ReactionButton
            onReactionSelect={handleReaction}
            selectedReactions={myReactions}
            isDisabled={isReacting}
          />
          {localReactions && Object.keys(localReactions).length > 0 && (
            <div
              className="flex items-center gap-1.5 flex-wrap text-sm text-gray-600 dark:text-gray-400"
              role="group"
              aria-label="Reactions"
            >
              {Object.entries(localReactions).map(([emoji, count]) => {
                // Check if this is a custom emoji (format: :emoji_name:)
                const isCustomEmoji = emoji.startsWith(":") && emoji.endsWith(":");
                const customEmojiUrl = reactionEmojis[emoji];
                const isRemoteNote = Boolean(note.user.host);

                // For remote notes, use div (display-only); for local notes, use button (interactive)
                const ReactionElement = isRemoteNote ? "div" : "button";

                return (
                  <ReactionElement
                    key={emoji}
                    onClick={isRemoteNote ? undefined : () => handleReaction(emoji)}
                    disabled={isRemoteNote ? undefined : isReacting}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      transition-all
                      ${isRemoteNote
                        ? "bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-500 cursor-default opacity-80"
                        : myReactions.includes(emoji)
                          ? "border border-solid bg-primary-100 dark:bg-primary-900/30 border-primary-400 dark:border-primary-600 cursor-pointer"
                          : "border border-solid bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer"}
                    `}
                    aria-label={isRemoteNote
                      ? `${emoji} reaction. ${count} ${count === 1 ? "reaction" : "reactions"}`
                      : `${myReactions.includes(emoji) ? "Remove" : "Add"} ${emoji} reaction. ${count} ${count === 1 ? "reaction" : "reactions"}`}
                    aria-pressed={isRemoteNote ? undefined : myReactions.includes(emoji)}
                  >
                    {isCustomEmoji && customEmojiUrl ? (
                      <img
                        src={getProxiedImageUrl(customEmojiUrl) || ""}
                        alt={emoji}
                        className="h-6 max-w-16 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
                    )}
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{count}</span>
                  </ReactionElement>
                );
              })}
            </div>
          )}
          {/* More menu with report option */}
          {currentUser && currentUser.id !== note.user.id && (
            <div className="relative ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowMoreMenu(!showMoreMenu)}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                aria-label={t`More options`}
                aria-expanded={showMoreMenu}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-(--border-color) bg-(--bg-primary) shadow-lg z-10">
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowReportDialog(true);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-(--bg-secondary) rounded-lg"
                  >
                    <Flag className="w-4 h-4" />
                    <Trans>Report</Trans>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reply Composer */}
        {showReplyComposer && currentUser && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <NoteComposer
              replyId={note.id}
              replyTo={`@${note.user.username}`}
              onNoteCreated={() => {
                setShowReplyComposer(false);
                // TODO: Refresh note to show new reply count
              }}
            />
          </div>
        )}

        {/* Report Dialog */}
        <ReportDialog
          isOpen={showReportDialog}
          onClose={() => setShowReportDialog(false)}
          targetType="note"
          targetNoteId={note.id}
          targetUserId={note.user.id}
          targetUsername={note.user.username}
        />
      </CardContent>
    </Card>
  );
}

// Memoize NoteCard to prevent unnecessary re-renders in timeline
export const NoteCard = memo(NoteCardComponent);
