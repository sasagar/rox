/**
 * Reaction API Routes
 *
 * Provides endpoints for reaction management.
 *
 * @module routes/reactions
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { ReactionService } from '../services/ReactionService.js';

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
reactions.post('/create', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const reactionRepository = c.get('reactionRepository');
  const noteRepository = c.get('noteRepository');
  const userRepository = c.get('userRepository');
  const followRepository = c.get('followRepository');
  const activityDeliveryQueue = c.get('activityDeliveryQueue');

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    followRepository,
    activityDeliveryQueue,
  );

  const body = await c.req.json();

  if (!body.noteId) {
    return c.json({ error: 'noteId is required' }, 400);
  }

  if (!body.reaction) {
    return c.json({ error: 'reaction is required' }, 400);
  }

  try {
    const reaction = await reactionService.create({
      userId: user.id,
      noteId: body.noteId,
      reaction: body.reaction,
    });

    return c.json(reaction, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create reaction';
    return c.json({ error: message }, 400);
  }
});

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
reactions.post('/delete', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const reactionRepository = c.get('reactionRepository');
  const noteRepository = c.get('noteRepository');
  const userRepository = c.get('userRepository');
  const followRepository = c.get('followRepository');
  const activityDeliveryQueue = c.get('activityDeliveryQueue');

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    followRepository,
    activityDeliveryQueue,
  );

  const body = await c.req.json();

  if (!body.noteId) {
    return c.json({ error: 'noteId is required' }, 400);
  }

  if (!body.reaction) {
    return c.json({ error: 'reaction is required' }, 400);
  }

  try {
    await reactionService.delete(user.id, body.noteId, body.reaction);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete reaction';
    return c.json({ error: message }, 400);
  }
});

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
reactions.get('/', optionalAuth(), async (c: Context) => {
  const reactionRepository = c.get('reactionRepository');
  const noteRepository = c.get('noteRepository');
  const userRepository = c.get('userRepository');
  const followRepository = c.get('followRepository');
  const activityDeliveryQueue = c.get('activityDeliveryQueue');

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    followRepository,
    activityDeliveryQueue,
  );

  const noteId = c.req.query('noteId');
  const limit = c.req.query('limit')
    ? Number.parseInt(c.req.query('limit')!, 10)
    : undefined;

  if (!noteId) {
    return c.json({ error: 'noteId is required' }, 400);
  }

  try {
    const reactionsList = await reactionService.getReactionsByNote(noteId, limit);
    return c.json(reactionsList);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get reactions';
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
reactions.get('/counts', optionalAuth(), async (c: Context) => {
  const reactionRepository = c.get('reactionRepository');
  const noteRepository = c.get('noteRepository');
  const userRepository = c.get('userRepository');
  const followRepository = c.get('followRepository');
  const activityDeliveryQueue = c.get('activityDeliveryQueue');

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    followRepository,
    activityDeliveryQueue,
  );

  const noteId = c.req.query('noteId');

  if (!noteId) {
    return c.json({ error: 'noteId is required' }, 400);
  }

  try {
    const counts = await reactionService.getReactionCounts(noteId);
    return c.json(counts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get reaction counts';
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
reactions.get('/my-reactions', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const reactionRepository = c.get('reactionRepository');
  const noteRepository = c.get('noteRepository');
  const userRepository = c.get('userRepository');
  const followRepository = c.get('followRepository');
  const activityDeliveryQueue = c.get('activityDeliveryQueue');

  const reactionService = new ReactionService(
    reactionRepository,
    noteRepository,
    userRepository,
    followRepository,
    activityDeliveryQueue,
  );

  const noteId = c.req.query('noteId');

  if (!noteId) {
    return c.json({ error: 'noteId is required' }, 400);
  }

  try {
    const reactions = await reactionService.getUserReactions(user.id, noteId);
    return c.json(reactions);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user reactions';
    return c.json({ error: message }, 400);
  }
});

export default reactions;
