/**
 * Scheduled Notes API Routes
 *
 * Provides endpoints for managing scheduled notes.
 *
 * @module routes/scheduled-notes
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { userRateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { ScheduledNoteService } from "../services/ScheduledNoteService.js";

const scheduledNotes = new Hono();

/**
 * Create a ScheduledNoteService instance from context
 *
 * @param c - Hono context
 * @returns Configured ScheduledNoteService instance
 */
function getScheduledNoteService(c: Context): ScheduledNoteService {
  return new ScheduledNoteService(
    c.get("scheduledNoteRepository"),
    c.get("roleService"),
  );
}

/**
 * Handle service errors and return appropriate HTTP response
 *
 * @param c - Hono context
 * @param error - Error object
 * @param defaultMessage - Default error message if error is not an Error instance
 * @returns JSON response with error message and appropriate status code
 */
function handleServiceError(
  c: Context,
  error: unknown,
  defaultMessage: string,
): Response {
  const message = error instanceof Error ? error.message : defaultMessage;
  const status = message.includes("not found") ? 404 : 400;
  return c.json({ error: message }, status);
}

/**
 * Parse and validate ISO 8601 date string
 *
 * @param dateStr - Date string to parse
 * @returns Parsed Date object or null if invalid
 */
function parseScheduledDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * POST /api/scheduled-notes/create
 *
 * Create a new scheduled note
 *
 * @auth Required
 * @body {string} [text] - Note text content
 * @body {string} [cw] - Content warning text
 * @body {string} [visibility=public] - Visibility level (public, home, followers, specified)
 * @body {boolean} [localOnly=false] - Disable federation
 * @body {string} [replyId] - Reply target note ID
 * @body {string} [renoteId] - Renote target note ID
 * @body {string[]} [fileIds] - File IDs to attach
 * @body {string} scheduledAt - ISO 8601 date string for when to publish
 * @returns {ScheduledNote} Created scheduled note
 */
scheduledNotes.post(
  "/create",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const body = await c.req.json();

    if (!body.scheduledAt) {
      return c.json({ error: "scheduledAt is required" }, 400);
    }

    const scheduledAt = parseScheduledDate(body.scheduledAt);
    if (!scheduledAt) {
      return c.json({ error: "Invalid scheduledAt date format" }, 400);
    }

    try {
      // Map "direct" to "specified" for Misskey compatibility
      let visibility = body.visibility ?? "public";
      if (visibility === "direct") {
        visibility = "specified";
      }

      const scheduled = await getScheduledNoteService(c).create({
        userId: user.id,
        text: body.text ?? null,
        cw: body.cw ?? null,
        visibility,
        localOnly: body.localOnly ?? false,
        replyId: body.replyId ?? null,
        renoteId: body.renoteId ?? null,
        fileIds: body.fileIds ?? [],
        scheduledAt,
      });

      return c.json(scheduled, 201);
    } catch (error) {
      return handleServiceError(c, error, "Failed to create scheduled note");
    }
  },
);

/**
 * GET /api/scheduled-notes/list
 *
 * List user's scheduled notes
 *
 * @auth Required
 * @query {number} [limit=20] - Maximum number of notes (max: 100)
 * @query {number} [offset=0] - Offset for pagination
 * @query {string} [status] - Filter by status (pending, published, failed, cancelled)
 * @returns {ScheduledNote[]} List of scheduled notes
 */
scheduledNotes.get("/list", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;

  const limit = Math.min(
    c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 20,
    100,
  );
  const offset = c.req.query("offset") ? Number.parseInt(c.req.query("offset")!, 10) : 0;
  const status = c.req.query("status") as "pending" | "published" | "failed" | "cancelled" | undefined;

  const notes = await getScheduledNoteService(c).findByUserId(user.id, {
    limit,
    offset,
    status,
  });

  return c.json(notes);
});

