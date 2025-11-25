/**
 * Following API Routes
 *
 * Provides endpoints for follow/unfollow operations and follower/following list retrieval.
 *
 * @module routes/following
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { FollowService } from '../services/FollowService.js';

const following = new Hono();

/**
 * POST /api/following/create
 *
 * Follow a user
 *
 * @auth Required
 * @body {string} userId - User ID to follow
 * @returns {Follow} Created follow relationship
 */
following.post('/create', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const followRepository = c.get('followRepository');
  const userRepository = c.get('userRepository');

  const followService = new FollowService(followRepository, userRepository);

  const body = await c.req.json();

  if (!body.userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  try {
    const follow = await followService.follow(user.id, body.userId);
    return c.json(follow, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to follow user';
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/following/delete
 *
 * Unfollow a user
 *
 * @auth Required
 * @body {string} userId - User ID to unfollow
 * @returns {void}
 */
following.post('/delete', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const followRepository = c.get('followRepository');
  const userRepository = c.get('userRepository');

  const followService = new FollowService(followRepository, userRepository);

  const body = await c.req.json();

  if (!body.userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  try {
    await followService.unfollow(user.id, body.userId);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unfollow user';
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/following/exists
 *
 * Check if a follow relationship exists
 *
 * @auth Required
 * @query {string} userId - User ID to check if current user is following
 * @returns {object} { exists: boolean }
 */
following.get('/exists', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const followRepository = c.get('followRepository');

  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  try {
    const exists = await followRepository.exists(user.id, userId);
    return c.json({ exists });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check follow status';
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/users/followers
 *
 * Get followers list
 *
 * @query {string} userId - User ID
 * @query {number} [limit=100] - Maximum number of followers to retrieve
 * @returns {Follow[]} List of followers
 */
following.get('/users/followers', async (c: Context) => {
  const followRepository = c.get('followRepository');
  const userRepository = c.get('userRepository');

  const followService = new FollowService(followRepository, userRepository);

  const userId = c.req.query('userId');
  const limit = c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : undefined;

  if (!userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  try {
    const followers = await followService.getFollowers(userId, limit);
    return c.json(followers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get followers';
    return c.json({ error: message }, 400);
  }
});

/**
 * GET /api/users/following
 *
 * Get following list
 *
 * @query {string} userId - User ID
 * @query {number} [limit=100] - Maximum number of following to retrieve
 * @returns {Follow[]} List of following
 */
following.get('/users/following', async (c: Context) => {
  const followRepository = c.get('followRepository');
  const userRepository = c.get('userRepository');

  const followService = new FollowService(followRepository, userRepository);

  const userId = c.req.query('userId');
  const limit = c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : undefined;

  if (!userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  try {
    const following = await followService.getFollowing(userId, limit);
    return c.json(following);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get following';
    return c.json({ error: message }, 400);
  }
});

export default following;
