import type { Notification, NotificationType } from "../../db/schema/pg.js";

/**
 * Notification Repository Interface
 *
 * Manages user notifications for various events like follows, reactions,
 * mentions, replies, renotes, and moderation warnings.
 */
export interface INotificationRepository {
  /**
   * Create a new notification
   *
   * @param data - Notification data
   * @returns Created notification record
   */
  create(data: {
    userId: string;
    type: NotificationType;
    notifierId?: string;
    noteId?: string;
    reaction?: string;
    warningId?: string;
  }): Promise<Notification>;

  /**
   * Find a notification by ID
   *
   * @param id - Notification ID
   * @returns Notification record if found, null otherwise
   */
  findById(id: string): Promise<Notification | null>;

  /**
   * Find notifications for a user with pagination
   *
   * @param userId - User ID
   * @param options - Query options
   * @returns Array of notification records
   */
  findByUserId(
    userId: string,
    options?: {
      limit?: number;
      sinceId?: string;
      untilId?: string;
      types?: NotificationType[];
      unreadOnly?: boolean;
    },
  ): Promise<Notification[]>;

  /**
   * Find unread notifications for a user
   *
   * @param userId - User ID
   * @param limit - Maximum number of notifications to return
   * @returns Array of unread notification records
   */
  findUnreadByUserId(userId: string, limit?: number): Promise<Notification[]>;

  /**
   * Mark a notification as read
   *
   * @param id - Notification ID
   * @returns Updated notification record if found, null otherwise
   */
  markAsRead(id: string): Promise<Notification | null>;

  /**
   * Mark all notifications for a user as read
   *
   * @param userId - User ID
   * @returns Number of notifications marked as read
   */
  markAllAsReadByUserId(userId: string): Promise<number>;

  /**
   * Mark notifications as read up to a specific notification
   *
   * @param userId - User ID
   * @param untilId - Notification ID to mark as read up to
   * @returns Number of notifications marked as read
   */
  markAsReadUntil(userId: string, untilId: string): Promise<number>;

  /**
   * Count unread notifications for a user
   *
   * @param userId - User ID
   * @returns Number of unread notifications
   */
  countUnreadByUserId(userId: string): Promise<number>;

  /**
   * Count notifications for a user
   *
   * @param userId - User ID
   * @param options - Query options
   * @returns Number of notifications
   */
  countByUserId(
    userId: string,
    options?: { types?: NotificationType[]; unreadOnly?: boolean },
  ): Promise<number>;

  /**
   * Delete a notification
   *
   * @param id - Notification ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Delete all notifications for a user
   *
   * @param userId - User ID
   * @returns Number of notifications deleted
   */
  deleteAllByUserId(userId: string): Promise<number>;

  /**
   * Delete notifications older than a specific date
   *
   * @param userId - User ID
   * @param before - Date before which to delete notifications
   * @returns Number of notifications deleted
   */
  deleteOlderThan(userId: string, before: Date): Promise<number>;

  /**
   * Check if a similar notification already exists
   * Used to prevent duplicate notifications
   *
   * @param userId - User ID
   * @param type - Notification type
   * @param notifierId - Notifier user ID (optional)
   * @param noteId - Note ID (optional)
   * @returns True if exists, false otherwise
   */
  exists(
    userId: string,
    type: NotificationType,
    notifierId?: string,
    noteId?: string,
  ): Promise<boolean>;
}
