"use client";

/**
 * List Member Card Component
 *
 * Displays a list member with their user info and membership settings.
 * Used in the list members modal.
 *
 * @module components/list/ListMemberCard
 */

import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { MessageCircle, Trash2, Loader2 } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { SpaLink } from "../ui/SpaLink";
import { Button } from "../ui/Button";
import { Switch } from "../ui/Switch";
import { UserDisplayName } from "../user/UserDisplayName";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";
import { listsApi } from "../../lib/api/lists";
import { useAtom } from "jotai";
import { addToastAtom } from "../../lib/atoms/toast";
import type { ListMembership } from "shared";

/**
 * Props for ListMemberCard component
 */
export interface ListMemberCardProps {
  /** List membership data */
  membership: ListMembership;
  /** List ID */
  listId: string;
  /** Whether the current user is the list owner */
  isOwner?: boolean;
  /** Callback when member is removed */
  onRemoved?: () => void;
  /** Callback when membership is updated */
  onUpdated?: (membership: ListMembership) => void;
  /** Callback to close parent modal (for navigation) */
  onClose?: () => void;
}

/**
 * List Member Card Component
 *
 * Features:
 * - User avatar, display name, and handle
 * - "Include replies" toggle for list owner
 * - Remove button for list owner
 * - Click to navigate to user profile
 *
 * @example
 * ```tsx
 * <ListMemberCard
 *   membership={member}
 *   listId={list.id}
 *   isOwner={true}
 *   onRemoved={() => refetchMembers()}
 *   onUpdated={(m) => updateMember(m)}
 *   onClose={closeModal}
 * />
 * ```
 */
export function ListMemberCard({
  membership,
  listId,
  isOwner,
  onRemoved,
  onUpdated,
  onClose,
}: ListMemberCardProps) {
  const [, addToast] = useAtom(addToastAtom);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const user = membership.user;
  if (!user) {
    return null;
  }

  const displayName = user.displayName || user.username;
  const handle = user.host ? `@${user.username}@${user.host}` : `@${user.username}`;
  const profileUrl = user.host ? `/@${user.username}@${user.host}` : `/@${user.username}`;

  // Handle remove member
  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsRemoving(true);
    try {
      await listsApi.pull(listId, membership.userId);
      addToast({
        type: "success",
        message: "Member removed from list",
      });
      onRemoved?.();
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to remove member",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle toggle withReplies
  const handleToggleReplies = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      const updated = await listsApi.updateMembership(listId, membership.userId, checked);
      addToast({
        type: "success",
        message: checked ? "Replies will be included" : "Replies will be excluded",
      });
      onUpdated?.({ ...membership, ...updated });
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update settings",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-(--bg-secondary) transition-colors rounded-lg group">
      {/* User info - clickable */}
      <SpaLink
        to={profileUrl}
        onClick={onClose}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <Avatar
          src={user.avatarUrl ? getProxiedImageUrl(user.avatarUrl) : undefined}
          alt={displayName}
          fallback={displayName.charAt(0).toUpperCase()}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-(--text-primary) truncate">
            <UserDisplayName
              name={user.displayName}
              username={user.username}
            />
          </p>
          <p className="text-sm text-(--text-muted) truncate">{handle}</p>
        </div>
      </SpaLink>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Include replies toggle */}
          <label
            className="flex items-center gap-2 cursor-pointer text-xs text-(--text-muted)"
            title={membership.withReplies ? "Replies included in timeline" : "Replies excluded from timeline"}
          >
            <MessageCircle className={`w-4 h-4 ${membership.withReplies ? "text-primary-500" : "text-(--text-muted)"}`} />
            <span className="hidden sm:inline">
              <Trans>Replies</Trans>
            </span>
            <Switch
              isSelected={membership.withReplies}
              onChange={handleToggleReplies}
              isDisabled={isUpdating}
              aria-label="Include replies in list timeline"
            />
          </label>

          {/* Remove button */}
          <Button
            variant="ghost"
            size="sm"
            onPress={handleRemove as any}
            isDisabled={isRemoving}
            aria-label="Remove from list"
            className="p-1.5 text-(--text-muted) hover:text-red-500"
          >
            {isRemoving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
