/**
 * WebSocket Routes
 *
 * Provides WebSocket endpoints for real-time updates.
 * Replaces SSE endpoints for better compatibility with proxies like Cloudflare.
 *
 * @module routes/ws
 */

import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import type { ServerWebSocket } from "bun";
import { AuthService } from "../services/AuthService.js";
import { getTimelineStreamService } from "../services/TimelineStreamService.js";
import { getNotificationStreamService } from "../services/NotificationStreamService.js";
import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { ISessionRepository } from "../interfaces/repositories/ISessionRepository.js";
import type { IListRepository } from "../interfaces/repositories/IListRepository.js";

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

/**
 * WebSocket data attached to each connection
 */
interface WSData {
  userId?: string;
  channel?: string;
  unsubscribe?: () => void;
}

const ws = new Hono();

/**
 * Validate token and return user
 */
async function validateToken(
  token: string,
  userRepository: IUserRepository,
  sessionRepository: ISessionRepository,
): Promise<{ id: string; isSuspended: boolean } | null> {
  const authService = new AuthService(userRepository, sessionRepository);
  const result = await authService.validateSession(token);

  if (!result || result.user.isSuspended) {
    return null;
  }

  return result.user;
}

/**
 * WebSocket endpoint for home timeline
 *
 * Requires authentication via token query parameter.
 * Streams new notes, deletions, and reactions for followed users.
 */
ws.get(
  "/timeline",
  upgradeWebSocket((c) => {
    const token = c.req.query("token");
    const userRepository = c.get("userRepository");
    const sessionRepository = c.get("sessionRepository");

    let wsData: WSData = {};
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    return {
      async onOpen(_event, ws) {
        // Validate token
        if (!token) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Authentication required" } }));
          ws.close(4001, "Authentication required");
          return;
        }

        const user = await validateToken(token, userRepository, sessionRepository);
        if (!user) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Invalid or expired token" } }));
          ws.close(4001, "Invalid or expired token");
          return;
        }

        wsData.userId = user.id;
        wsData.channel = "home";

        // Subscribe to home timeline
        const streamService = getTimelineStreamService();
        wsData.unsubscribe = streamService.subscribeHome(user.id, (event) => {
          try {
            ws.send(JSON.stringify({ event: event.type, data: event.data }));
          } catch {
            // Connection closed
          }
        });

        // Send connected event
        ws.send(JSON.stringify({ event: "connected", data: { userId: user.id, channel: "home" } }));

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
          try {
            ws.send(JSON.stringify({ event: "heartbeat", data: { timestamp: Date.now() } }));
          } catch {
            // Connection closed
          }
        }, 30000);
      },

      onMessage(event, ws) {
        // Handle ping/pong for keep-alive
        try {
          const message = JSON.parse(event.data.toString());
          if (message.type === "ping") {
            ws.send(JSON.stringify({ event: "pong", data: { timestamp: Date.now() } }));
          }
        } catch {
          // Invalid message format, ignore
        }
      },

      onClose() {
        if (wsData.unsubscribe) {
          wsData.unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },

      onError() {
        if (wsData.unsubscribe) {
          wsData.unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },
    };
  }),
);

/**
 * WebSocket endpoint for social timeline
 *
 * Streams local public notes and notes from followed users.
 * Optionally authenticated - auth provides personalized social feed.
 */
