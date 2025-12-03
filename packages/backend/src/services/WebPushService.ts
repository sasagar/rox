/**
 * Web Push Service
 *
 * Handles Web Push API subscriptions and notifications
 * Uses VAPID for authentication with push services
 */

import webpush from "web-push";
import { eq, and } from "drizzle-orm";
import { generateId } from "../../../shared/src/utils/id.js";
import { logger } from "../lib/logger.js";
import type { Database } from "../db/index.js";
import type { PushSubscription, NewPushSubscription, NotificationType } from "../db/schema/pg.js";

/**
 * Push subscription keys from client
 */
export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

/**
 * Push subscription data from client
 */
export interface PushSubscriptionData {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

/**
 * Push notification payload
 */
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    notificationId?: string;
    type?: NotificationType;
  };
}

/**
 * Web Push Service for managing push subscriptions and sending notifications
 */
export class WebPushService {
  private db: Database;
  private vapidConfigured: boolean = false;

  constructor(db: Database) {
    this.db = db;
    this.initializeVapid();
  }

  /**
   * Initialize VAPID configuration
   */
  private initializeVapid(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contactEmail = process.env.VAPID_CONTACT_EMAIL || process.env.ADMIN_EMAIL;

    if (!publicKey || !privateKey) {
      logger.warn("VAPID keys not configured. Web Push notifications will be disabled.");
      return;
    }

    if (!contactEmail) {
      logger.warn("VAPID contact email not configured. Web Push notifications will be disabled.");
      return;
    }

    try {
      webpush.setVapidDetails(
        contactEmail.startsWith("mailto:") ? contactEmail : `mailto:${contactEmail}`,
        publicKey,
        privateKey,
      );
      this.vapidConfigured = true;
      logger.info("Web Push VAPID configured successfully");
    } catch (error) {
      logger.error({ err: error }, "Failed to configure VAPID");
    }
  }

  /**
   * Check if Web Push is available
   */
  isAvailable(): boolean {
    return this.vapidConfigured;
  }

