/**
 * Admin API Routes
 *
 * Provides administrative endpoints for managing users and instance blocks.
 * All endpoints require admin authentication.
 *
 * @module routes/admin
 */

import { Hono } from 'hono';
import { requireAdmin } from '../middleware/auth.js';

const app = new Hono();

// All admin routes require admin authentication
app.use('/*', requireAdmin());

// ============================================================================
// User Management Endpoints
// ============================================================================

/**
 * List Users
 *
 * GET /api/admin/users
 *
 * Returns a paginated list of users with optional filters.
 *
 * Query Parameters:
 * - limit: Maximum number of users (default: 100, max: 1000)
 * - offset: Number of users to skip (default: 0)
 * - localOnly: Filter to local users only (default: false)
 * - isAdmin: Filter by admin status (optional)
 * - isSuspended: Filter by suspended status (optional)
 *
 * Response (200):
 * ```json
 * {
 *   "users": [...],
 *   "total": 150
 * }
 * ```
 */
app.get('/users', async (c) => {
  const userRepository = c.get('userRepository');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');
  const localOnly = c.req.query('localOnly') === 'true';
  const isAdmin = c.req.query('isAdmin') !== undefined
    ? c.req.query('isAdmin') === 'true'
    : undefined;
  const isSuspended = c.req.query('isSuspended') !== undefined
    ? c.req.query('isSuspended') === 'true'
    : undefined;

  const users = await userRepository.findAll({
    limit,
    offset,
    localOnly,
    isAdmin,
    isSuspended,
  });

  const total = await userRepository.count(localOnly);

  // Remove sensitive data
  const sanitizedUsers = users.map((user: any) => {
    const { passwordHash: _p, privateKey: _pk, ...publicUser } = user;
    return publicUser;
  });

  return c.json({ users: sanitizedUsers, total });
});

/**
 * Get User Details
 *
 * GET /api/admin/users/:id
 *
 * Returns detailed information about a specific user including admin fields.
 */
app.get('/users/:id', async (c) => {
  const userRepository = c.get('userRepository');
  const userId = c.req.param('id');

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Remove password hash but keep other admin-relevant info
  const { passwordHash: _p, privateKey: _pk, ...userData } = user;
  return c.json(userData);
});

/**
 * Update User Admin Status
 *
 * POST /api/admin/users/:id/admin
 *
 * Grants or revokes admin privileges for a user.
 *
 * Request Body:
 * ```json
 * {
 *   "isAdmin": true
 * }
 * ```
 */
