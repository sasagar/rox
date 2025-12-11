/**
 * Push notification API client
 *
 * Handles Web Push subscription management
 */

import { apiClient } from "./client";

/**
 * Push status response
 */
export interface PushStatus {
  available: boolean;
  publicKey: string | null;
}

/**
 * Push subscription response
 */
export interface PushSubscriptionInfo {
  id: string;
  endpoint: string;
  userAgent?: string;
  createdAt: string;
}

/**
 * Push API client
 */
export const pushApi = {
  /**
   * Get push notification status and VAPID public key
   */
  async getStatus(): Promise<PushStatus> {
    return apiClient.get<PushStatus>("/api/push/status");
  },

  /**
   * Get VAPID public key
   */
  async getVapidPublicKey(): Promise<string | null> {
    const response = await apiClient.get<{ publicKey: string | null }>(
      "/api/push/vapid-public-key",
    );
    return response.publicKey;
  },

  /**
   * Subscribe to push notifications
   */
  async subscribe(
    subscription: PushSubscription,
    language?: string,
  ): Promise<{ success: boolean; subscription?: PushSubscriptionInfo }> {
    const json = subscription.toJSON();
    return apiClient.post("/api/push/subscribe", {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      language,
    });
  },

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(endpoint: string): Promise<{ success: boolean }> {
    return apiClient.post("/api/push/unsubscribe", { endpoint });
  },

  /**
   * Get user's push subscriptions
   */
  async getSubscriptions(): Promise<{ subscriptions: PushSubscriptionInfo[] }> {
    return apiClient.get("/api/push/subscriptions");
  },

  /**
   * Send test notification
   */
  async sendTest(): Promise<{ success: boolean; sentTo: number }> {
    return apiClient.post("/api/push/test", {});
  },
};

/**
 * Convert base64 string to ArrayBuffer (for VAPID key)
 */
export function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray.buffer as ArrayBuffer;
}
