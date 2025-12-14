/**
 * Lists API Routes
 *
 * Provides Misskey API-compatible endpoints for list management.
 * Allows users to create, manage, and view custom user lists.
 *
 * @module routes/lists
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { userRateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { ListService } from "../services/ListService.js";
import { NoteService } from "../services/NoteService.js";

const lists = new Hono();

/**
 * Helper to create ListService from context
 */
function getListService(c: Context): ListService {
  const listRepository = c.get("listRepository");
  const userRepository = c.get("userRepository");
  const noteRepository = c.get("noteRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const followRepository = c.get("followRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  // Create NoteService for hydrating notes in list timeline
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  return new ListService(listRepository, userRepository, noteRepository, noteService);
}

/**
 * POST /api/users/lists/create
 *
 * Create a new list
 *
 * @auth Required
 * @body {string} name - List name
 * @body {boolean} [isPublic=false] - Whether the list is publicly visible
 * @returns {List} Created list
 */
lists.post(
  "/create",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const listService = getListService(c);

    const body = await c.req.json();

    if (!body.name) {
      return c.json({ error: "name is required" }, 400);
    }

    try {
      const list = await listService.createList(user.id, body.name, body.isPublic ?? false);
      return c.json(list, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create list";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/users/lists/delete
 *
 * Delete a list
 *
 * @auth Required
 * @body {string} listId - List ID to delete
 * @returns {void}
 */
lists.post(
  "/delete",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const listService = getListService(c);

    const body = await c.req.json();

    if (!body.listId) {
      return c.json({ error: "listId is required" }, 400);
    }

    try {
      await listService.deleteList(body.listId, user.id);
      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete list";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/users/lists/update
 *
 * Update a list
 *
 * @auth Required
 * @body {string} listId - List ID to update
 * @body {string} [name] - New list name
 * @body {boolean} [isPublic] - New visibility setting
 * @body {string} [notifyLevel] - Notification level ("none" | "all" | "original")
 * @returns {List} Updated list
 */
lists.post(
  "/update",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const listService = getListService(c);

    const body = await c.req.json();

    if (!body.listId) {
      return c.json({ error: "listId is required" }, 400);
    }

    // Validate notifyLevel if provided
    if (body.notifyLevel !== undefined) {
      const validLevels = ["none", "all", "original"];
      if (!validLevels.includes(body.notifyLevel)) {
        return c.json({ error: "notifyLevel must be one of: none, all, original" }, 400);
      }
    }

    const updateData: { name?: string; isPublic?: boolean; notifyLevel?: "none" | "all" | "original" } = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.notifyLevel !== undefined) updateData.notifyLevel = body.notifyLevel;

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "At least one field to update is required" }, 400);
    }

    try {
      const list = await listService.updateList(body.listId, user.id, updateData);
      return c.json(list);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update list";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/users/lists/show
 *
 * Get list details
 *
 * @auth Optional (required for private lists)
 * @body {string} listId - List ID
 * @returns {List} List details
 */
lists.post("/show", optionalAuth(), async (c: Context) => {
  const user = c.get("user");
  const listService = getListService(c);

  const body = await c.req.json();

  if (!body.listId) {
    return c.json({ error: "listId is required" }, 400);
  }

  try {
    const list = await listService.getList(body.listId, user?.id);
    if (!list) {
      return c.json({ error: "List not found" }, 404);
    }
    return c.json(list);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get list";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/users/lists/list
 *
 * Get user's lists
 *
 * @auth Optional (shows only public lists for other users)
 * @body {string} [userId] - User ID (optional, defaults to current user)
 * @returns {ListWithMemberCount[]} Lists with member counts
 */
lists.post("/list", optionalAuth(), async (c: Context) => {
  const user = c.get("user");
  const listService = getListService(c);

  const body = await c.req.json().catch(() => ({}));
  const targetUserId = body.userId || user?.id;

  if (!targetUserId) {
    return c.json({ error: "userId is required when not authenticated" }, 400);
  }

  try {
    const userLists = await listService.getUserLists(targetUserId, user?.id);
    return c.json(userLists);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get lists";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/users/lists/push
 *
 * Add a user to a list
 *
 * @auth Required
 * @body {string} listId - List ID
 * @body {string} userId - User ID to add
 * @body {boolean} [withReplies=true] - Include replies in timeline
 * @returns {ListMember} Created membership
 */
lists.post(
  "/push",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const listService = getListService(c);

    const body = await c.req.json();

    if (!body.listId) {
      return c.json({ error: "listId is required" }, 400);
    }
    if (!body.userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    try {
      const member = await listService.addMember(
        body.listId,
        body.userId,
        user.id,
        body.withReplies ?? true,
      );
      return c.json(member, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add member";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/users/lists/pull
 *
 * Remove a user from a list
 *
 * @auth Required
 * @body {string} listId - List ID
 * @body {string} userId - User ID to remove
 * @returns {void}
 */
lists.post(
  "/pull",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const listService = getListService(c);

    const body = await c.req.json();

    if (!body.listId) {
      return c.json({ error: "listId is required" }, 400);
    }
    if (!body.userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    try {
      await listService.removeMember(body.listId, body.userId, user.id);
      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove member";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/users/lists/get-memberships
 *
 * Get list members
 *
 * @auth Optional (required for private lists)
 * @body {string} listId - List ID
 * @body {number} [limit=30] - Maximum number of members to return
 * @body {number} [offset=0] - Number of members to skip
 * @returns {ListMembership[]} Members with user details
 */
lists.post("/get-memberships", optionalAuth(), async (c: Context) => {
  const user = c.get("user");
  const listService = getListService(c);

  const body = await c.req.json();

  if (!body.listId) {
    return c.json({ error: "listId is required" }, 400);
  }

  const limit = body.limit ?? 30;
  const offset = body.offset ?? 0;

  try {
    const members = await listService.getMembers(body.listId, user?.id, limit, offset);
    return c.json(members);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get members";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/users/lists/update-membership
 *
 * Update member settings in a list
 *
 * @auth Required
 * @body {string} listId - List ID
 * @body {string} userId - Member user ID
 * @body {boolean} [withReplies] - Include replies in timeline
 * @returns {ListMember} Updated membership
 */
lists.post(
  "/update-membership",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const listService = getListService(c);

    const body = await c.req.json();

    if (!body.listId) {
      return c.json({ error: "listId is required" }, 400);
    }
    if (!body.userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const updateData: { withReplies?: boolean } = {};
    if (body.withReplies !== undefined) updateData.withReplies = body.withReplies;

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "At least one field to update is required" }, 400);
    }

    try {
      const member = await listService.updateMember(body.listId, body.userId, user.id, updateData);
      return c.json(member);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update membership";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * GET /api/users/lists/timeline
 *
 * Get list timeline (notes from list members)
 *
 * @auth Optional (required for private lists)
 * @query {string} listId - List ID
 * @query {number} [limit=20] - Maximum number of notes to return
 * @query {string} [sinceId] - Return notes newer than this ID
 * @query {string} [untilId] - Return notes older than this ID
 * @returns {Note[]} Notes from list members
 */
lists.get("/timeline", optionalAuth(), async (c: Context) => {
  const user = c.get("user");
  const listService = getListService(c);

  const listId = c.req.query("listId");
  if (!listId) {
    return c.json({ error: "listId is required" }, 400);
  }

  const limit = c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 20;
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  try {
    const notes = await listService.getListTimeline(listId, user?.id, {
      limit,
      sinceId,
      untilId,
    });
    return c.json(notes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get timeline";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/users/lists/get-containing
 *
 * Get lists that contain a specific user (owned by the requester)
 *
 * @auth Required
 * @body {string} userId - User ID to check
 * @returns {List[]} Lists containing the user
 */
lists.post("/get-containing", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const listService = getListService(c);

  const body = await c.req.json();

  if (!body.userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const containingLists = await listService.getListsContainingUser(body.userId, user.id);
    return c.json(containingLists);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get lists";
    return c.json({ error: message }, 400);
  }
});

export default lists;
