/**
 * Push notification API routes
 *
 * Handles Web Push subscription management
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { requireAuth } from "../middleware/auth.js";
import type { AppContainer } from "../di/container.js";
import type { User } from "../db/schema/pg.js";

const push = new Hono();

/**
 * Get VAPID public key for client subscription
 * GET /api/push/vapid-public-key
 */
push.get("/vapid-public-key", (c: Context) => {
  const container = c.get("container") as AppContainer;
  const { webPushService } = container;

  const publicKey = webPushService.getVapidPublicKey();

  if (!publicKey) {
    return c.json({ error: "Web Push is not configured" }, 503);
  }

  return c.json({ publicKey });
});

/**
 * Check if Web Push is available
 * GET /api/push/status
 */
push.get("/status", (c: Context) => {
  const container = c.get("container") as AppContainer;
  const { webPushService } = container;

  return c.json({
    available: webPushService.isAvailable(),
    publicKey: webPushService.getVapidPublicKey(),
  });
});

/**
 * Subscribe to push notifications
 * POST /api/push/subscribe
 */
push.post("/subscribe", requireAuth(), async (c: Context) => {
  const user = c.get("user") as User;
  const container = c.get("container") as AppContainer;
  const { webPushService } = container;

  if (!webPushService.isAvailable()) {
    return c.json({ error: "Web Push is not configured" }, 503);
  }

  try {
    const body = await c.req.json();

    // Validate subscription data
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return c.json({ error: "Invalid subscription data" }, 400);
    }

    const subscription = await webPushService.subscribe(
      user.id,
      {
        endpoint: body.endpoint,
        keys: {
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        },
      },
      c.req.header("user-agent"),
    );

    return c.json({
      success: true,
      subscription: {
        id: subscription.id,
        endpoint: subscription.endpoint,
        createdAt: subscription.createdAt,
      },
    });
  } catch (error) {
    console.error("Failed to subscribe:", error);
    return c.json({ error: "Failed to subscribe" }, 500);
  }
});

/**
 * Unsubscribe from push notifications
 * POST /api/push/unsubscribe
 */
push.post("/unsubscribe", requireAuth(), async (c: Context) => {
  const user = c.get("user") as User;
  const container = c.get("container") as AppContainer;
  const { webPushService } = container;

  try {
    const body = await c.req.json();

    if (!body.endpoint) {
      return c.json({ error: "Endpoint is required" }, 400);
    }

    const success = await webPushService.unsubscribe(user.id, body.endpoint);

    return c.json({ success });
  } catch (error) {
    console.error("Failed to unsubscribe:", error);
    return c.json({ error: "Failed to unsubscribe" }, 500);
  }
});

/**
 * Get user's push subscriptions
 * GET /api/push/subscriptions
 */
push.get("/subscriptions", requireAuth(), async (c: Context) => {
  const user = c.get("user") as User;
  const container = c.get("container") as AppContainer;
  const { webPushService } = container;

  try {
    const subscriptions = await webPushService.getSubscriptions(user.id);

    return c.json({
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        endpoint: sub.endpoint,
        userAgent: sub.userAgent,
        createdAt: sub.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to get subscriptions:", error);
    return c.json({ error: "Failed to get subscriptions" }, 500);
  }
});

/**
 * Send test push notification (for debugging)
 * POST /api/push/test
 */
push.post("/test", requireAuth(), async (c: Context) => {
  const user = c.get("user") as User;
  const container = c.get("container") as AppContainer;
  const { webPushService } = container;

  console.log("[Push Test] Request received for user:", user.id);

  if (!webPushService.isAvailable()) {
    console.log("[Push Test] Web Push not available");
    return c.json({ error: "Web Push is not configured" }, 503);
  }

  try {
    console.log("[Push Test] Sending test notification...");
    const count = await webPushService.sendToUser(user.id, {
      title: "Test Notification",
      body: "This is a test push notification from Rox!",
      icon: `${process.env.URL || "http://localhost:3000"}/icon-192.png`,
      tag: "test-notification",
      data: {
        url: `${process.env.URL || "http://localhost:3000"}/notifications`,
        type: "follow" as const,
      },
    });

    console.log("[Push Test] Sent to", count, "subscriptions");
    return c.json({
      success: true,
      sentTo: count,
    });
  } catch (error) {
    console.error("[Push Test] Failed to send test notification:", error);
    return c.json({ error: "Failed to send test notification" }, 500);
  }
});

export default push;
