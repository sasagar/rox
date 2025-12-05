/**
 * Notification API Routes
 *
 * Provides endpoints for notification management.
 *
 * @module routes/notifications
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth } from "../middleware/auth.js";
import { userRateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { NotificationService } from "../services/NotificationService.js";
import { getNotificationStreamService } from "../services/NotificationStreamService.js";
import type { NotificationType } from "../db/schema/pg.js";

const notifications = new Hono();

/**
 * GET /api/notifications
 *
 * Get notifications for the authenticated user
 *
 * @auth Required
 * @query {number} [limit=40] - Maximum number of notifications to return
 * @query {string} [sinceId] - Get notifications after this ID
 * @query {string} [untilId] - Get notifications before this ID
 * @query {string} [types] - Comma-separated list of notification types
 * @query {boolean} [unreadOnly] - Only return unread notifications
 * @returns {Notification[]} List of notifications
 */
notifications.get("/", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const notificationRepository = c.get("notificationRepository");
  const userRepository = c.get("userRepository");

  const notificationService = new NotificationService(notificationRepository, userRepository);

  const limit = c.req.query("limit")
    ? Math.min(Number.parseInt(c.req.query("limit")!, 10), 100)
    : 40;
  const sinceId = c.req.query("sinceId") ?? undefined;
  const untilId = c.req.query("untilId") ?? undefined;
  const typesParam = c.req.query("types");
  const unreadOnly = c.req.query("unreadOnly") === "true";

  const types = typesParam ? (typesParam.split(",") as NotificationType[]) : undefined;

  try {
    const notificationsList = await notificationService.getNotifications(user.id, {
      limit,
      sinceId,
      untilId,
      types,
      unreadOnly,
    });

    return c.json(notificationsList);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get notifications";
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/notifications/unread-count
 *
 * Get the count of unread notifications
 *
 * @auth Required
 * @returns {object} { count: number }
 */
notifications.get("/unread-count", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const notificationRepository = c.get("notificationRepository");
  const userRepository = c.get("userRepository");

  const notificationService = new NotificationService(notificationRepository, userRepository);

  try {
    const count = await notificationService.getUnreadCount(user.id);
    return c.json({ count });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get unread notification count";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/notifications/mark-as-read
 *
 * Mark a notification as read
 *
 * @auth Required
 * @body {string} notificationId - Notification ID to mark as read
 * @returns {Notification} Updated notification
 */
notifications.post(
  "/mark-as-read",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const notificationRepository = c.get("notificationRepository");
    const userRepository = c.get("userRepository");

    const notificationService = new NotificationService(notificationRepository, userRepository);

    const body = await c.req.json();

    if (!body.notificationId) {
      return c.json({ error: "notificationId is required" }, 400);
    }

    try {
      const notification = await notificationService.markAsRead(body.notificationId, user.id);

      if (!notification) {
        return c.json({ error: "Notification not found" }, 404);
      }

      return c.json(notification);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to mark notification as read";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/notifications/mark-all-as-read
 *
 * Mark all notifications as read
 *
 * @auth Required
 * @returns {object} { count: number } Number of notifications marked as read
 */
notifications.post(
  "/mark-all-as-read",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const notificationRepository = c.get("notificationRepository");
    const userRepository = c.get("userRepository");

    const notificationService = new NotificationService(notificationRepository, userRepository);

    try {
      const count = await notificationService.markAllAsRead(user.id);
      return c.json({ count });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to mark all notifications as read";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/notifications/mark-as-read-until
 *
 * Mark notifications as read up to a specific notification
 *
 * @auth Required
 * @body {string} untilId - Mark all notifications up to this ID as read
 * @returns {object} { count: number } Number of notifications marked as read
 */
notifications.post(
  "/mark-as-read-until",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const notificationRepository = c.get("notificationRepository");
    const userRepository = c.get("userRepository");

    const notificationService = new NotificationService(notificationRepository, userRepository);

    const body = await c.req.json();

    if (!body.untilId) {
      return c.json({ error: "untilId is required" }, 400);
    }

    try {
      const count = await notificationService.markAsReadUntil(user.id, body.untilId);
      return c.json({ count });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to mark notifications as read";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/notifications/delete
 *
 * Delete a notification
 *
 * @auth Required
 * @body {string} notificationId - Notification ID to delete
 * @returns {object} { success: boolean }
 */
notifications.post(
  "/delete",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const notificationRepository = c.get("notificationRepository");
    const userRepository = c.get("userRepository");

    const notificationService = new NotificationService(notificationRepository, userRepository);

    const body = await c.req.json();

    if (!body.notificationId) {
      return c.json({ error: "notificationId is required" }, 400);
    }

    try {
      const deleted = await notificationService.deleteNotification(body.notificationId, user.id);

      if (!deleted) {
        return c.json({ error: "Notification not found" }, 404);
      }

      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete notification";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/notifications/delete-all
 *
 * Delete all notifications for the authenticated user
 *
 * @auth Required
 * @returns {object} { count: number } Number of notifications deleted
 */
notifications.post(
  "/delete-all",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const notificationRepository = c.get("notificationRepository");
    const userRepository = c.get("userRepository");

    const notificationService = new NotificationService(notificationRepository, userRepository);

    try {
      const count = await notificationService.deleteAllNotifications(user.id);
      return c.json({ count });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete all notifications";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * GET /api/notifications/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time notifications
 *
 * Establishes a persistent connection that pushes notifications as they occur.
 * Events are sent in SSE format with the following types:
 * - notification: A new notification was created
 * - unreadCount: The unread notification count has changed
 *
 * @auth Required (via header or query param for SSE compatibility)
 * @query {string} [token] - Auth token (alternative to Authorization header for EventSource)
 * @returns {SSE stream} Real-time notification events
 */
notifications.get("/stream", async (c: Context) => {
  // SSE-compatible auth: support token from query param since EventSource doesn't support headers
  const tokenFromQuery = c.req.query("token");
  const authHeader = c.req.header("Authorization");
  const token = tokenFromQuery || (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null);

  if (!token) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Validate session
  const { AuthService } = await import("../services/AuthService.js");
  const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
  const result = await authService.validateSession(token);

  if (!result) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  if (result.user.isSuspended) {
    return c.json({ error: "Your account has been suspended" }, 403);
  }

  const user = result.user;
  const streamService = getNotificationStreamService();

  // Set headers to disable buffering for SSE compatibility with proxies (Nginx, Cloudflare)
  // X-Accel-Buffering: Nginx proxy buffering control
  // Cache-Control: Prevent caching of SSE stream
  // Connection: Keep connection alive for streaming
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  c.header("Connection", "keep-alive");

  return streamSSE(c, async (stream) => {
    let eventId = 0;
    let running = true;

    // Clean up on disconnect
    stream.onAbort(() => {
      running = false;
    });

    // Send initial connection event immediately to establish the stream
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ userId: user.id }),
      id: String(eventId++),
    });

    // Queue for notifications received from subscription
    const notificationQueue: Array<{ type: string; data: unknown }> = [];

    // Subscribe to notification events for this user
    const unsubscribe = streamService.subscribe(user.id, (event) => {
      notificationQueue.push(event);
    });

    // Main loop: send heartbeats and process notification queue
    // Using while loop pattern as recommended by Hono docs for proper stream maintenance
    while (running) {
      // Process any pending notifications
      while (notificationQueue.length > 0) {
        const event = notificationQueue.shift();
        if (event) {
          try {
            await stream.writeSSE({
              event: event.type,
              data: JSON.stringify(event.data),
              id: String(eventId++),
            });
          } catch {
            // Connection closed
            running = false;
            break;
          }
        }
      }

      if (!running) break;

      // Send heartbeat
      try {
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ timestamp: Date.now() }),
          id: String(eventId++),
        });
      } catch {
        // Connection closed
        running = false;
        break;
      }

      // Wait before next heartbeat (15 seconds)
      await stream.sleep(15000);
    }

    // Cleanup
    unsubscribe();
  });
});

export default notifications;
