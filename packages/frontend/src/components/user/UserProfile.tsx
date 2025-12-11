"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { usersApi, type User } from "../../lib/api/users";
import { notesApi } from "../../lib/api/notes";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient, ApiError } from "../../lib/api/client";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";
import { Flag, QrCode } from "lucide-react";
import { Button } from "../ui/Button";
import { NoteCard } from "../note/NoteCard";
import { MfmRenderer } from "../mfm/MfmRenderer";
import { UserDisplayName, useProfileEmojiMap } from "./UserDisplayName";
import { Spinner } from "../ui/Spinner";
import { ErrorMessage } from "../ui/ErrorMessage";
import { TimelineSkeleton } from "../ui/Skeleton";
import { Layout } from "../layout/Layout";
import { ReportDialog } from "../report/ReportDialog";
import { RoleBadgeList } from "./RoleBadge";
import { FollowListModal } from "./FollowListModal";
import { UserQRCodeModal } from "./UserQRCodeModal";
import { useRouter } from "../ui/SpaLink";

/**
 * Public role type returned from the API
 */
interface PublicRole {
  id: string;
  name: string;
  color: string | null;
  iconUrl: string | null;
}

/**
 * Sanitize and scope user custom CSS to prevent XSS and global style leakage
 * Only allows safe CSS properties within the profile container
 */