ws.get(
  "/social-timeline",
  upgradeWebSocket((c) => {
    const token = c.req.query("token");
    const userRepository = c.get("userRepository");
    const sessionRepository = c.get("sessionRepository");

    let wsData: WSData = {};
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    return {
      async onOpen(_event, ws) {
        const streamService = getTimelineStreamService();

        // Try to authenticate if token provided
        if (token) {
          const user = await validateToken(token, userRepository, sessionRepository);
          if (user) {
            wsData.userId = user.id;
            wsData.channel = "social";

            // Subscribe to social timeline
            wsData.unsubscribe = streamService.subscribeSocial(user.id, (event) => {
              try {
                ws.send(JSON.stringify({ event: event.type, data: event.data }));
              } catch {
                // Connection closed
              }
            });

            ws.send(JSON.stringify({ event: "connected", data: { userId: user.id, channel: "social" } }));
          } else {
            // Fall back to local timeline if token invalid
            wsData.channel = "local";
            wsData.unsubscribe = streamService.subscribeLocal((event) => {
              try {
                ws.send(JSON.stringify({ event: event.type, data: event.data }));
              } catch {
                // Connection closed
              }
            });

            ws.send(JSON.stringify({ event: "connected", data: { channel: "local" } }));
          }
        } else {
          // No token, subscribe to local timeline
          wsData.channel = "local";
          wsData.unsubscribe = streamService.subscribeLocal((event) => {
            try {
              ws.send(JSON.stringify({ event: event.type, data: event.data }));
            } catch {
              // Connection closed
            }
          });

          ws.send(JSON.stringify({ event: "connected", data: { channel: "local" } }));
        }

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
          try {
            ws.send(JSON.stringify({ event: "heartbeat", data: { timestamp: Date.now() } }));
          } catch {
            // Connection closed
          }
        }, 30000);
      },

      onMessage(event, ws) {
        try {
          const message = JSON.parse(event.data.toString());
          if (message.type === "ping") {
            ws.send(JSON.stringify({ event: "pong", data: { timestamp: Date.now() } }));
          }
        } catch {
          // Invalid message format, ignore
        }
      },

      onClose() {
        if (wsData.unsubscribe) {
          wsData.unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },

      onError() {
        if (wsData.unsubscribe) {
          wsData.unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },
    };
  }),
);

/**
 * WebSocket endpoint for local timeline
 *
 * Public endpoint, no authentication required.
 * Streams all local public notes.
 */
ws.get(
  "/local-timeline",
  upgradeWebSocket(() => {
    let unsubscribe: (() => void) | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    return {
      onOpen(_event, ws) {
        const streamService = getTimelineStreamService();

        // Subscribe to local timeline
        unsubscribe = streamService.subscribeLocal((event) => {
          try {
            ws.send(JSON.stringify({ event: event.type, data: event.data }));
          } catch {
            // Connection closed
          }
        });

        ws.send(JSON.stringify({ event: "connected", data: { channel: "local" } }));

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
          try {
            ws.send(JSON.stringify({ event: "heartbeat", data: { timestamp: Date.now() } }));
          } catch {
            // Connection closed
          }
        }, 30000);
      },

      onMessage(event, ws) {
        try {
          const message = JSON.parse(event.data.toString());
          if (message.type === "ping") {
            ws.send(JSON.stringify({ event: "pong", data: { timestamp: Date.now() } }));
          }
        } catch {
          // Invalid message format, ignore
        }
      },

      onClose() {
        if (unsubscribe) {
          unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },

      onError() {
        if (unsubscribe) {
          unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },
    };
  }),
);

/**
 * WebSocket endpoint for global timeline
 *
 * Public endpoint, no authentication required.
 * Streams public notes.
 * Note: Currently limited to local public notes only.
 * Remote note streaming will be implemented in a future update.
 */
ws.get(
  "/global-timeline",
  upgradeWebSocket(() => {
    let unsubscribe: (() => void) | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    return {
      onOpen(_event, ws) {
        const streamService = getTimelineStreamService();

        // Subscribe to local timeline (includes public notes)
        // TODO: Implement separate global stream for remote notes
        unsubscribe = streamService.subscribeLocal((event) => {
          try {
            ws.send(JSON.stringify({ event: event.type, data: event.data }));
          } catch {
            // Connection closed
          }
        });

        ws.send(JSON.stringify({ event: "connected", data: { channel: "global" } }));

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
          try {
            ws.send(JSON.stringify({ event: "heartbeat", data: { timestamp: Date.now() } }));
          } catch {
            // Connection closed
          }
        }, 30000);
      },

      onMessage(event, ws) {
        try {
          const message = JSON.parse(event.data.toString());
          if (message.type === "ping") {
            ws.send(JSON.stringify({ event: "pong", data: { timestamp: Date.now() } }));
          }
        } catch {
          // Invalid message format, ignore
        }
      },

      onClose() {
        if (unsubscribe) {
          unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },

      onError() {
        if (unsubscribe) {
          unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },
    };
  }),
);

/**
 * WebSocket endpoint for notifications
 *
 * Requires authentication via token query parameter.
 * Streams new notifications and unread count updates.
 */
