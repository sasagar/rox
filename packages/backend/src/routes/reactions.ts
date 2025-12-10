/**
 * Reaction API Routes
 *
 * Provides endpoints for reaction management.
 *
 * @module routes/reactions
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { userRateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { ReactionService } from "../services/ReactionService.js";

const reactions = new Hono();

/**
 * POST /api/notes/reactions/create
 *
 * Create or update a reaction to a note
 *
 * @auth Required
 * @body {string} noteId - Note ID to react to
 * @body {string} reaction - Reaction emoji (Unicode or custom emoji name)
 * @returns {Reaction} Created reaction
 */
reactions.post(
  "/create",
  requireAuth(),
  userRateLimit(RateLimitPresets.reaction),
  async (c: Context) => {
    const user = c.get("user")!;
    const reactionRepository = c.get("reactionRepository");
    const noteRepository = c.get("noteRepository");
    const userRepository = c.get("userRepository");
    const deliveryService = c.get("activityPubDeliveryService");
    const notificationService = c.get("notificationService");
    const customEmojiRepository = c.get("customEmojiRepository");

    const reactionService = new ReactionService(
      reactionRepository,
      noteRepository,
      userRepository,
      deliveryService,
      notificationService,
      customEmojiRepository,
    );

    const body = await c.req.json();

    if (!body.noteId) {
      return c.json({ error: "noteId is required" }, 400);
    }

    if (!body.reaction) {
      return c.json({ error: "reaction is required" }, 400);
    }

    try {
      const reaction = await reactionService.create({
        userId: user.id,
        noteId: body.noteId,
        reaction: body.reaction,
      });

      return c.json(reaction, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create reaction";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * POST /api/notes/reactions/delete
 *
 * Delete a specific reaction from a note
 *
 * @auth Required
 * @body {string} noteId - Note ID to remove reaction from
 * @body {string} reaction - Reaction emoji to remove
 * @returns {void}
 */
reactions.post(
  "/delete",
  requireAuth(),
  userRateLimit(RateLimitPresets.reaction),
  async (c: Context) => {
    const user = c.get("user")!;
    const reactionRepository = c.get("reactionRepository");
    const noteRepository = c.get("noteRepository");
    const userRepository = c.get("userRepository");
    const deliveryService = c.get("activityPubDeliveryService");

    const reactionService = new ReactionService(
      reactionRepository,
      noteRepository,
      userRepository,
      deliveryService,
    );

    const body = await c.req.json();

    if (!body.noteId) {
      return c.json({ error: "noteId is required" }, 400);
    }

    if (!body.reaction) {
      return c.json({ error: "reaction is required" }, 400);
    }

    try {
      await reactionService.delete(user.id, body.noteId, body.reaction);
      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete reaction";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * GET /api/notes/reactions
 *
 * Get all reactions for a note
 *
 * @auth Optional
 * @query {string} noteId - Note ID
 * @query {number} [limit] - Maximum number of reactions to retrieve
 * @returns {Reaction[]} List of reactions
 */
reactions.get("/", optionalAuth(), async (c: Context) => {
  const reactionRepository = c.get("reactionRepository");
  const noteRepository = c.get("noteRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    deliveryService,
  );

  const noteId = c.req.query("noteId");
  const limit = c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : undefined;

  if (!noteId) {
    return c.json({ error: "noteId is required" }, 400);
  }

  try {
    const reactionsList = await reactionService.getReactionsByNote(noteId, limit);
    return c.json(reactionsList);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get reactions";
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/notes/reactions/counts
 *
 * Get reaction counts for a note
 *
 * @auth Optional
 * @query {string} noteId - Note ID
 * @returns {Record<string, number>} Reaction counts by emoji
 */
reactions.get("/counts", optionalAuth(), async (c: Context) => {
  const reactionRepository = c.get("reactionRepository");
  const noteRepository = c.get("noteRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    deliveryService,
  );

  const noteId = c.req.query("noteId");

  if (!noteId) {
    return c.json({ error: "noteId is required" }, 400);
  }

  try {
    const counts = await reactionService.getReactionCounts(noteId);
    return c.json(counts);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get reaction counts";
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/notes/reactions/counts-with-emojis
 *
 * Get reaction counts with custom emoji URLs for a note
 *
 * For remote notes (notes with a URI), this endpoint can optionally fetch
 * reactions from the remote server if `fetchRemote=true` is specified.
 *
 * @auth Optional
 * @query {string} noteId - Note ID
 * @query {string} [fetchRemote=false] - Fetch reactions from remote server for remote notes
 * @returns {Object} Reaction counts and custom emoji URLs
 * @returns {Record<string, number>} counts - Reaction counts by emoji
 * @returns {Record<string, string>} emojis - Custom emoji URLs by emoji name
 */
reactions.get("/counts-with-emojis", optionalAuth(), async (c: Context) => {
  const reactionRepository = c.get("reactionRepository");
  const noteRepository = c.get("noteRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    deliveryService,
  );

  const noteId = c.req.query("noteId");
  const fetchRemote = c.req.query("fetchRemote") === "true";

  if (!noteId) {
    return c.json({ error: "noteId is required" }, 400);
  }

  try {
    // Check if this is a remote note and fetchRemote is requested
    if (fetchRemote) {
      const note = await noteRepository.findById(noteId);
      if (note?.uri) {
        // This is a remote note - try to fetch reactions from remote server
        const { RemoteLikesService } = await import(
          "../services/ap/RemoteLikesService.js"
        );
        const customEmojiRepository = c.get("customEmojiRepository");
        const remoteLikesService = new RemoteLikesService(
          reactionRepository,
          noteRepository,
          userRepository,
          customEmojiRepository,
        );

        // Configure HTTP Signature for authenticated requests
        // Some servers (e.g., secure Misskey instances) require signed requests
        const instanceActor = await userRepository.findByUsername("alice", null);
        const baseUrl = process.env.URL || "http://localhost:3000";
        if (instanceActor?.privateKey) {
          remoteLikesService.setSignatureConfig({
            keyId: `${baseUrl}/users/${instanceActor.username}#main-key`,
            privateKey: instanceActor.privateKey,
          });
        }

        const remoteResult = await remoteLikesService.fetchRemoteLikes(noteId);

        // Always get local reactions and merge with remote
        const localResult = await reactionService.getReactionCountsWithEmojis(noteId);

        if (remoteResult) {
          // Merge remote and local counts (take max of each to avoid double-counting)
          const mergedCounts: Record<string, number> = { ...remoteResult.counts };
          for (const [emoji, count] of Object.entries(localResult.counts)) {
            // Use local count if higher (includes user's own reactions)
            mergedCounts[emoji] = Math.max(mergedCounts[emoji] || 0, count);
          }

          // Merge emojis (prefer local URLs if available, fallback to remote)
          const mergedEmojis: Record<string, string> = {
            ...remoteResult.emojis,
            ...localResult.emojis,
          };

          return c.json({ counts: mergedCounts, emojis: mergedEmojis });
        }
        // Fall through to local fetch if remote fetch failed
      }
    }

    const result = await reactionService.getReactionCountsWithEmojis(noteId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get reaction counts";
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/notes/reactions/my-reactions
 *
 * Get current user's reactions to a note
 *
 * @auth Required
 * @query {string} noteId - Note ID
 * @returns {Reaction[]} User's reactions
 */
reactions.get("/my-reactions", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const reactionRepository = c.get("reactionRepository");
  const noteRepository = c.get("noteRepository");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    deliveryService,
  );

  const noteId = c.req.query("noteId");

  if (!noteId) {
    return c.json({ error: "noteId is required" }, 400);
  }

  try {
    const reactions = await reactionService.getUserReactions(user.id, noteId);
    return c.json(reactions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get user reactions";
    return c.json({ error: message }, 400);
  }
});

export default reactions;