/**
 * GET /api/scheduled-notes/show
 *
 * Get a specific scheduled note
 *
 * @auth Required
 * @query {string} id - Scheduled note ID
 * @returns {ScheduledNote} Scheduled note
 */
scheduledNotes.get("/show", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const id = c.req.query("id");

  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const scheduled = await getScheduledNoteService(c).findById(id, user.id);

  if (!scheduled) {
    return c.json({ error: "Scheduled note not found" }, 404);
  }

  return c.json(scheduled);
});

/**
 * POST /api/scheduled-notes/update
 *
 * Update a scheduled note
 *
 * @auth Required
 * @body {string} id - Scheduled note ID
 * @body {string} [text] - Note text content
 * @body {string} [cw] - Content warning text
 * @body {string} [visibility] - Visibility level
 * @body {boolean} [localOnly] - Disable federation
 * @body {string} [replyId] - Reply target note ID
 * @body {string} [renoteId] - Renote target note ID
 * @body {string[]} [fileIds] - File IDs to attach
 * @body {string} [scheduledAt] - New scheduled time (ISO 8601)
 * @returns {ScheduledNote} Updated scheduled note
 */
scheduledNotes.post(
  "/update",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const body = await c.req.json();

    if (!body.id) {
      return c.json({ error: "id is required" }, 400);
    }

    // Parse scheduledAt if provided, return null for invalid dates
    const scheduledAt = body.scheduledAt ? parseScheduledDate(body.scheduledAt) : undefined;
    if (body.scheduledAt && scheduledAt === null) {
      return c.json({ error: "Invalid scheduledAt date format" }, 400);
    }

    try {
      // Map "direct" to "specified" for Misskey compatibility
      let visibility = body.visibility;
      if (visibility === "direct") {
        visibility = "specified";
      }

      const updated = await getScheduledNoteService(c).update(body.id, user.id, {
        text: body.text,
        cw: body.cw,
        visibility,
        localOnly: body.localOnly,
        replyId: body.replyId,
        renoteId: body.renoteId,
        fileIds: body.fileIds,
        scheduledAt: scheduledAt ?? undefined,
      });

      return c.json(updated);
    } catch (error) {
      return handleServiceError(c, error, "Failed to update scheduled note");
    }
  },
);

/**
 * POST /api/scheduled-notes/cancel
 *
 * Cancel a scheduled note
 *
 * @auth Required
 * @body {string} id - Scheduled note ID
 * @returns {ScheduledNote} Cancelled scheduled note
 */
scheduledNotes.post(
  "/cancel",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const body = await c.req.json();

    if (!body.id) {
      return c.json({ error: "id is required" }, 400);
    }

    try {
      const cancelled = await getScheduledNoteService(c).cancel(body.id, user.id);
      return c.json(cancelled);
    } catch (error) {
      return handleServiceError(c, error, "Failed to cancel scheduled note");
    }
  },
);

/**
 * POST /api/scheduled-notes/delete
 *
 * Delete a scheduled note
 *
 * Only cancelled or failed notes can be deleted.
 *
 * @auth Required
 * @body {string} id - Scheduled note ID
 * @returns {void}
 */
scheduledNotes.post(
  "/delete",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const body = await c.req.json();

    if (!body.id) {
      return c.json({ error: "id is required" }, 400);
    }

    try {
      await getScheduledNoteService(c).delete(body.id, user.id);
      return c.json({ success: true });
    } catch (error) {
      return handleServiceError(c, error, "Failed to delete scheduled note");
    }
  },
);

/**
 * GET /api/scheduled-notes/count
 *
 * Get count of pending scheduled notes
 *
 * @auth Required
 * @returns {object} Count and limit info
 */
scheduledNotes.get("/count", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const roleService = c.get("roleService");

  const count = await getScheduledNoteService(c).countPending(user.id);
  const limit = await roleService.getMaxScheduledNotes(user.id);

  return c.json({
    count,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - count),
  });
});

export default scheduledNotes;