  /**
   * Get VAPID public key for client subscription
   */
  getVapidPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    subscription: PushSubscriptionData,
    userAgent?: string,
  ): Promise<PushSubscription> {
    const { pushSubscriptions } = await import("../db/schema/pg.js");

    // Check if subscription already exists (by endpoint)
    const existing = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    if (existing.length > 0) {
      // Update existing subscription
      const updated = await this.db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .returning();

      logger.info({ userId, endpoint: subscription.endpoint }, "Updated push subscription");
      return updated[0]!;
    }

    // Create new subscription
    const newSubscription: NewPushSubscription = {
      id: generateId(),
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    };

    const [created] = await this.db.insert(pushSubscriptions).values(newSubscription).returning();

    logger.info({ userId, subscriptionId: created!.id }, "Created push subscription");
    return created!;
  }

  /**
   * Unsubscribe a user from push notifications
   */
  async unsubscribe(userId: string, endpoint: string): Promise<boolean> {
    const { pushSubscriptions } = await import("../db/schema/pg.js");

    const result = await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
      .returning();

    if (result.length > 0) {
      logger.info({ userId, endpoint }, "Removed push subscription");
      return true;
    }

    return false;
  }

  /**
   * Get all subscriptions for a user
   */
  async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    const { pushSubscriptions } = await import("../db/schema/pg.js");

    return this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  /**
   * Send push notification to a specific subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    if (!this.vapidConfigured) {
      return false;
    }

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const TIMEOUT_MS = 15000; // 15 seconds

    try {
      console.log("[WebPush] Sending to endpoint:", subscription.endpoint.substring(0, 60) + "...");
      const startTime = Date.now();

      // Use Promise.race to enforce timeout since web-push timeout option may not work in Bun
      const sendPromise = webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Push notification timed out after ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);
      });

      await Promise.race([sendPromise, timeoutPromise]);

      console.log("[WebPush] Success, took", Date.now() - startTime, "ms");
      logger.debug({ subscriptionId: subscription.id }, "Push notification sent");
      return true;
    } catch (error: any) {
      console.log("[WebPush] Error:", error.message, "code:", error.code, "status:", error.statusCode);

      // Handle expired or invalid subscriptions
      if (error.statusCode === 404 || error.statusCode === 410) {
        logger.info(
          { subscriptionId: subscription.id, statusCode: error.statusCode },
          "Removing invalid push subscription",
        );
        await this.removeSubscription(subscription.id);
        return false;
      }

      // Handle timeout errors (both manual and library)
      if (error.code === "ETIMEDOUT" || error.message?.includes("timeout") || error.message?.includes("timed out")) {
        logger.warn(
          {
            subscriptionId: subscription.id,
            endpoint: subscription.endpoint,
          },
          "Push notification timed out - push service may be unreachable",
        );
        return false;
      }

      // Log detailed error information
      logger.error(
        {
          err: error,
          subscriptionId: subscription.id,
          statusCode: error.statusCode,
          code: error.code,
          message: error.message,
          endpoint: subscription.endpoint,
        },
        "Failed to send push notification",
      );
      return false;
    }
  }

  /**
   * Remove a subscription by ID
   */
  private async removeSubscription(subscriptionId: string): Promise<void> {
    const { pushSubscriptions } = await import("../db/schema/pg.js");

    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscriptionId));
  }

  /**
   * Send push notification to all subscriptions of a user
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<number> {
    if (!this.vapidConfigured) {
      return 0;
    }

    const subscriptions = await this.getSubscriptions(userId);

    if (subscriptions.length === 0) {
      return 0;
    }

    let successCount = 0;
    await Promise.all(
      subscriptions.map(async (subscription) => {
        const success = await this.sendToSubscription(subscription, payload);
        if (success) {
          successCount++;
        }
      }),
    );

    logger.info(
      { userId, total: subscriptions.length, success: successCount },
      "Push notifications sent to user",
    );

    return successCount;
  }

  /**
   * Create notification payload from notification data
   */
  createPayload(
    type: NotificationType,
    notifierName: string | null,
    notificationId: string,
    noteId?: string | null,
  ): PushNotificationPayload {
    const baseUrl = process.env.URL || "http://localhost:3000";
    let title: string;
    let body: string;
    let url: string;

    switch (type) {
      case "follow":
        title = "New Follower";
        body = `${notifierName || "Someone"} followed you`;
        url = notifierName ? `${baseUrl}/@${notifierName}` : `${baseUrl}/notifications`;
        break;
      case "mention":
        title = "New Mention";
        body = `${notifierName || "Someone"} mentioned you`;
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "reply":
        title = "New Reply";
        body = `${notifierName || "Someone"} replied to your note`;
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "reaction":
        title = "New Reaction";
        body = `${notifierName || "Someone"} reacted to your note`;
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "renote":
        title = "New Renote";
        body = `${notifierName || "Someone"} renoted your note`;
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "quote":
        title = "New Quote";
        body = `${notifierName || "Someone"} quoted your note`;
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "warning":
        title = "Moderator Warning";
        body = "You have received a warning from the moderators";
        url = `${baseUrl}/notifications`;
        break;
      case "follow_request_accepted":
        title = "Follow Request Accepted";
        body = `${notifierName || "Someone"} accepted your follow request`;
        url = notifierName ? `${baseUrl}/@${notifierName}` : `${baseUrl}/notifications`;
        break;
      default:
        title = "New Notification";
        body = "You have a new notification";
        url = `${baseUrl}/notifications`;
    }

    return {
      title,
      body,
      icon: `${baseUrl}/icon-192.png`,
      badge: `${baseUrl}/badge-72.png`,
      tag: `notification-${notificationId}`,
      data: {
        url,
        notificationId,
        type,
      },
    };
  }
}
