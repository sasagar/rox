/**
 * Note API Routes
 *
 * Provides endpoints for note management and timeline retrieval.
 *
 * @module routes/notes
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { userRateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { NoteService } from "../services/NoteService.js";
import { getTimelineStreamService } from "../services/TimelineStreamService.js";

const notes = new Hono();

/**
 * POST /api/notes/create
 *
 * Create a new note
 *
 * @auth Required
 * @body {string} [text] - Note text content
 * @body {string} [cw] - Content warning text
 * @body {string} [visibility=public] - Visibility level (public, home, followers, specified)
 * @body {boolean} [localOnly=false] - Disable federation
 * @body {string} [replyId] - Reply target note ID
 * @body {string} [renoteId] - Renote target note ID
 * @body {string[]} [fileIds] - File IDs to attach
 * @returns {Note} Created note
 */
notes.post(
  "/create",
  requireAuth(),
  userRateLimit(RateLimitPresets.createNote),
  async (c: Context) => {
    const user = c.get("user")!;
    const noteRepository = c.get("noteRepository");
    const driveFileRepository = c.get("driveFileRepository");
    const userRepository = c.get("userRepository");
    const deliveryService = c.get("activityPubDeliveryService");
    const cacheService = c.get("cacheService");
    const notificationService = c.get("notificationService");

    const followRepository = c.get("followRepository");
    const noteService = new NoteService(
      noteRepository,
      driveFileRepository,
      followRepository,
      userRepository,
      deliveryService,
      cacheService,
      notificationService,
    );

    const body = await c.req.json();

    try {
      const note = await noteService.create({
        userId: user.id,
        text: body.text ?? null,
        cw: body.cw ?? null,
        visibility: body.visibility ?? "public",
        localOnly: body.localOnly ?? false,
        replyId: body.replyId ?? null,
        renoteId: body.renoteId ?? null,
        fileIds: body.fileIds ?? [],
      });

      return c.json(note, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create note";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/notes/show
 *
 * Get note by ID (Misskey-compatible)
 *
 * @auth Optional
 * @body {string} noteId - Note ID
 * @returns {Note} Note record
 */
notes.post("/show", optionalAuth(), async (c: Context) => {
  const noteRepository = c.get("noteRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const followRepository = c.get("followRepository");
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const body = await c.req.json();
  const noteId = body.noteId;

  if (!noteId) {
    return c.json({ error: "noteId is required" }, 400);
  }

  const note = await noteService.findById(noteId);

  if (!note) {
    return c.json({ error: "Note not found" }, 404);
  }

  return c.json(note);
});

/**
 * POST /api/notes/delete
 *
 * Delete a note
 *
 * @auth Required
 * @body {string} noteId - Note ID to delete
 * @returns {void}
 */
notes.post("/delete", requireAuth(), userRateLimit(RateLimitPresets.write), async (c: Context) => {
  const user = c.get("user")!;
  const noteRepository = c.get("noteRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const followRepository = c.get("followRepository");
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const body = await c.req.json();

  if (!body.noteId) {
    return c.json({ error: "noteId is required" }, 400);
  }

  try {
    await noteService.delete(body.noteId, user.id);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete note";
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/notes/local-timeline
 *
 * Get local timeline
 *
 * Returns public posts from local users only.
 *
 * @auth Optional
 * @query {number} [limit=20] - Maximum number of notes (max: 100)
 * @query {string} [sinceId] - Get notes newer than this ID
 * @query {string} [untilId] - Get notes older than this ID
 * @returns {Note[]} List of notes
 */
notes.get("/local-timeline", optionalAuth(), async (c: Context) => {
  const noteRepository = c.get("noteRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const followRepository = c.get("followRepository");
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const limit = c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : undefined;
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  const timeline = await noteService.getLocalTimeline({
    limit,
    sinceId,
    untilId,
  });

  return c.json(timeline);
});

/**
 * GET /api/notes/timeline
 *
 * Get home timeline
 *
 * Returns posts from followed users.
 *
 * @auth Required
 * @query {number} [limit=20] - Maximum number of notes (max: 100)
 * @query {string} [sinceId] - Get notes newer than this ID
 * @query {string} [untilId] - Get notes older than this ID
 * @returns {Note[]} List of notes
 */
notes.get("/timeline", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const noteRepository = c.get("noteRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const followRepository = c.get("followRepository");
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const limit = c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : undefined;
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  const timeline = await noteService.getHomeTimeline(user.id, {
    limit,
    sinceId,
    untilId,
  });

  return c.json(timeline);
});

/**
 * GET /api/notes/social-timeline
 *
 * Get social timeline
 *
 * Returns local public posts + posts from followed remote users.
 *
 * @auth Optional
 * @query {number} [limit=20] - Maximum number of notes (max: 100)
 * @query {string} [sinceId] - Get notes newer than this ID
 * @query {string} [untilId] - Get notes older than this ID
 * @returns {Note[]} List of notes
 */
notes.get("/social-timeline", optionalAuth(), async (c: Context) => {
  const user = c.get("user");
  const noteRepository = c.get("noteRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const followRepository = c.get("followRepository");
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const limit = c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : undefined;
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  const timeline = await noteService.getSocialTimeline(user?.id ?? null, {
    limit,
    sinceId,
    untilId,
  });

  return c.json(timeline);
});

/**
 * GET /api/notes/global-timeline
 *
 * Get global timeline
 *
 * Returns all public posts from local and remote users.
 *
 * @auth Optional
 * @query {number} [limit=20] - Maximum number of notes (max: 100)
 * @query {string} [sinceId] - Get notes newer than this ID
 * @query {string} [untilId] - Get notes older than this ID
 * @returns {Note[]} List of notes
 */
notes.get("/global-timeline", optionalAuth(), async (c: Context) => {
  const noteRepository = c.get("noteRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const followRepository = c.get("followRepository");
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const limit = c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : undefined;
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  const timeline = await noteService.getGlobalTimeline({
    limit,
    sinceId,
    untilId,
  });

  return c.json(timeline);
});

/**
 * GET /api/users/notes
 *
 * Get user timeline
 *
 * Returns posts from a specific user.
 *
 * @auth Optional
 * @query {string} userId - Target user ID
 * @query {number} [limit=20] - Maximum number of notes (max: 100)
 * @query {string} [sinceId] - Get notes newer than this ID
 * @query {string} [untilId] - Get notes older than this ID
 * @returns {Note[]} List of notes
 */
notes.get("/user-notes", optionalAuth(), async (c: Context) => {
  const noteRepository = c.get("noteRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const followRepository = c.get("followRepository");
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  const limit = c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : undefined;
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  const timeline = await noteService.getUserTimeline(userId, {
    limit,
    sinceId,
    untilId,
  });

  return c.json(timeline);
});

/**
 * GET /api/notes/replies
 *
 * Get replies to a specific note
 *
 * @auth Optional
 * @query {string} noteId - Note ID to get replies for
 * @query {number} [limit=20] - Maximum number of replies to return
 * @query {string} [sinceId] - Return replies after this ID
 * @query {string} [untilId] - Return replies before this ID
 * @returns {Note[]} Array of reply notes
 */
notes.get("/replies", optionalAuth(), async (c: Context) => {
  const noteRepository = c.get("noteRepository");

  const noteId = c.req.query("noteId");

  if (!noteId) {
    return c.json({ error: "noteId is required" }, 400);
  }

  const limit = c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 20;
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  // Get all replies to this note
  const replies = await noteRepository.findReplies(noteId, {
    limit,
    sinceId,
    untilId,
  });

  // TODO: Implement hydration with user and file data
  return c.json(replies);
});

/**
 * GET /api/notes/timeline/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time home timeline updates
 *
 * Establishes a persistent connection that pushes new notes as they are created
 * by users that the authenticated user follows.
 *
 * Events are sent in SSE format with the following types:
 * - note: A new note was created
 * - noteDeleted: A note was deleted
 *
 * @auth Required (via header or query param for SSE compatibility)
 * @query {string} [token] - Auth token (alternative to Authorization header for EventSource)
 * @returns {SSE stream} Real-time timeline events
 */
notes.get("/timeline/stream", async (c: Context) => {
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
  const streamService = getTimelineStreamService();

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

    stream.onAbort(() => {
      running = false;
    });

    // Send initial connection event immediately to establish the stream
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ userId: user.id, channel: "home" }),
      id: String(eventId++),
    });

    // Queue for notes received from subscription
    const noteQueue: Array<{ type: string; data: unknown }> = [];

    // Subscribe to home timeline events for this user
    const unsubscribe = streamService.subscribeHome(user.id, (event) => {
      noteQueue.push(event);
    });

    // Main loop: send heartbeats and process note queue
    while (running) {
      // Process any pending notes
      while (noteQueue.length > 0) {
        const event = noteQueue.shift();
        if (event) {
          try {
            await stream.writeSSE({
              event: event.type,
              data: JSON.stringify(event.data),
              id: String(eventId++),
            });
          } catch {
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
        running = false;
        break;
      }

      // Wait before next heartbeat (15 seconds)
      await stream.sleep(15000);
    }

    unsubscribe();
  });
});

/**
 * GET /api/notes/social-timeline/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time social timeline updates
 *
 * Establishes a persistent connection that pushes new public notes
 * from local users and followed remote users.
 *
 * @auth Optional (via header or query param for SSE compatibility)
 * @query {string} [token] - Auth token (alternative to Authorization header for EventSource)
 * @returns {SSE stream} Real-time timeline events
 */
notes.get("/social-timeline/stream", async (c: Context) => {
  // SSE-compatible auth: support token from query param since EventSource doesn't support headers
  const tokenFromQuery = c.req.query("token");
  const authHeader = c.req.header("Authorization");
  const token = tokenFromQuery || (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null);

  let userId: string | null = null;

  if (token) {
    const { AuthService } = await import("../services/AuthService.js");
    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const result = await authService.validateSession(token);

    if (result && !result.user.isSuspended) {
      userId = result.user.id;
    }
  }

  const streamService = getTimelineStreamService();

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

    stream.onAbort(() => {
      running = false;
    });

    // Send initial connection event immediately to establish the stream
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ userId, channel: "social" }),
      id: String(eventId++),
    });

    // Queue for notes received from subscriptions
    const noteQueue: Array<{ type: string; data: unknown }> = [];

    // Subscribe to local timeline (always)
    const unsubscribeLocal = streamService.subscribeLocal((event) => {
      noteQueue.push(event);
    });

    // Subscribe to social timeline if authenticated
    let unsubscribeSocial: (() => void) | null = null;
    if (userId) {
      unsubscribeSocial = streamService.subscribeSocial(userId, (event) => {
        noteQueue.push(event);
      });
    }

    // Main loop
    while (running) {
      while (noteQueue.length > 0) {
        const event = noteQueue.shift();
        if (event) {
          try {
            await stream.writeSSE({
              event: event.type,
              data: JSON.stringify(event.data),
              id: String(eventId++),
            });
          } catch {
            running = false;
            break;
          }
        }
      }

      if (!running) break;

      try {
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ timestamp: Date.now() }),
          id: String(eventId++),
        });
      } catch {
        running = false;
        break;
      }

      await stream.sleep(15000);
    }

    unsubscribeLocal();
    if (unsubscribeSocial) {
      unsubscribeSocial();
    }
  });
});