function sanitizeCustomCss(css: string, containerId: string): string {
  if (!css || typeof css !== "string") return "";

  // Remove potentially dangerous content
  let sanitized = css
    // Remove JavaScript expressions
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/behavior\s*:/gi, "")
    .replace(/-moz-binding\s*:/gi, "")
    // Remove url() calls that could load external resources (except data: and https:)
    .replace(/url\s*\(\s*(['"]?)(?!data:|https:)/gi, "url($1blocked:")
    // Remove @import to prevent loading external stylesheets
    .replace(/@import/gi, "/* @import blocked */")
    // Remove @font-face to prevent loading external fonts
    .replace(/@font-face/gi, "/* @font-face blocked */")
    // Remove position:fixed/absolute that could overlay UI
    .replace(/position\s*:\s*(fixed|absolute)/gi, "position: relative");

  // Scope all rules to the container
  // This is a simple approach - prepend container ID to each selector
  const scopedCss = sanitized
    .split("}")
    .map((rule) => {
      if (!rule.trim()) return "";
      const parts = rule.split("{");
      if (parts.length !== 2) return "";
      const selector = parts[0]?.trim();
      const declarations = parts[1]?.trim();
      if (!selector || !declarations) return "";

      // Scope the selector to the container
      const scopedSelectors = selector
        .split(",")
        .map((s) => `#${containerId} ${s.trim()}`)
        .join(", ");

      return `${scopedSelectors} { ${declarations} }`;
    })
    .join("\n");

  return scopedCss;
}

/**
 * Props for the UserProfile component
 */
export interface UserProfileProps {
  /** Username to display */
  username: string;
  /** Host for remote users (optional) */
  host?: string | null;
}

/**
 * User profile component
 * Displays user information, stats, and their notes
 */
export function UserProfile({ username, host }: UserProfileProps) {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [publicRoles, setPublicRoles] = useState<PublicRole[]>([]);
  const [showFollowList, setShowFollowList] = useState<"followers" | "following" | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);

  // Generate unique ID for custom CSS scoping
  const profileContainerId = useId().replace(/:/g, "-");

  // Set API token and load current user session
  useEffect(() => {
    if (token) {
      apiClient.setToken(token);
    }

    // Load current user if not already loaded
    const loadCurrentUser = async () => {
      if (token && !currentUser) {
        try {
          const response = await apiClient.get<{ user: User }>("/api/auth/session");
          setCurrentUser(response.user);
        } catch (err) {
          console.error("Failed to load current user session:", err);
        }
      }
    };

    loadCurrentUser();
  }, [token, currentUser, setCurrentUser]);

  // Load user data (after token is set)
  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsNotFound(false);
        const userData = await usersApi.getByUsername(username, host);
        setUser(userData);
        setIsFollowing(userData.isFollowed ?? false);
      } catch (err) {
        // Check if it's a 404 error
        if (err instanceof ApiError && err.statusCode === 404) {
          setIsNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load user");
        }
      } finally {
        setLoading(false);
      }
    };

    // Wait a tick for token to be set in apiClient
    const timeoutId = setTimeout(loadUser, 0);
    return () => clearTimeout(timeoutId);
  }, [username, host, token]);

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
        console.error("Failed to load notes:", err);
      } finally {
        setNotesLoading(false);
      }
    };

    loadNotes();
  }, [user]);

  // Load user's public roles
  useEffect(() => {
    const loadPublicRoles = async () => {
      if (!user) return;

      try {
        const response = await apiClient.get<{ roles: PublicRole[] }>(
          `/api/users/${user.id}/public-roles`,
        );
        setPublicRoles(response.roles);
      } catch (err) {
        // Non-critical - just log and continue
        console.error("Failed to load public roles:", err);
      }
    };

    loadPublicRoles();
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
      console.error("Failed to load more notes:", err);
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
            : null,
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
            : null,
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Failed to toggle follow:", errorMessage);

      // If "Already following" error, sync the state
      if (errorMessage.includes("Already following")) {
        setIsFollowing(true);
      }
      // If "Not following" error on unfollow, sync the state
      if (errorMessage.includes("Not following") || errorMessage.includes("not found")) {
        setIsFollowing(false);
      }
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

  // Convert profileEmojis array to emoji map for MfmRenderer (used for bio)
  // Must be called before any early returns to maintain hook order
  const profileEmojiMap = useProfileEmojiMap(user?.profileEmojis);

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

  // 404 Not Found state - user doesn't exist
  if (isNotFound) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          {/* Status Code */}
          <div className="mb-6">
            <span className="text-8xl md:text-9xl font-bold text-primary-500/20">404</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-(--text-primary) mb-4 text-center">
            <Trans>User Not Found</Trans>
          </h1>

          {/* Description */}
          <p className="text-lg text-(--text-secondary) mb-8 text-center max-w-md">
            <Trans>The user @{username} doesn't exist or may have been deleted.</Trans>
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="secondary"
              onPress={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                } else {
                  router.push("/");
                }
              }}
            >
              <Trans>Go Back</Trans>
            </Button>
            <Button variant="primary" onPress={() => router.push("/")}>
              <Trans>Go Home</Trans>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state (other errors)
  if (error || !user) {
    return (
      <Layout>
        <ErrorMessage
          title={<Trans>Error loading user profile</Trans>}
          message={error || <Trans>User not found</Trans>}
          onRetry={handleRetry}
          variant="error"
        />
      </Layout>
    );
  }

  const isOwnProfile = currentUser?.id === user.id;

  // Get sanitized custom CSS for the profile
  const customCss = user.customCss ? sanitizeCustomCss(user.customCss, profileContainerId) : "";

  return (
    <Layout>
      {/* User Custom CSS */}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

      {/* Profile Container with ID for CSS scoping */}
      <div id={profileContainerId} className="user-profile-container">
        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          {/* Banner */}
          {user.bannerUrl && (
            <div className="h-32 sm:h-48 bg-linear-to-r from-primary-500 to-primary-600">
              <img
                src={getProxiedImageUrl(user.bannerUrl) || ""}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {!user.bannerUrl && (
            <div className="h-32 sm:h-48 bg-linear-to-r from-primary-500 to-primary-600" />
          )}

          {/* Profile Info */}
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Avatar */}
              <div className="-mt-12 sm:-mt-16">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  {user.avatarUrl && (
                    <img
                      src={getProxiedImageUrl(user.avatarUrl) || ""}
                      alt={user.username}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {!user.avatarUrl && (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500 dark:text-gray-400">
                      {user.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex-1 flex justify-end gap-1 sm:gap-2 flex-wrap">
                {isOwnProfile ? (
                  <>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        router.push("/settings");
                      }}
                    >
                      <Trans>Edit Profile</Trans>
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() => setShowQRCode(true)}
                      aria-label="Show QR Code"
                      className="text-gray-500 dark:text-gray-400"
                    >
                      <QrCode className="w-5 h-5" />
                    </Button>
                  </>
                ) : currentUser ? (
                  <>
                    <Button
                      variant={isFollowing ? "secondary" : "primary"}
                      onPress={handleFollowToggle}
                      isDisabled={followLoading}
                    >
                      {followLoading ? (
                        <div className="flex items-center gap-2">
                          <Spinner size="xs" variant="white" />
                          <span>
                            {isFollowing ? (
                              <Trans>Unfollowing...</Trans>
                            ) : (
                              <Trans>Following...</Trans>
                            )}
                          </span>
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
                      className="text-gray-500 dark:text-gray-400 hover:text-red-500"
                    >
                      <Flag className="w-5 h-5" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {/* User Info */}
            <div className="mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                  <UserDisplayName
                    name={user.displayName}
                    username={user.username}
                    profileEmojis={user.profileEmojis}
                  />
                </h1>
                {user.isBot && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                    <Trans>Bot</Trans>
                  </span>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400">@{user.username}</p>
              {/* Public Role Badges */}
              {publicRoles.length > 0 && (
                <div className="mt-2">
                  <RoleBadgeList roles={publicRoles} size="sm" />
                </div>
              )}
            </div>

            {/* Bio */}
            {user.bio && (
              <div className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-wrap profile-bio">
                <MfmRenderer text={user.bio} customEmojis={profileEmojiMap} />
              </div>
            )}

            {/* Stats */}
            <div className="mt-4 flex items-center gap-4 sm:gap-6 text-sm flex-wrap">
              <div>
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {user.notesCount ?? 0}
                </span>{" "}
                <span className="text-gray-600 dark:text-gray-400">
                  <Trans>Posts</Trans>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFollowList("followers")}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 -mx-2 -my-1 rounded transition-colors"
              >
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {user.followersCount ?? 0}
                </span>{" "}
                <span className="text-gray-600 dark:text-gray-400">
                  <Trans>Followers</Trans>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowFollowList("following")}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 -mx-2 -my-1 rounded transition-colors"
              >
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {user.followingCount ?? 0}
                </span>{" "}
                <span className="text-gray-600 dark:text-gray-400">
                  <Trans>Following</Trans>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* User's Notes */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            <Trans>Posts</Trans>
          </h2>

          {/* Loading state */}
          {notesLoading && <TimelineSkeleton count={3} />}

          {/* Notes list */}
          {!notesLoading &&
            notes.map((note) => (
              <NoteCard key={note.id} note={note} onDelete={() => handleNoteDelete(note.id)} />
            ))}

          {/* Empty state */}
          {!notesLoading && notes.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                <Trans>No posts yet</Trans>
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
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
            <div className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
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

      {/* Followers/Following List Modal */}
      <FollowListModal
        isOpen={showFollowList !== null}
        onClose={() => setShowFollowList(null)}
        userId={user.id}
        type={showFollowList || "followers"}
        username={user.username}
      />

      {/* QR Code Modal */}
      <UserQRCodeModal
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        user={user}
      />
    </Layout>
  );
}
