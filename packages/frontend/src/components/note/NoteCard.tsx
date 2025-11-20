'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import type { Note, NoteFile } from '../../lib/types/note';
import { Trans } from '@lingui/react/macro';
import { Card, CardContent } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { notesApi } from '../../lib/api/notes';
import { NoteComposer } from './NoteComposer';
import { ReactionButton } from './ReactionPicker';
import { createReaction, deleteReaction, getMyReactions } from '../../lib/api/reactions';
import { followUser, unfollowUser } from '../../lib/api/following';
import { tokenAtom, currentUserAtom } from '../../lib/atoms/auth';

/**
 * Props for the NoteCard component
 */
export interface NoteCardProps {
  /** Note data to display */
  note: Note;
  /** Optional callback when note is deleted */
  onDelete?: () => void;
}

/**
 * NoteCard component for displaying a single note/post
 * Shows user info, content, attachments, and interaction buttons
 *
 * @param note - Note data to display
 * @param onDelete - Callback when note is deleted
 */
export function NoteCard({ note, onDelete: _onDelete }: NoteCardProps) {
  const [showCw, setShowCw] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [token] = useAtom(tokenAtom);
  const [currentUser] = useAtom(currentUserAtom);
  const [myReactions, setMyReactions] = useState<string[]>([]);

  // Load user's existing reactions on mount
  useEffect(() => {
    const loadMyReactions = async () => {
      if (!token) return;

      try {
        const reactions = await getMyReactions(note.id, token);
        setMyReactions(reactions.map((r) => r.reaction));
      } catch (error) {
        console.error('Failed to load user reactions:', error);
      }
    };

    loadMyReactions();
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
      } else {
        // Add reaction
        await createReaction(note.id, reaction, token);
        setMyReactions([...myReactions, reaction]);
      }

      // TODO: Update local state or refetch timeline
    } catch (error) {
      console.error('Failed to react:', error);
    } finally {
      setIsReacting(false);
    }
  };

  const handleRenote = async () => {
    try {
      await notesApi.renote(note.id);
      // TODO: Show success message
    } catch (error) {
      console.error('Failed to renote:', error);
    }
  };

  const handleFollow = async () => {
    if (!token || !currentUser) return;

    try {
      if (isFollowing) {
        await unfollowUser(note.user.id, token);
        setIsFollowing(false);
      } else {
        await followUser(note.user.id, token);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Failed to update follow status:', error);
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
    <Card hover className="transition-all">
      <CardContent className="p-4">
        {/* User Info */}
        <div className="mb-3 flex items-start gap-3">
          <Avatar
            src={note.user.avatarUrl}
            alt={note.user.name || note.user.username}
            fallback={userInitials}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 truncate">
                {note.user.name || note.user.username}
              </span>
              <span className="text-sm text-gray-500 truncate">
                @{note.user.username}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {new Date(note.createdAt).toLocaleString()}
            </div>
          </div>
          {/* Follow button (only show if not own post and logged in) */}
          {currentUser && currentUser.id !== note.user.id && (
            <Button
              variant={isFollowing ? 'secondary' : 'primary'}
              size="sm"
              onPress={handleFollow}
              className={`${
                isFollowing
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              {isFollowing ? <Trans>Following</Trans> : <Trans>Follow</Trans>}
            </Button>
          )}
        </div>

        {/* Renote Indicator */}
        {note.renote && (
          <div className="mb-2 text-sm text-gray-600">
            <Trans>Renoted</Trans>
          </div>
        )}

        {/* Content Warning */}
        {note.cw && !showCw && (
          <div className="mb-3">
            <div className="rounded-md bg-yellow-50 p-3">
              <div className="text-sm font-medium text-yellow-800">
                <Trans>Content Warning</Trans>: {note.cw}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowCw(true)}
                className="mt-2"
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
              <div className="mb-3 whitespace-pre-wrap wrap-break-word text-gray-900">
                {note.text}
              </div>
            )}

            {/* Attachments */}
            {note.files && note.files.length > 0 && (
              <div className={`mb-3 grid gap-2 ${
                note.files.length === 1
                  ? 'grid-cols-1'
                  : note.files.length === 2
                  ? 'grid-cols-2'
                  : note.files.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-2'
              }`}>
                {note.files.map((file: NoteFile) => (
                  <div key={file.id} className="relative overflow-hidden rounded-lg">
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Renoted Note */}
            {note.renote && (
              <div className="mb-3 rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Avatar
                    src={note.renote.user.avatarUrl}
                    alt={note.renote.user.name || note.renote.user.username}
                    size="sm"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {note.renote.user.name || note.renote.user.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    @{note.renote.user.username}
                  </span>
                </div>
                {note.renote.text && (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap wrap-break-word">
                    {note.renote.text}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Interaction Buttons */}
        <div className="flex items-center gap-4 border-t border-gray-100 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setShowReplyComposer(!showReplyComposer)}
            className="text-gray-600 hover:text-primary-600"
          >
            💬 {note.repliesCount || 0}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onPress={handleRenote}
            className="text-gray-600 hover:text-green-600"
          >
            🔁 {note.renoteCount || 0}
          </Button>
          <ReactionButton
            onReactionSelect={handleReaction}
            selectedReactions={myReactions}
            isDisabled={isReacting}
          />
          {note.reactions && Object.keys(note.reactions).length > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              {Object.entries(note.reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  disabled={isReacting}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded-full
                    transition-all hover:bg-gray-100
                    ${myReactions.includes(emoji) ? 'bg-primary-100 ring-1 ring-primary-500' : 'bg-gray-50'}
                  `}
                >
                  <span>{emoji}</span>
                  <span className="text-xs font-medium">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reply Composer */}
        {showReplyComposer && currentUser && (
          <div className="mt-4 pt-4 border-t border-gray-100">
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
      </CardContent>
    </Card>
  );
}
