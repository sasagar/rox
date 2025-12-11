/**
 * Notification Service
 *
 * Handles notification creation, retrieval, and management.
 * Provides methods for various notification types (follow, reaction, mention, etc.)
 *
 * @module services/NotificationService
 */

import type { Notification, NotificationType } from "../db/schema/pg.js";
import type { INotificationRepository } from "../interfaces/repositories/INotificationRepository.js";
import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import { getNotificationStreamService } from "./NotificationStreamService.js";
import type { WebPushService } from "./WebPushService.js";
import { logger } from "../lib/logger.js";

/**
 * Profile emoji for MFM rendering
 */
export interface ProfileEmoji {
  name: string;
  url: string;
}

/**
 * Notification with populated user data
 */
export interface NotificationWithUser extends Notification {
  notifier?: {
    id: string;
    username: string;
    host: string | null;
    name: string | null;
    avatarUrl: string | null;
    profileEmojis?: ProfileEmoji[] | null;
  } | null;
}

export class NotificationService {
  private webPushService?: WebPushService;

  constructor(
    private notificationRepository: INotificationRepository,
    private userRepository: IUserRepository,
  ) {}

  /**
   * Set the WebPushService for sending push notifications
   * This is set after construction to avoid circular dependencies
   */
  setWebPushService(webPushService: WebPushService): void {
    this.webPushService = webPushService;
  }

  /**
   * Create a follow notification
   *
   * @param followeeId - User who was followed
   * @param followerId - User who followed
   */
  async createFollowNotification(
    followeeId: string,
    followerId: string,
  ): Promise<Notification | null> {
    // Don't notify yourself
    if (followeeId === followerId) {
      return null;
    }

    // Check if notification already exists
    const exists = await this.notificationRepository.exists(followeeId, "follow", followerId);

    if (exists) {
      return null;
    }

    const notification = await this.notificationRepository.create({
      userId: followeeId,
      type: "follow",
      notifierId: followerId,
    });

    // Push to stream for real-time delivery
    await this.pushToStream(notification);

    return notification;
  }

  /**
   * Create a mention notification
   *
   * @param mentionedUserId - User who was mentioned
   * @param authorId - User who mentioned
   * @param noteId - Note containing the mention
   */
  async createMentionNotification(
    mentionedUserId: string,
    authorId: string,
    noteId: string,
  ): Promise<Notification | null> {
    // Don't notify yourself
    if (mentionedUserId === authorId) {
      return null;
    }

    const notification = await this.notificationRepository.create({
      userId: mentionedUserId,
      type: "mention",
      notifierId: authorId,
      noteId,
    });

    await this.pushToStream(notification);
    return notification;
  }

  /**
   * Create a reply notification
   *
   * @param replyToUserId - User who received the reply
   * @param authorId - User who replied
   * @param noteId - Reply note ID
   */
  async createReplyNotification(
    replyToUserId: string,
    authorId: string,
    noteId: string,
  ): Promise<Notification | null> {
    // Don't notify yourself
    if (replyToUserId === authorId) {
      return null;
    }

    const notification = await this.notificationRepository.create({
      userId: replyToUserId,
      type: "reply",
      notifierId: authorId,
      noteId,
    });

    await this.pushToStream(notification);
    return notification;
  }

  /**
   * Create a reaction notification
   *
   * @param noteAuthorId - User who authored the note
   * @param reactorId - User who reacted
   * @param noteId - Note that was reacted to
   * @param reaction - Reaction emoji
   */
  async createReactionNotification(
    noteAuthorId: string,
    reactorId: string,
    noteId: string,
    reaction: string,
  ): Promise<Notification | null> {
    // Don't notify yourself
    if (noteAuthorId === reactorId) {
      return null;
    }

    // Check if same reaction notification already exists
    const exists = await this.notificationRepository.exists(
      noteAuthorId,
      "reaction",
      reactorId,
      noteId,
    );

    if (exists) {
      return null;
    }

    const notification = await this.notificationRepository.create({
      userId: noteAuthorId,
      type: "reaction",
      notifierId: reactorId,
      noteId,
      reaction,
    });

    await this.pushToStream(notification);
    return notification;
  }

  /**
   * Create a renote notification
   *
   * @param noteAuthorId - User who authored the original note
   * @param renoterId - User who renoted
   * @param renoteId - Renote note ID
   */
  async createRenoteNotification(
    noteAuthorId: string,
    renoterId: string,
    renoteId: string,
  ): Promise<Notification | null> {
    // Don't notify yourself
    if (noteAuthorId === renoterId) {
      return null;
    }

    const notification = await this.notificationRepository.create({
      userId: noteAuthorId,
      type: "renote",
      notifierId: renoterId,
      noteId: renoteId,
    });

    await this.pushToStream(notification);
    return notification;
  }

  /**
   * Create a quote notification
   *
   * @param noteAuthorId - User who authored the quoted note
   * @param quoterId - User who quoted
   * @param quoteNoteId - Quote note ID
   */
  async createQuoteNotification(
    noteAuthorId: string,
    quoterId: string,
    quoteNoteId: string,
  ): Promise<Notification | null> {
    // Don't notify yourself
    if (noteAuthorId === quoterId) {
      return null;
    }

    const notification = await this.notificationRepository.create({
      userId: noteAuthorId,
      type: "quote",
      notifierId: quoterId,
      noteId: quoteNoteId,
    });

    await this.pushToStream(notification);
    return notification;
  }