/**
 * GET /api/notes/local-timeline/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time local timeline updates
 *
 * Establishes a persistent connection that pushes new public notes
 * from local users.
 *
 * @auth Not required
 * @returns {SSE stream} Real-time timeline events
 */
notes.get("/local-timeline/stream", async (c: Context) => {
  const streamService = getTimelineStreamService();

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

    stream.onAbort(() => {
      running = false;
    });

    // Send initial connection event immediately to establish the stream
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ channel: "local" }),
      id: String(eventId++),
    });

    // Queue for notes
    const noteQueue: Array<{ type: string; data: unknown }> = [];

    // Subscribe to local timeline
    const unsubscribe = streamService.subscribeLocal((event) => {
      noteQueue.push(event);
    });

    // Main loop
    while (running) {
      while (noteQueue.length > 0) {
        const event = noteQueue.shift();
        if (event) {
          try {
            await stream.writeSSE({
              event: event.type,
              data: JSON.stringify(event.data),
              id: String(eventId++),
            });
          } catch {
            running = false;
            break;
          }
        }
      }

      if (!running) break;

      try {
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ timestamp: Date.now() }),
          id: String(eventId++),
        });
      } catch {
        running = false;
        break;
      }

      await stream.sleep(15000);
    }

    unsubscribe();
  });
});

export default notes;
