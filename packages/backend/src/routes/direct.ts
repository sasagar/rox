/**
 * Direct Messages API Routes
 *
 * Provides endpoints for retrieving direct messages (DMs) for the authenticated user.
 *
 * @module routes/direct
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { requireAuth } from "../middleware/auth.js";

const direct = new Hono();

/**
 * GET /api/direct/conversations
 *
 * Get list of conversation partners for DMs
 *
 * Returns a list of users the authenticated user has DM conversations with,
 * along with the most recent message from each conversation.
 *
 * @auth Required
 * @query {number} [limit=20] - Maximum number of conversations to return
 * @returns {ConversationPartner[]} List of conversation partners
 */
direct.get("/conversations", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const noteRepository = c.get("noteRepository");

  const limit = Math.min(
    c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 20,
    100,
  );

  try {
    const conversations = await noteRepository.getConversationPartners(user.id, limit);
    return c.json(conversations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get conversations";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/direct/messages
 *
 * Get all direct messages for the authenticated user
 *
 * Returns all DM notes (visibility: specified) where the user is sender or recipient.
 *
 * @auth Required
 * @query {number} [limit=20] - Maximum number of messages (max: 100)
 * @query {string} [sinceId] - Get messages newer than this ID
 * @query {string} [untilId] - Get messages older than this ID
 * @returns {Note[]} List of direct messages
 */
direct.get("/messages", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const noteRepository = c.get("noteRepository");

  const limit = Math.min(
    c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 20,
    100,
  );
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  try {
    const messages = await noteRepository.findDirectMessages(user.id, {
      limit,
      sinceId,
      untilId,
    });

    return c.json(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get direct messages";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/direct/thread/:partnerId
 *
 * Get DM thread with a specific user
 *
 * Returns all direct messages between the authenticated user and the specified partner.
 *
 * @auth Required
 * @param {string} partnerId - User ID of the conversation partner
 * @query {number} [limit=50] - Maximum number of messages (max: 100)
 * @query {string} [sinceId] - Get messages newer than this ID
 * @query {string} [untilId] - Get messages older than this ID
 * @returns {Note[]} List of messages in the thread
 */
direct.get("/thread/:partnerId", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const noteRepository = c.get("noteRepository");
  const partnerId = c.req.param("partnerId");

  if (!partnerId) {
    return c.json({ error: "partnerId is required" }, 400);
  }

  const limit = Math.min(
    c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 50,
    100,
  );
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");

  try {
    const thread = await noteRepository.findDirectMessageThread(user.id, partnerId, {
      limit,
      sinceId,
      untilId,
    });

    return c.json(thread);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get DM thread";
    return c.json({ error: message }, 500);
  }
});

export default direct;