  /**
   * Create a warning notification
   *
   * @param userId - User who received the warning
   * @param warningId - Warning ID
   */
  async createWarningNotification(userId: string, warningId: string): Promise<Notification> {
    const notification = await this.notificationRepository.create({
      userId,
      type: "warning",
      warningId,
    });

    await this.pushToStream(notification);
    return notification;
  }

  /**
   * Create a follow request accepted notification
   *
   * @param followerId - User whose follow request was accepted
   * @param followeeId - User who accepted the request
   */
  async createFollowRequestAcceptedNotification(
    followerId: string,
    followeeId: string,
  ): Promise<Notification | null> {
    // Don't notify yourself
    if (followerId === followeeId) {
      return null;
    }

    const notification = await this.notificationRepository.create({
      userId: followerId,
      type: "follow_request_accepted",
      notifierId: followeeId,
    });

    await this.pushToStream(notification);
    return notification;
  }

  /**
   * Create a direct message notification
   *
   * @param recipientId - User who received the DM
   * @param senderId - User who sent the DM
   * @param noteId - DM note ID
   */
  async createDMNotification(
    recipientId: string,
    senderId: string,
    noteId: string,
  ): Promise<Notification | null> {
    // Don't notify yourself
    if (recipientId === senderId) {
      return null;
    }

    const notification = await this.notificationRepository.create({
      userId: recipientId,
      type: "dm",
      notifierId: senderId,
      noteId,
    });

    await this.pushToStream(notification);
    return notification;
  }

  /**
   * Get notifications for a user with populated user data
   *
   * @param userId - User ID
   * @param options - Query options
   * @returns Array of notifications with user data
   */
  async getNotifications(
    userId: string,
    options?: {
      limit?: number;
      sinceId?: string;
      untilId?: string;
      types?: NotificationType[];
      unreadOnly?: boolean;
    },
  ): Promise<NotificationWithUser[]> {
    const notifications = await this.notificationRepository.findByUserId(userId, options);

    // Populate notifier data
    const notifierIds = [
      ...new Set(notifications.map((n) => n.notifierId).filter((id): id is string => id !== null)),
    ];

    const notifiers = await Promise.all(notifierIds.map((id) => this.userRepository.findById(id)));

    const notifierMap = new Map(
      notifiers
        .filter((u): u is NonNullable<typeof u> => u !== null)
        .map((u) => [
          u.id,
          {
            id: u.id,
            username: u.username,
            host: u.host,
            name: u.displayName,
            avatarUrl: u.avatarUrl,
            profileEmojis: u.profileEmojis,
          },
        ]),
    );

    return notifications.map((notification) => ({
      ...notification,
      notifier: notification.notifierId ? (notifierMap.get(notification.notifierId) ?? null) : null,
    }));
  }

  /**
   * Get unread notification count
   *
   * @param userId - User ID
   * @returns Number of unread notifications
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnreadByUserId(userId);
  }

  /**
   * Mark a notification as read
   *
   * @param notificationId - Notification ID
   * @param userId - User ID (for authorization)
   * @returns Updated notification or null
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification || notification.userId !== userId) {
      return null;
    }

    return this.notificationRepository.markAsRead(notificationId);
  }

  /**
   * Mark all notifications as read
   *
   * @param userId - User ID
   * @returns Number of notifications marked as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    return this.notificationRepository.markAllAsReadByUserId(userId);
  }

  /**
   * Mark notifications as read up to a specific notification
   *
   * @param userId - User ID
   * @param untilId - Notification ID
   * @returns Number of notifications marked as read
   */
  async markAsReadUntil(userId: string, untilId: string): Promise<number> {
    return this.notificationRepository.markAsReadUntil(userId, untilId);
  }

  /**
   * Delete a notification
   *
   * @param notificationId - Notification ID
   * @param userId - User ID (for authorization)
   * @returns True if deleted, false otherwise
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification || notification.userId !== userId) {
      return false;
    }

    return this.notificationRepository.delete(notificationId);
  }

  /**
   * Delete all notifications for a user
   *
   * @param userId - User ID
   * @returns Number of notifications deleted
   */
  async deleteAllNotifications(userId: string): Promise<number> {
    return this.notificationRepository.deleteAllByUserId(userId);
  }

  /**
   * Push notification to stream for real-time delivery
   *
   * @param notification - Notification to push
   * @private
   */
  private async pushToStream(notification: Notification): Promise<void> {
    try {
      const streamService = getNotificationStreamService();

      // Get notifier data for the notification
      let notifier = null;
      let notifierName: string | null = null;
      if (notification.notifierId) {
        const user = await this.userRepository.findById(notification.notifierId);
        if (user) {
          notifier = {
            id: user.id,
            username: user.username,
            host: user.host,
            name: user.displayName,
            avatarUrl: user.avatarUrl,
            profileEmojis: user.profileEmojis,
          };
          notifierName = user.displayName || user.username;
        }
      }

      // Push notification with user data via SSE
      streamService.pushNotification(notification.userId, {
        ...notification,
        notifier,
      });

      // Also push updated unread count
      const unreadCount = await this.notificationRepository.countUnreadByUserId(
        notification.userId,
      );
      streamService.pushUnreadCount(notification.userId, unreadCount);

      // Send Web Push notification if available (with localization support)
      if (this.webPushService?.isAvailable()) {
        try {
          await this.webPushService.sendToUserWithLocalization(
            notification.userId,
            notification.type,
            notifierName,
            notification.id,
            notification.noteId,
          );
        } catch (pushError) {
          logger.error({ err: pushError }, "Failed to send web push notification");
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to push notification to stream");
    }
  }
}
