"use client";

/**
 * Notification item component
 *
 * Displays a single notification with appropriate icon and content
 */

import { Trans } from "@lingui/react/macro";
import {
  UserPlus,
  AtSign,
  MessageSquare,
  Heart,
  Repeat2,
  AlertTriangle,
  UserCheck,
  Quote,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import type { Notification, NotificationType } from "../../lib/types/notification";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "follow":
      return <UserPlus className="w-5 h-5 text-blue-500" />;
    case "mention":
      return <AtSign className="w-5 h-5 text-green-500" />;
    case "reply":
      return <MessageSquare className="w-5 h-5 text-cyan-500" />;
    case "reaction":
      return <Heart className="w-5 h-5 text-red-500" />;
    case "renote":
      return <Repeat2 className="w-5 h-5 text-emerald-500" />;
    case "quote":
      return <Quote className="w-5 h-5 text-purple-500" />;
    case "warning":
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case "follow_request_accepted":
      return <UserCheck className="w-5 h-5 text-blue-500" />;
    default:
      return null;
  }
}

/**
 * Get notification message based on type
 */
function NotificationMessage({ notification }: { notification: Notification }) {
  const notifierName = notification.notifier?.name || notification.notifier?.username || "Someone";

  switch (notification.type) {
    case "follow":
      return (
        <span>
          <strong>{notifierName}</strong> <Trans>followed you</Trans>
        </span>
      );
    case "mention":
      return (
        <span>
          <strong>{notifierName}</strong> <Trans>mentioned you</Trans>
        </span>
      );
    case "reply":
      return (
        <span>
          <strong>{notifierName}</strong> <Trans>replied to your note</Trans>
        </span>
      );
    case "reaction":
      return (
        <span>
          <strong>{notifierName}</strong> <Trans>reacted with</Trans> {notification.reaction}
        </span>
      );
    case "renote":
      return (
        <span>
          <strong>{notifierName}</strong> <Trans>renoted your note</Trans>
        </span>
      );
    case "quote":
      return (
        <span>
          <strong>{notifierName}</strong> <Trans>quoted your note</Trans>
        </span>
      );
    case "warning":
      return (
        <span className="text-yellow-600">
          <Trans>You received a warning from the moderators</Trans>
        </span>
      );
    case "follow_request_accepted":
      return (
        <span>
          <strong>{notifierName}</strong> <Trans>accepted your follow request</Trans>
        </span>
      );
    default:
      return <Trans>New notification</Trans>;
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString();
}

export function NotificationItem({ notification, onMarkAsRead, onClick }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (onClick) {
      onClick(notification);
    }
  };

  const notifierUsername = notification.notifier?.username || "";
  const notifierHost = notification.notifier?.host;
  const fullUsername = notifierHost
    ? `@${notifierUsername}@${notifierHost}`
    : `@${notifierUsername}`;

  return (
    <div
      className={`flex items-start gap-3 p-4 border-b border-(--border-color) cursor-pointer transition-colors hover:bg-(--bg-secondary) ${
        !notification.isRead ? "bg-(--bg-tertiary)" : ""
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
    >
      {/* Icon */}
      <div className="shrink-0 mt-1">{getNotificationIcon(notification.type)}</div>

      {/* Avatar */}
      {notification.notifier && (
        <div className="shrink-0">
          <Avatar
            src={notification.notifier.avatarUrl}
            alt={notification.notifier.name || notification.notifier.username}
            fallback={notification.notifier.username.slice(0, 2).toUpperCase()}
            size="sm"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-(--text-primary)">
          <NotificationMessage notification={notification} />
        </p>
        {notification.notifier && (
          <p className="text-xs text-(--text-muted) mt-0.5">{fullUsername}</p>
        )}
      </div>

      {/* Time */}
      <div className="shrink-0 text-xs text-(--text-muted)">
        {formatRelativeTime(notification.createdAt)}
      </div>

      {/* Unread indicator */}
      {!notification.isRead && <div className="shrink-0 w-2 h-2 rounded-full bg-primary-500" />}
    </div>
  );
}
