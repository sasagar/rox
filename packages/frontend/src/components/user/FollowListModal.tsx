"use client";

/**
 * Follow List Modal Component
 *
 * Modal to display followers or following list for a user
 */

import { useState, useEffect, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import { X, Loader2 } from "lucide-react";
import { usersApi, type User, type Follow } from "../../lib/api/users";
import { Avatar } from "../ui/Avatar";
import { SpaLink } from "../ui/SpaLink";
import { Button } from "../ui/Button";
import { MfmRenderer } from "../mfm/MfmRenderer";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";

/**
 * Props for the FollowListModal component
 */
export interface FollowListModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** User ID to fetch followers/following for */
  userId: string;
  /** Type of list to show */
  type: "followers" | "following";
  /** Username for display in title */
  username: string;
}

/**
 * User card in the follow list
 */
function FollowUserCard({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const displayName = user.displayName || user.name || user.username;
  const handle = user.host ? `@${user.username}@${user.host}` : `@${user.username}`;
  const profileUrl = user.host ? `/@${user.username}@${user.host}` : `/@${user.username}`;

  // Convert profileEmojis array to emoji map for MfmRenderer
  const customEmojis = user.profileEmojis?.reduce(
    (acc, emoji) => {
      acc[emoji.name] = emoji.url;
      return acc;
    },
    {} as Record<string, string>,
  ) ?? {};

  return (
    <SpaLink
      to={profileUrl}
      onClick={onClose}
      className="flex items-center gap-3 p-3 hover:bg-(--bg-secondary) transition-colors rounded-lg"
    >
      <Avatar
        src={user.avatarUrl ? getProxiedImageUrl(user.avatarUrl) : undefined}
        alt={displayName}
        fallback={displayName.charAt(0).toUpperCase()}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-(--text-primary) truncate">
          <MfmRenderer text={displayName} customEmojis={customEmojis} />
        </p>
        <p className="text-sm text-(--text-muted) truncate">{handle}</p>
      </div>
    </SpaLink>
  );
}

/**
 * Modal to display followers or following list
 */
export function FollowListModal({
  isOpen,
  onClose,
  userId,
  type,
  username,
}: FollowListModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const limit = 20;

  // Fetch users
  const fetchUsers = useCallback(async (currentOffset = 0) => {
    if (!isOpen) return;

    try {
      if (currentOffset > 0) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const response =
        type === "followers"
          ? await usersApi.getFollowers(userId, limit, currentOffset)
          : await usersApi.getFollowing(userId, limit, currentOffset);

      // Extract users from follow relationships
      const newUsers = response.map((follow: Follow) =>
        type === "followers" ? follow.follower : follow.followee,
      ).filter((u): u is User => u !== undefined);

      if (currentOffset > 0) {
        setUsers((prev) => [...prev, ...newUsers]);
      } else {
        setUsers(newUsers);
      }

      setHasMore(newUsers.length >= limit);
      setOffset(currentOffset + newUsers.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isOpen, userId, type]);

  // Load on open
  useEffect(() => {
    if (isOpen) {
      setUsers([]);
      setHasMore(true);
      setOffset(0);
      fetchUsers(0);
    }
  }, [isOpen, fetchUsers]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[80vh] bg-(--card-bg) rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-(--border-color)">
          <h2 className="text-lg font-semibold text-(--text-primary)">
            {type === "followers" ? (
              <Trans>{username}'s Followers</Trans>
            ) : (
              <Trans>{username}'s Following</Trans>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-(--bg-secondary) rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-(--text-muted)" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-(--text-muted)" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-(--text-muted)">
              {type === "followers" ? (
                <Trans>No followers yet</Trans>
              ) : (
                <Trans>Not following anyone yet</Trans>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user) => (
                <FollowUserCard key={user.id} user={user} onClose={onClose} />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="secondary"
                    onPress={() => fetchUsers(offset)}
                    isDisabled={loadingMore}
                  >
                    {loadingMore ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <Trans>Loading...</Trans>
                      </div>
                    ) : (
                      <Trans>Load more</Trans>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
