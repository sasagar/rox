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
import type { InstanceSettingsService } from "./InstanceSettingsService.js";

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
  private instanceSettingsService: InstanceSettingsService;
  private vapidConfigured: boolean = false;

  constructor(db: Database, instanceSettingsService: InstanceSettingsService) {
    this.db = db;
    this.instanceSettingsService = instanceSettingsService;
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
      logger.debug("Web Push VAPID configured successfully");
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
    language?: string,
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
          language,
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
      language,
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
   * Uses native fetch instead of web-push's https module for Bun compatibility
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
      logger.debug({ endpoint: subscription.endpoint.substring(0, 60) }, "Sending push notification");
      const startTime = Date.now();

      // Use web-push to generate the encrypted payload and headers
      // but use native fetch for the HTTP request (Bun's https module has issues)
      const requestDetails = webpush.generateRequestDetails(
        pushSubscription,
        JSON.stringify(payload),
      );

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        // Convert Buffer to Uint8Array for fetch compatibility
        const body = requestDetails.body ? new Uint8Array(requestDetails.body) : undefined;

        // Web Push always uses POST method
        const response = await fetch(requestDetails.endpoint, {
          method: "POST",
          headers: requestDetails.headers as Record<string, string>,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 201 || response.status === 200) {
          logger.debug({ subscriptionId: subscription.id, durationMs: Date.now() - startTime }, "Push notification sent");
          return true;
        }

        // Handle error responses
        if (response.status === 404 || response.status === 410) {
          logger.info(
            { subscriptionId: subscription.id, statusCode: response.status },
            "Removing invalid push subscription",
          );
          await this.removeSubscription(subscription.id);
          return false;
        }

        const errorText = await response.text();
        logger.error(
          {
            subscriptionId: subscription.id,
            statusCode: response.status,
            error: errorText.substring(0, 500),
            endpoint: subscription.endpoint,
          },
          "Push notification failed",
        );
        return false;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === "AbortError") {
          logger.warn(
            {
              subscriptionId: subscription.id,
              endpoint: subscription.endpoint,
            },
            "Push notification timed out - push service may be unreachable",
          );
          return false;
        }

        throw fetchError;
      }
    } catch (error: any) {
      logger.error(
        {
          err: error,
          subscriptionId: subscription.id,
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
   * Each subscription may have a different language preference
   */
  async sendToUserWithLocalization(
    userId: string,
    type: NotificationType,
    notifierName: string | null,
    notificationId: string,
    noteId?: string | null,
  ): Promise<number> {
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
        // Create localized payload for each subscription's language
        const payload = await this.createPayload(
          type,
          notifierName,
          notificationId,
          noteId,
          subscription.language || "en",
        );
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
   * Send push notification to all subscriptions of a user (legacy - uses default English)
   * @deprecated Use sendToUserWithLocalization for localized notifications
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
   * Localized notification message functions
   */
  private readonly localizedMessages = {
    en: {
      follow: (name: string) => `${name} followed you`,
      mention: (name: string) => `${name} mentioned you`,
      reply: (name: string) => `${name} replied to your note`,
      reaction: (name: string) => `${name} reacted to your note`,
      renote: (name: string) => `${name} renoted your note`,
      quote: (name: string) => `${name} quoted your note`,
      warning: () => "You have received a warning from the moderators",
      follow_request_accepted: (name: string) => `${name} accepted your follow request`,
      dm: (name: string) => `${name} sent you a direct message`,
      default: () => "You have a new notification",
    },
    ja: {
      follow: (name: string) => `${name}さんにフォローされました`,
      mention: (name: string) => `${name}さんからメンションされました`,
      reply: (name: string) => `${name}さんから返信がありました`,
      reaction: (name: string) => `${name}さんがリアクションしました`,
      renote: (name: string) => `${name}さんがリノートしました`,
      quote: (name: string) => `${name}さんが引用しました`,
      warning: () => "モデレーターから警告を受けました",
      follow_request_accepted: (name: string) => `${name}さんがフォローリクエストを承認しました`,
      dm: (name: string) => `${name}さんからダイレクトメッセージが届きました`,
      default: () => "新しい通知があります",
    },
  } as const;

  /**
   * Get localized messages for the given language
   */
  private getLocalizedMessages(language: string): (typeof this.localizedMessages)["en"] {
    if (language === "ja") {
      return this.localizedMessages.ja;
    }
    return this.localizedMessages.en;
  }

  /**
   * Create notification payload from notification data
   */
  async createPayload(
    type: NotificationType,
    notifierName: string | null,
    notificationId: string,
    noteId?: string | null,
    language: string = "en",
  ): Promise<PushNotificationPayload> {
    const baseUrl = process.env.URL || "http://localhost:3000";

    // Get instance settings for notification title and icon
    const [instanceName, instanceIconUrl] = await Promise.all([
      this.instanceSettingsService.getInstanceName(),
      this.instanceSettingsService.getIconUrl(),
    ]);

    // Use instance icon if available, otherwise fall back to default
    const icon = instanceIconUrl || `${baseUrl}/icon-192.png`;

    const messages = this.getLocalizedMessages(language);
    const someone = language === "ja" ? "誰か" : "Someone";
    const name = notifierName || someone;

    let body: string;
    let url: string;

    switch (type) {
      case "follow":
        body = messages.follow(name);
        url = notifierName ? `${baseUrl}/@${notifierName}` : `${baseUrl}/notifications`;
        break;
      case "mention":
        body = messages.mention(name);
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "reply":
        body = messages.reply(name);
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "reaction":
        body = messages.reaction(name);
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "renote":
        body = messages.renote(name);
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "quote":
        body = messages.quote(name);
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      case "warning":
        body = messages.warning();
        url = `${baseUrl}/notifications`;
        break;
      case "follow_request_accepted":
        body = messages.follow_request_accepted(name);
        url = notifierName ? `${baseUrl}/@${notifierName}` : `${baseUrl}/notifications`;
        break;
      case "dm":
        body = messages.dm(name);
        url = noteId ? `${baseUrl}/notes/${noteId}` : `${baseUrl}/notifications`;
        break;
      default:
        body = messages.default();
        url = `${baseUrl}/notifications`;
    }

    return {
      title: instanceName,
      body,
      icon,
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