app.post('/users/:id/admin', async (c) => {
  const userRepository = c.get('userRepository');
  const currentAdmin = c.get('user');
  const userId = c.req.param('id');

  // Prevent self-demotion
  if (userId === currentAdmin?.id) {
    return c.json({ error: 'Cannot change your own admin status' }, 400);
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot modify remote users
  if (user.host !== null) {
    return c.json({ error: 'Cannot modify remote user admin status' }, 400);
  }

  const body = await c.req.json();
  if (typeof body.isAdmin !== 'boolean') {
    return c.json({ error: 'isAdmin must be a boolean' }, 400);
  }

  const updatedUser = await userRepository.update(userId, { isAdmin: body.isAdmin });

  const { passwordHash: _p, privateKey: _pk, ...userData } = updatedUser;
  return c.json(userData);
});

/**
 * Suspend User
 *
 * POST /api/admin/users/:id/suspend
 *
 * Suspends a user, preventing them from logging in or performing actions.
 *
 * Request Body:
 * ```json
 * {
 *   "isSuspended": true
 * }
 * ```
 */
app.post('/users/:id/suspend', async (c) => {
  const userRepository = c.get('userRepository');
  const currentAdmin = c.get('user');
  const userId = c.req.param('id');

  // Prevent self-suspension
  if (userId === currentAdmin?.id) {
    return c.json({ error: 'Cannot suspend yourself' }, 400);
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot suspend other admins
  if (user.isAdmin) {
    return c.json({ error: 'Cannot suspend an admin user. Remove admin status first.' }, 400);
  }

  const body = await c.req.json();
  if (typeof body.isSuspended !== 'boolean') {
    return c.json({ error: 'isSuspended must be a boolean' }, 400);
  }

  const updatedUser = await userRepository.update(userId, { isSuspended: body.isSuspended });

  const { passwordHash: _p, privateKey: _pk, ...userData } = updatedUser;
  return c.json(userData);
});

/**
 * Delete User
 *
 * DELETE /api/admin/users/:id
 *
 * Permanently deletes a user and all associated data.
 * Use with caution - this cannot be undone.
 */
app.delete('/users/:id', async (c) => {
  const userRepository = c.get('userRepository');
  const currentAdmin = c.get('user');
  const userId = c.req.param('id');

  // Prevent self-deletion
  if (userId === currentAdmin?.id) {
    return c.json({ error: 'Cannot delete yourself' }, 400);
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot delete other admins
  if (user.isAdmin) {
    return c.json({ error: 'Cannot delete an admin user. Remove admin status first.' }, 400);
  }

  await userRepository.delete(userId);

  return c.json({ success: true, message: `User ${user.username} has been deleted` });
});

// ============================================================================
// Instance Block Management Endpoints
// ============================================================================

/**
 * List Blocked Instances
 *
 * GET /api/admin/instance-blocks
 *
 * Returns a paginated list of blocked instances.
 *
 * Query Parameters:
 * - limit: Maximum number of blocks (default: 100)
 * - offset: Number of blocks to skip (default: 0)
 */
app.get('/instance-blocks', async (c) => {
  const instanceBlockRepository = c.get('instanceBlockRepository');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');

  const blocks = await instanceBlockRepository.findAll(limit, offset);
  const total = await instanceBlockRepository.count();

  return c.json({ blocks, total });
});

/**
 * Check if Instance is Blocked
 *
 * GET /api/admin/instance-blocks/check
 *
 * Checks if a specific instance host is blocked.
 *
 * Query Parameters:
 * - host: Instance hostname to check
 */
app.get('/instance-blocks/check', async (c) => {
  const instanceBlockRepository = c.get('instanceBlockRepository');
  const host = c.req.query('host');

  if (!host) {
    return c.json({ error: 'host parameter is required' }, 400);
  }

  const isBlocked = await instanceBlockRepository.isBlocked(host);
  const block = isBlocked ? await instanceBlockRepository.findByHost(host) : null;

  return c.json({ host, isBlocked, block });
});

/**
 * Block an Instance
 *
 * POST /api/admin/instance-blocks
 *
 * Adds a new instance to the block list.
 *
 * Request Body:
 * ```json
 * {
 *   "host": "spam.instance.com",
 *   "reason": "Spam and harassment"
 * }
 * ```
 */
app.post('/instance-blocks', async (c) => {
  const instanceBlockRepository = c.get('instanceBlockRepository');
  const admin = c.get('user');

  const body = await c.req.json();

  if (!body.host || typeof body.host !== 'string') {
    return c.json({ error: 'host is required' }, 400);
  }

  // Normalize hostname (lowercase, no protocol)
  const host = body.host.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  // Check if already blocked
  const existing = await instanceBlockRepository.findByHost(host);
  if (existing) {
    return c.json({ error: `Instance ${host} is already blocked` }, 409);
  }

  const block = await instanceBlockRepository.create({
    host,
    reason: body.reason || null,
    blockedById: admin!.id,
  });

  return c.json(block, 201);
});

/**
 * Unblock an Instance
 *
 * DELETE /api/admin/instance-blocks/:host
 *
 * Removes an instance from the block list.
 */
app.delete('/instance-blocks/:host', async (c) => {
  const instanceBlockRepository = c.get('instanceBlockRepository');
  const host = c.req.param('host');

  const deleted = await instanceBlockRepository.deleteByHost(host);
  if (!deleted) {
    return c.json({ error: `Instance ${host} is not blocked` }, 404);
  }

  return c.json({ success: true, message: `Instance ${host} has been unblocked` });
});

// ============================================================================
// Instance Statistics
// ============================================================================

/**
 * Get Instance Statistics
 *
 * GET /api/admin/stats
 *
 * Returns various statistics about the instance.
 */
app.get('/stats', async (c) => {
  const userRepository = c.get('userRepository');
  const noteRepository = c.get('noteRepository');
  const instanceBlockRepository = c.get('instanceBlockRepository');

  const [
    totalUsers,
    localUsers,
    totalNotes,
    blockedInstances,
  ] = await Promise.all([
    userRepository.count(false),
    userRepository.count(true),
    noteRepository.count(),
    instanceBlockRepository.count(),
  ]);

  return c.json({
    users: {
      total: totalUsers,
      local: localUsers,
      remote: totalUsers - localUsers,
    },
    notes: {
      total: totalNotes,
    },
    federation: {
      blockedInstances,
    },
  });
});

export default app;