ws.get(
  "/notifications",
  upgradeWebSocket((c) => {
    const token = c.req.query("token");
    const userRepository = c.get("userRepository");
    const sessionRepository = c.get("sessionRepository");

    let wsData: WSData = {};
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    return {
      async onOpen(_event, ws) {
        // Validate token
        if (!token) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Authentication required" } }));
          ws.close(4001, "Authentication required");
          return;
        }

        const user = await validateToken(token, userRepository, sessionRepository);
        if (!user) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Invalid or expired token" } }));
          ws.close(4001, "Invalid or expired token");
          return;
        }

        wsData.userId = user.id;
        wsData.channel = "notifications";

        // Subscribe to notifications
        const streamService = getNotificationStreamService();
        wsData.unsubscribe = streamService.subscribe(user.id, (event) => {
          try {
            ws.send(JSON.stringify({ event: event.type, data: event.data }));
          } catch {
            // Connection closed
          }
        });

        // Send connected event
        ws.send(JSON.stringify({ event: "connected", data: { userId: user.id, channel: "notifications" } }));

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
          try {
            ws.send(JSON.stringify({ event: "heartbeat", data: { timestamp: Date.now() } }));
          } catch {
            // Connection closed
          }
        }, 30000);
      },

      onMessage(event, ws) {
        try {
          const message = JSON.parse(event.data.toString());
          if (message.type === "ping") {
            ws.send(JSON.stringify({ event: "pong", data: { timestamp: Date.now() } }));
          }
        } catch {
          // Invalid message format, ignore
        }
      },

      onClose() {
        if (wsData.unsubscribe) {
          wsData.unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },

      onError() {
        if (wsData.unsubscribe) {
          wsData.unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },
    };
  }),
);

/**
 * WebSocket endpoint for list timeline
 *
 * Requires authentication via token query parameter.
 * Streams new notes from users in the specified list.
 * User must own the list or list must be public.
 */
ws.get(
  "/list/:listId",
  upgradeWebSocket((c) => {
    const token = c.req.query("token");
    const listId = c.req.param("listId");
    const userRepository = c.get("userRepository");
    const sessionRepository = c.get("sessionRepository");
    const listRepository = c.get("listRepository") as IListRepository | undefined;

    let wsData: WSData = {};
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    return {
      async onOpen(_event, ws) {
        // Validate listRepository availability
        if (!listRepository) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Service unavailable" } }));
          ws.close(4000, "Service unavailable");
          return;
        }

        // Validate token
        if (!token) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Authentication required" } }));
          ws.close(4001, "Authentication required");
          return;
        }

        const user = await validateToken(token, userRepository, sessionRepository);
        if (!user) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Invalid or expired token" } }));
          ws.close(4001, "Invalid or expired token");
          return;
        }

        // Validate list access
        const list = await listRepository.findById(listId);
        if (!list) {
          ws.send(JSON.stringify({ event: "error", data: { message: "List not found" } }));
          ws.close(4004, "List not found");
          return;
        }

        // Check access: owner can always see, others only if public
        if (!list.isPublic && list.userId !== user.id) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Access denied" } }));
          ws.close(4003, "Access denied");
          return;
        }

        wsData.userId = user.id;
        wsData.channel = `list:${listId}`;

        // Subscribe to list timeline
        const streamService = getTimelineStreamService();
        wsData.unsubscribe = streamService.subscribeList(listId, (event) => {
          try {
            ws.send(JSON.stringify({ event: event.type, data: event.data }));
          } catch {
            // Connection closed
          }
        });

        // Send connected event
        ws.send(JSON.stringify({ event: "connected", data: { userId: user.id, listId, channel: "list" } }));

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
          try {
            ws.send(JSON.stringify({ event: "heartbeat", data: { timestamp: Date.now() } }));
          } catch {
            // Connection closed
          }
        }, 30000);
      },

      onMessage(event, ws) {
        try {
          const message = JSON.parse(event.data.toString());
          if (message.type === "ping") {
            ws.send(JSON.stringify({ event: "pong", data: { timestamp: Date.now() } }));
          }
        } catch {
          // Invalid message format, ignore
        }
      },

      onClose() {
        if (wsData.unsubscribe) {
          wsData.unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },

      onError() {
        if (wsData.unsubscribe) {
          wsData.unsubscribe();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      },
    };
  }),
);

export { websocket };
export default ws;
