/**
 * Notification type definitions
 *
 * Types for notifications used in the frontend
 */

/**
 * Notification types enum
 */
export type NotificationType =
  | "follow"
  | "mention"
  | "reply"
  | "reaction"
  | "renote"
  | "warning"
  | "follow_request_accepted"
  | "quote";

/**
 * Notification data structure
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  notifierId: string | null;
  noteId: string | null;
  reaction: string | null;
  warningId: string | null;
  isRead: boolean;
  createdAt: string;
  /** Populated notifier user data */
  notifier?: {
    id: string;
    username: string;
    host: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

/**
 * SSE notification event data
 */
export interface NotificationEvent {
  type: "notification" | "unreadCount" | "connected" | "heartbeat";
  data: unknown;
}

/**
 * Options for fetching notifications
 */
export interface NotificationFetchOptions {
  limit?: number;
  sinceId?: string;
  untilId?: string;
  types?: NotificationType[];
  unreadOnly?: boolean;
}
