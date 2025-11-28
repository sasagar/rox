'use client';

import { useState, useEffect, memo } from 'react';
import { useAtom } from 'jotai';
import type { Note, NoteFile } from '../../lib/types/note';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { MessageCircle, Repeat2, MoreHorizontal, Flag } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { ImageModal } from '../ui/ImageModal';
import { notesApi } from '../../lib/api/notes';
import { NoteComposer } from './NoteComposer';
import { ReactionButton } from './ReactionPicker';
import { ReportDialog } from '../report/ReportDialog';
import { createReaction, deleteReaction, getMyReactions, getReactionCountsWithEmojis } from '../../lib/api/reactions';
import { followUser, unfollowUser } from '../../lib/api/following';
import { tokenAtom, currentUserAtom } from '../../lib/atoms/auth';
import { MfmRenderer } from '../mfm/MfmRenderer';
import { addToastAtom } from '../../lib/atoms/toast';

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
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [token] = useAtom(tokenAtom);
  const [currentUser] = useAtom(currentUserAtom);
  const [, addToast] = useAtom(addToastAtom);
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [localReactions, setLocalReactions] = useState<Record<string, number>>(note.reactions || {});
  const [reactionEmojis, setReactionEmojis] = useState<Record<string, string>>(note.reactionEmojis || {});

  // Load user's existing reactions and custom emoji URLs on mount
  useEffect(() => {
    const loadReactionData = async () => {
      try {
        // Load custom emoji URLs
        const reactionData = await getReactionCountsWithEmojis(note.id);
        if (Object.keys(reactionData.counts).length > 0) {
          setLocalReactions(reactionData.counts);
        }
        if (Object.keys(reactionData.emojis).length > 0) {
          setReactionEmojis(reactionData.emojis);
        }

        // Load user's own reactions if logged in
        if (token) {
          const reactions = await getMyReactions(note.id, token);
          setMyReactions(reactions.map((r) => r.reaction));
        }
      } catch (error) {
        console.error('Failed to load reaction data:', error);
      }
    };

    loadReactionData();
  }, [note.id, token]);

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
        await createReaction(note.id, reaction, token);
        setMyReactions([...myReactions, reaction]);

        // Update local reaction count
        setLocalReactions((prev) => ({
          ...prev,
          [reaction]: (prev[reaction] || 0) + 1,
        }));

        addToast({
          type: 'success',
          message: t`Reaction added`,
        });
      }
    } catch (error) {
      console.error('Failed to react:', error);
      addToast({
        type: 'error',
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
        type: 'success',
        message: t`Note renoted`,
      });
    } catch (error) {
      console.error('Failed to renote:', error);
      addToast({
        type: 'error',
        message: t`Failed to renote`,
      });
    }
  };

  const handleFollow = async () => {
    if (!token || !currentUser) return;

    try {
      if (isFollowing) {
        await unfollowUser(note.user.id, token);
        setIsFollowing(false);
        addToast({
          type: 'success',
          message: t`Unfollowed successfully`,
        });
      } else {
        await followUser(note.user.id, token);
        setIsFollowing(true);
        addToast({
          type: 'success',
          message: t`Following successfully`,
        });
      }
    } catch (error) {
      console.error('Failed to update follow status:', error);
      addToast({
        type: 'error',
        message: t`Failed to update follow status`,
      });
    }
  };

  // Get user initials for avatar fallback
  const userInitials = note.user.name
    ? note.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : note.user.username.slice(0, 2).toUpperCase();

  return (
    <Card
      hover
      className="transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      role="article"
      aria-label={`Post by ${note.user.name || note.user.username}`}
      tabIndex={0}
    >
      <CardContent className="p-4">
        {/* User Info */}
        <div className="mb-3 flex items-start gap-3">
          <a
            href={`/${note.user.username}`}
            className="shrink-0"
            aria-label={`View profile of ${note.user.name || note.user.username}`}
          >
            <Avatar
              src={note.user.avatarUrl}
              alt={note.user.name || note.user.username}
              fallback={userInitials}
              size="md"
            />
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={note.user.host ? `/@${note.user.username}@${note.user.host}` : `/${note.user.username}`}
                className="font-semibold text-(--text-primary) truncate hover:underline"
              >
                {note.user.name ? (
                  <MfmRenderer text={note.user.name} plain />
                ) : (
                  note.user.username
                )}
              </a>
              <a
                href={note.user.host ? `/@${note.user.username}@${note.user.host}` : `/${note.user.username}`}
                className="text-sm text-(--text-muted) truncate hover:underline"
              >
                @{note.user.username}{note.user.host && `@${note.user.host}`}
              </a>
              {/* Remote instance badge */}
              {note.user.host && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-(--bg-tertiary) text-(--text-muted) truncate max-w-[120px]"
                  title={`From ${note.user.host}`}
                >
                  🌐 {note.user.host}
                </span>
              )}
            </div>
            <a
              href={`/notes/${note.id}`}
              className="text-xs text-(--text-muted) hover:underline"
              title={new Date(note.createdAt).toLocaleString()}
            >
              {new Date(note.createdAt).toLocaleString()}
            </a>
          </div>
          {/* Follow button (only show if not own post and logged in) */}
          {currentUser && currentUser.id !== note.user.id && (
            <Button
              variant={isFollowing ? 'secondary' : 'primary'}
              size="sm"
              onPress={handleFollow}
              className={`${
                isFollowing
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              {isFollowing ? <Trans>Following</Trans> : <Trans>Follow</Trans>}
            </Button>
          )}
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
                    ? 'grid-cols-1'
                    : note.files.length === 2
                    ? 'grid-cols-2'
                    : note.files.length === 3
                    ? 'grid-cols-3'
                    : 'grid-cols-2'
                }`}
                role="group"
                aria-label={`${note.files.length} attached image${note.files.length > 1 ? 's' : ''}`}
              >
                {note.files.map((file: NoteFile, index: number) => (
                  <button
                    key={file.id}
                    onClick={() => {
                      setSelectedImageIndex(index);
                      setShowImageModal(true);
                    }}
                    className="relative overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    aria-label={`View image ${index + 1} of ${note.files?.length ?? 0}${file.comment ? `: ${file.comment}` : ''}`}
                  >
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt={file.comment || `Image ${index + 1} from ${note.user.name || note.user.username}'s post`}
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
                images={note.files.map((file) => file.url)}
                initialIndex={selectedImageIndex}
                onClose={() => setShowImageModal(false)}
                alt={`${note.user.name || note.user.username}'s post`}
              />
            )}

            {/* Renoted Note */}
            {note.renote && (
              <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <a href={`/${note.renote.user.username}`} className="shrink-0">
                    <Avatar
                      src={note.renote.user.avatarUrl}
                      alt={note.renote.user.name || note.renote.user.username}
                      size="sm"
                    />
                  </a>
                  <a
                    href={`/${note.renote.user.username}`}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:underline"
                  >
                    {note.renote.user.name ? (
                      <MfmRenderer text={note.renote.user.name} plain />
                    ) : (
                      note.renote.user.username
                    )}
                  </a>
                  <a
                    href={`/${note.renote.user.username}`}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    @{note.renote.user.username}
                  </a>
                </div>
                {note.renote.text && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap wrap-break-word">
                    <MfmRenderer text={note.renote.text} />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Interaction Buttons */}
        <div className="flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-3" role="group" aria-label="Post actions">
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setShowReplyComposer(!showReplyComposer)}
            className="text-gray-600 dark:text-gray-400 hover:text-primary-600 min-w-[60px] flex items-center gap-1"
            aria-label={`Reply to post. ${note.repliesCount || 0} ${note.repliesCount === 1 ? 'reply' : 'replies'}`}
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
            aria-label={`Renote post. ${note.renoteCount || 0} ${note.renoteCount === 1 ? 'renote' : 'renotes'}`}
          >
            <Repeat2 className="w-4 h-4" />
            <span>{note.renoteCount || 0}</span>
          </Button>
          <ReactionButton
            onReactionSelect={handleReaction}
            selectedReactions={myReactions}
            isDisabled={isReacting}
          />
          {localReactions && Object.keys(localReactions).length > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400" role="group" aria-label="Reactions">
              {Object.entries(localReactions).map(([emoji, count]) => {
                // Check if this is a custom emoji (format: :emoji_name:)
                const isCustomEmoji = emoji.startsWith(':') && emoji.endsWith(':');
                const customEmojiUrl = reactionEmojis[emoji];

                return (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    disabled={isReacting}
                    className={`
                      flex items-center gap-1 px-2 py-1 rounded-full
                      transition-all hover:bg-gray-100 dark:hover:bg-gray-700
                      ${myReactions.includes(emoji) ? 'bg-primary-100 dark:bg-primary-900/30 ring-1 ring-primary-500' : 'bg-gray-50 dark:bg-gray-800'}
                    `}
                    aria-label={`${myReactions.includes(emoji) ? 'Remove' : 'Add'} ${emoji} reaction. ${count} ${count === 1 ? 'reaction' : 'reactions'}`}
                    aria-pressed={myReactions.includes(emoji)}
                  >
                    {isCustomEmoji && customEmojiUrl ? (
                      <img
                        src={customEmojiUrl}
                        alt={emoji}
                        className="w-5 h-5 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span aria-hidden="true">{emoji}</span>
                    )}
                    <span className="text-xs font-medium">{count}</span>
                  </button>
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
