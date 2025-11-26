'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { useAtom } from 'jotai';
import { Trans } from '@lingui/react/macro';
import { usersApi, type User } from '../../lib/api/users';
import { notesApi } from '../../lib/api/notes';
import { currentUserAtom, tokenAtom } from '../../lib/atoms/auth';
import { apiClient } from '../../lib/api/client';
import { Flag } from 'lucide-react';
import { Button } from '../ui/Button';
import { NoteCard } from '../note/NoteCard';
import { Spinner } from '../ui/Spinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { TimelineSkeleton } from '../ui/Skeleton';
import { Layout } from '../layout/Layout';
import { ReportDialog } from '../report/ReportDialog';

/**
 * Sanitize and scope user custom CSS to prevent XSS and global style leakage
 * Only allows safe CSS properties within the profile container
 */
function sanitizeCustomCss(css: string, containerId: string): string {
  if (!css || typeof css !== 'string') return '';

  // Remove potentially dangerous content
  let sanitized = css
    // Remove JavaScript expressions
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/behavior\s*:/gi, '')
    .replace(/-moz-binding\s*:/gi, '')
    // Remove url() calls that could load external resources (except data: and https:)
    .replace(/url\s*\(\s*(['"]?)(?!data:|https:)/gi, 'url($1blocked:')
    // Remove @import to prevent loading external stylesheets
    .replace(/@import/gi, '/* @import blocked */')
    // Remove @font-face to prevent loading external fonts
    .replace(/@font-face/gi, '/* @font-face blocked */')
    // Remove position:fixed/absolute that could overlay UI
    .replace(/position\s*:\s*(fixed|absolute)/gi, 'position: relative');

  // Scope all rules to the container
  // This is a simple approach - prepend container ID to each selector
  const scopedCss = sanitized
    .split('}')
    .map(rule => {
      if (!rule.trim()) return '';
      const parts = rule.split('{');
      if (parts.length !== 2) return '';
      const selector = parts[0]?.trim();
      const declarations = parts[1]?.trim();
      if (!selector || !declarations) return '';

      // Scope the selector to the container
      const scopedSelectors = selector
        .split(',')
        .map(s => `#${containerId} ${s.trim()}`)
        .join(', ');

      return `${scopedSelectors} { ${declarations} }`;
    })
    .join('\n');

  return scopedCss;
}

/**
 * Props for the UserProfile component
 */
export interface UserProfileProps {
  /** Username to display */
  username: string;
}

/**
 * User profile component
 * Displays user information, stats, and their notes
 */
export function UserProfile({ username }: UserProfileProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Generate unique ID for custom CSS scoping
  const profileContainerId = useId().replace(/:/g, '-');

  // Set API token
  useEffect(() => {
    if (token) {
      apiClient.setToken(token);
    }
  }, [token]);

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        setError(null);
        const userData = await usersApi.getByUsername(username);
        setUser(userData);
        setIsFollowing(userData.isFollowed ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [username]);

  // Load user's notes
  useEffect(() => {
    const loadNotes = async () => {
      if (!user) return;

      try {
        setNotesLoading(true);
        const userNotes = await notesApi.getUserNotes(user.id, { limit: 20 });
        setNotes(userNotes);
        setHasMore(userNotes.length >= 20);
      } catch (err) {
        console.error('Failed to load notes:', err);
      } finally {
        setNotesLoading(false);
      }
    };

    loadNotes();
  }, [user]);

  // Load more notes
  const loadMoreNotes = useCallback(async () => {
    if (!user || !hasMore || loadingMore) return;

    try {
      setLoadingMore(true);
      const lastNote = notes[notes.length - 1];
      const moreNotes = await notesApi.getUserNotes(user.id, {
        limit: 20,
        untilId: lastNote?.id,
      });

      if (moreNotes.length === 0) {
        setHasMore(false);
      } else {
        setNotes((prev) => [...prev, ...moreNotes]);
        setHasMore(moreNotes.length >= 20);
      }
    } catch (err) {
      console.error('Failed to load more notes:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [user, notes, hasMore, loadingMore]);

  // Handle follow/unfollow
  const handleFollowToggle = useCallback(async () => {
    if (!user || !currentUser) return;

    try {
      setFollowLoading(true);
      if (isFollowing) {
        await usersApi.unfollow(user.id);
        setIsFollowing(false);
        setUser((prev) =>
          prev
            ? {
                ...prev,
                followersCount: (prev.followersCount ?? 0) - 1,
              }
            : null
        );
      } else {
        await usersApi.follow(user.id);
        setIsFollowing(true);
        setUser((prev) =>
          prev
            ? {
                ...prev,
                followersCount: (prev.followersCount ?? 0) + 1,
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
    } finally {
      setFollowLoading(false);
    }
  }, [user, currentUser, isFollowing]);

  // Retry loading user
  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // Handle note deletion
  const handleNoteDelete = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
    setUser((prev) => (prev ? { ...prev, notesCount: (prev.notesCount ?? 0) - 1 } : null));
  }, []);

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  // Error state
  if (error || !user) {
    return (
      <Layout>
        <ErrorMessage
          title={<Trans>Error loading user profile</Trans> as unknown as string}
          message={error || (<Trans>User not found</Trans> as unknown as string)}
          onRetry={handleRetry}
          variant="error"
        />
      </Layout>
    );
  }

  const isOwnProfile = currentUser?.id === user.id;

  // Get sanitized custom CSS for the profile
  const customCss = user.customCss ? sanitizeCustomCss(user.customCss, profileContainerId) : '';

  return (
    <Layout>
      {/* User Custom CSS */}
      {customCss && (
        <style dangerouslySetInnerHTML={{ __html: customCss }} />
      )}

      {/* Profile Container with ID for CSS scoping */}
      <div id={profileContainerId} className="user-profile-container">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        {/* Banner */}
        {user.bannerUrl && (
          <div className="h-48 bg-linear-to-r from-primary-500 to-primary-600">
            <img src={user.bannerUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {!user.bannerUrl && (
          <div className="h-48 bg-linear-to-r from-primary-500 to-primary-600" />
        )}

        {/* Profile Info */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="-mt-16">
              <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-200 overflow-hidden">
                {user.avatarUrl && (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                )}
                {!user.avatarUrl && (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500">
                    {user.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex-1 flex justify-end gap-2">
              {isOwnProfile ? (
                <Button
                  variant="secondary"
                  onPress={() => {
                    if (typeof window !== 'undefined') {
                      window.location.href = '/settings';
                    }
                  }}
                >
                  <Trans>Edit Profile</Trans>
                </Button>
              ) : currentUser ? (
                <>
                  <Button
                    variant={isFollowing ? 'secondary' : 'primary'}
                    onPress={handleFollowToggle}
                    isDisabled={followLoading}
                  >
                    {followLoading ? (
                      <div className="flex items-center gap-2">
                        <Spinner size="xs" variant="white" />
                        <span>{isFollowing ? <Trans>Unfollowing...</Trans> : <Trans>Following...</Trans>}</span>
                      </div>
                    ) : isFollowing ? (
                      <Trans>Following</Trans>
                    ) : (
                      <Trans>Follow</Trans>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onPress={() => setShowReportDialog(true)}
                    aria-label="Report user"
                    className="text-gray-500 hover:text-red-500"
                  >
                    <Flag className="w-5 h-5" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {/* User Info */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{user.displayName || user.username}</h1>
              {user.isBot && (
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                  <Trans>Bot</Trans>
                </span>
              )}
            </div>
            <p className="text-gray-600">@{user.username}</p>
          </div>

          {/* Bio */}
          {user.bio && <p className="mt-4 text-gray-700 whitespace-pre-wrap">{user.bio}</p>}

          {/* Stats */}
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div>
              <span className="font-bold text-gray-900">{user.notesCount ?? 0}</span>{' '}
              <span className="text-gray-600">
                <Trans>Posts</Trans>
              </span>
            </div>
            <div>
              <span className="font-bold text-gray-900">{user.followersCount ?? 0}</span>{' '}
              <span className="text-gray-600">
                <Trans>Followers</Trans>
              </span>
            </div>
            <div>
              <span className="font-bold text-gray-900">{user.followingCount ?? 0}</span>{' '}
              <span className="text-gray-600">
                <Trans>Following</Trans>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User's Notes */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
          <Trans>Posts</Trans>
        </h2>

        {/* Loading state */}
        {notesLoading && <TimelineSkeleton count={3} />}

        {/* Notes list */}
        {!notesLoading &&
          notes.map((note) => <NoteCard key={note.id} note={note} onDelete={() => handleNoteDelete(note.id)} />)}

        {/* Empty state */}
        {!notesLoading && notes.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              <Trans>No posts yet</Trans>
            </h3>
            <p className="text-gray-600">
              {isOwnProfile ? (
                <Trans>You haven't posted anything yet</Trans>
              ) : (
                <Trans>This user hasn't posted anything yet</Trans>
              )}
            </p>
          </div>
        )}

        {/* Load more button */}
        {!notesLoading && hasMore && notes.length > 0 && (
          <div className="flex justify-center py-4">
            <Button variant="secondary" onPress={loadMoreNotes} isDisabled={loadingMore}>
              {loadingMore ? (
                <div className="flex items-center gap-2">
                  <Spinner size="xs" />
                  <span>
                    <Trans>Loading...</Trans>
                  </span>
                </div>
              ) : (
                <Trans>Load more</Trans>
              )}
            </Button>
          </div>
        )}

        {/* End of posts */}
        {!notesLoading && !hasMore && notes.length > 0 && (
          <div className="py-4 text-center text-gray-500 text-sm">
            <Trans>You've reached the end</Trans>
          </div>
        )}
      </div>
      </div>

      {/* Report Dialog */}
      <ReportDialog
        isOpen={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        targetType="user"
        targetUserId={user.id}
        targetUsername={user.username}
      />
    </Layout>
  );
}
