/**
 * Note API Routes
 *
 * Provides endpoints for note management and timeline retrieval.
 *
 * @module routes/notes
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { NoteService } from '../services/NoteService.js';

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
notes.post('/create', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const noteRepository = c.get('noteRepository');
  const driveFileRepository = c.get('driveFileRepository');
  const userRepository = c.get('userRepository');
  const deliveryService = c.get('activityPubDeliveryService');
  const cacheService = c.get('cacheService');

  const followRepository = c.get('followRepository');
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const body = await c.req.json();

  try {
    const note = await noteService.create({
      userId: user.id,
      text: body.text ?? null,
      cw: body.cw ?? null,
      visibility: body.visibility ?? 'public',
      localOnly: body.localOnly ?? false,
      replyId: body.replyId ?? null,
      renoteId: body.renoteId ?? null,
      fileIds: body.fileIds ?? [],
    });

    return c.json(note, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create note';
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/notes/show
 *
 * Get note by ID (Misskey-compatible)
 *
 * @auth Optional
 * @body {string} noteId - Note ID
 * @returns {Note} Note record
 */
notes.post('/show', optionalAuth(), async (c: Context) => {
  const noteRepository = c.get('noteRepository');
  const driveFileRepository = c.get('driveFileRepository');
  const userRepository = c.get('userRepository');
  const deliveryService = c.get('activityPubDeliveryService');
  const cacheService = c.get('cacheService');

  const followRepository = c.get('followRepository');
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
    return c.json({ error: 'noteId is required' }, 400);
  }

  const note = await noteService.findById(noteId);

  if (!note) {
    return c.json({ error: 'Note not found' }, 404);
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
notes.post('/delete', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const noteRepository = c.get('noteRepository');
  const driveFileRepository = c.get('driveFileRepository');
  const userRepository = c.get('userRepository');
  const deliveryService = c.get('activityPubDeliveryService');
  const cacheService = c.get('cacheService');

  const followRepository = c.get('followRepository');
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
    return c.json({ error: 'noteId is required' }, 400);
  }

  try {
    await noteService.delete(body.noteId, user.id);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete note';
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
notes.get('/local-timeline', optionalAuth(), async (c: Context) => {
  const noteRepository = c.get('noteRepository');
  const driveFileRepository = c.get('driveFileRepository');
  const userRepository = c.get('userRepository');
  const deliveryService = c.get('activityPubDeliveryService');
  const cacheService = c.get('cacheService');

  const followRepository = c.get('followRepository');
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const limit = c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : undefined;
  const sinceId = c.req.query('sinceId');
  const untilId = c.req.query('untilId');

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
notes.get('/timeline', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const noteRepository = c.get('noteRepository');
  const driveFileRepository = c.get('driveFileRepository');
  const userRepository = c.get('userRepository');
  const deliveryService = c.get('activityPubDeliveryService');
  const cacheService = c.get('cacheService');

  const followRepository = c.get('followRepository');
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const limit = c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : undefined;
  const sinceId = c.req.query('sinceId');
  const untilId = c.req.query('untilId');

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
notes.get('/social-timeline', optionalAuth(), async (c: Context) => {
  const user = c.get('user');
  const noteRepository = c.get('noteRepository');
  const driveFileRepository = c.get('driveFileRepository');
  const userRepository = c.get('userRepository');
  const deliveryService = c.get('activityPubDeliveryService');
  const cacheService = c.get('cacheService');

  const followRepository = c.get('followRepository');
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const limit = c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : undefined;
  const sinceId = c.req.query('sinceId');
  const untilId = c.req.query('untilId');

  const timeline = await noteService.getSocialTimeline(user?.id ?? null, {
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
notes.get('/user-notes', optionalAuth(), async (c: Context) => {
  const noteRepository = c.get('noteRepository');
  const driveFileRepository = c.get('driveFileRepository');
  const userRepository = c.get('userRepository');
  const deliveryService = c.get('activityPubDeliveryService');
  const cacheService = c.get('cacheService');

  const followRepository = c.get('followRepository');
  const noteService = new NoteService(
    noteRepository,
    driveFileRepository,
    followRepository,
    userRepository,
    deliveryService,
    cacheService,
  );

  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  const limit = c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : undefined;
  const sinceId = c.req.query('sinceId');
  const untilId = c.req.query('untilId');

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
notes.get('/replies', optionalAuth(), async (c: Context) => {
  const noteRepository = c.get('noteRepository');

  const noteId = c.req.query('noteId');

  if (!noteId) {
    return c.json({ error: 'noteId is required' }, 400);
  }

  const limit = c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : 20;
  const sinceId = c.req.query('sinceId');
  const untilId = c.req.query('untilId');

  // Get all replies to this note
  const replies = await noteRepository.findReplies(noteId, {
    limit,
    sinceId,
    untilId,
  });

  // TODO: Implement hydration with user and file data
  return c.json(replies);

});

export default notes;
