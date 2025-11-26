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
// Invitation Code Management Endpoints
// ============================================================================

/**
 * Generate a random invitation code
 */
const generateInvitationCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * List Invitation Codes
 *
 * GET /api/admin/invitations
 *
 * Returns a paginated list of invitation codes.
 */
app.get('/invitations', async (c) => {
  const invitationCodeRepository = c.get('invitationCodeRepository');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');

  const codes = await invitationCodeRepository.findAll(limit, offset);
  const total = await invitationCodeRepository.count();
  const unused = await invitationCodeRepository.countUnused();

  return c.json({ codes, total, unused });
});

/**
 * Create Invitation Code
 *
 * POST /api/admin/invitations
 *
 * Creates a new invitation code.
 *
 * Request Body:
 * ```json
 * {
 *   "code": "CUSTOM123", // optional, auto-generated if not provided
 *   "expiresAt": "2025-12-31T23:59:59Z", // optional
 *   "maxUses": 1 // optional, default 1
 * }
 * ```
 */
app.post('/invitations', async (c) => {
  const invitationCodeRepository = c.get('invitationCodeRepository');
  const admin = c.get('user');

  const body = await c.req.json().catch(() => ({}));

  const code = body.code?.toUpperCase() || generateInvitationCode();

  // Check if code already exists
  const existing = await invitationCodeRepository.findByCode(code);
  if (existing) {
    return c.json({ error: 'Invitation code already exists' }, 409);
  }

  const invitation = await invitationCodeRepository.create({
    code,
    createdById: admin!.id,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    maxUses: body.maxUses || 1,
  });

  return c.json(invitation, 201);
});

/**
 * Delete Invitation Code
 *
 * DELETE /api/admin/invitations/:id
 *
 * Deletes an invitation code.
 */
app.delete('/invitations/:id', async (c) => {
  const invitationCodeRepository = c.get('invitationCodeRepository');
  const id = c.req.param('id');

  const deleted = await invitationCodeRepository.delete(id);
  if (!deleted) {
    return c.json({ error: 'Invitation code not found' }, 404);
  }

  return c.json({ success: true, message: 'Invitation code deleted' });
});

// ============================================================================
// User Report Management Endpoints
// ============================================================================

/**
 * List Reports
 *
 * GET /api/admin/reports
 *
 * Returns a paginated list of user reports.
 *
 * Query Parameters:
 * - status: Filter by status (pending, resolved, rejected)
 * - limit: Maximum number of reports (default: 100)
 * - offset: Number of reports to skip (default: 0)
 */
app.get('/reports', async (c) => {
  const userReportRepository = c.get('userReportRepository');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');
  const status = c.req.query('status') as 'pending' | 'resolved' | 'rejected' | undefined;

  const reports = await userReportRepository.findAll({ status, limit, offset });
  const total = await userReportRepository.count({ status });
  const pendingCount = await userReportRepository.count({ status: 'pending' });

  return c.json({ reports, total, pendingCount });
});

/**
 * Get Report Details
 *
 * GET /api/admin/reports/:id
 *
 * Returns detailed information about a specific report.
 */
app.get('/reports/:id', async (c) => {
  const userReportRepository = c.get('userReportRepository');
  const userRepository = c.get('userRepository');
  const noteRepository = c.get('noteRepository');
  const id = c.req.param('id');

  const report = await userReportRepository.findById(id);
  if (!report) {
    return c.json({ error: 'Report not found' }, 404);
  }

  // Fetch related data
  const [reporter, targetUser, targetNote] = await Promise.all([
    userRepository.findById(report.reporterId),
    report.targetUserId ? userRepository.findById(report.targetUserId) : null,
    report.targetNoteId ? noteRepository.findById(report.targetNoteId) : null,
  ]);

  return c.json({
    ...report,
    reporter: reporter ? { id: reporter.id, username: reporter.username } : null,
    targetUser: targetUser ? { id: targetUser.id, username: targetUser.username, host: targetUser.host } : null,
    targetNote: targetNote ? { id: targetNote.id, text: targetNote.text } : null,
  });
});

/**
 * Resolve Report
 *
 * POST /api/admin/reports/:id/resolve
 *
 * Resolves or rejects a report.
 *
 * Request Body:
 * ```json
 * {
 *   "status": "resolved", // or "rejected"
 *   "resolution": "User has been warned"
 * }
 * ```
 */
app.post('/reports/:id/resolve', async (c) => {
  const userReportRepository = c.get('userReportRepository');
  const admin = c.get('user');
  const id = c.req.param('id');

  const body = await c.req.json();

  if (!['resolved', 'rejected'].includes(body.status)) {
    return c.json({ error: 'status must be "resolved" or "rejected"' }, 400);
  }

  const report = await userReportRepository.findById(id);
  if (!report) {
    return c.json({ error: 'Report not found' }, 404);
  }

  if (report.status !== 'pending') {
    return c.json({ error: 'Report has already been processed' }, 400);
  }

  const updated = await userReportRepository.resolve(
    id,
    admin!.id,
    body.resolution || '',
    body.status
  );

  return c.json(updated);
});

/**
 * Delete Note (Moderation)
 *
 * DELETE /api/admin/notes/:id
 *
 * Deletes a note as a moderation action.
 */
app.delete('/notes/:id', async (c) => {
  const noteRepository = c.get('noteRepository');
  const id = c.req.param('id');

  const note = await noteRepository.findById(id);
  if (!note) {
    return c.json({ error: 'Note not found' }, 404);
  }

  await noteRepository.delete(id);

  return c.json({ success: true, message: 'Note deleted' });
});

// ============================================================================
// Role Management Endpoints
// ============================================================================

/**
 * List Roles
 *
 * GET /api/admin/roles
 *
 * Returns all roles.
 */
app.get('/roles', async (c) => {
  const roleRepository = c.get('roleRepository');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');

  const roles = await roleRepository.findAll(limit, offset);
  const total = await roleRepository.count();

  return c.json({ roles, total });
});

/**
 * Get Role Details
 *
 * GET /api/admin/roles/:id
 */
app.get('/roles/:id', async (c) => {
  const roleRepository = c.get('roleRepository');
  const id = c.req.param('id');

  const role = await roleRepository.findById(id);
  if (!role) {
    return c.json({ error: 'Role not found' }, 404);
  }

  return c.json(role);
});

/**
 * Create Role
 *
 * POST /api/admin/roles
 *
 * Request Body:
 * ```json
 * {
 *   "name": "Inviter",
 *   "description": "Can invite new users",
 *   "color": "#3498db",
 *   "policies": {
 *     "canInvite": true,
 *     "inviteLimit": 10
 *   }
 * }
 * ```
 */
app.post('/roles', async (c) => {
  const roleRepository = c.get('roleRepository');

  const body = await c.req.json();

  if (!body.name || typeof body.name !== 'string') {
    return c.json({ error: 'name is required' }, 400);
  }

  // Check if name already exists
  const existing = await roleRepository.findByName(body.name);
  if (existing) {
    return c.json({ error: 'Role with this name already exists' }, 409);
  }

  const role = await roleRepository.create({
    name: body.name,
    description: body.description,
    color: body.color,
    iconUrl: body.iconUrl,
    displayOrder: body.displayOrder,
    isPublic: body.isPublic ?? false,
    isDefault: body.isDefault ?? false,
    isAdminRole: body.isAdminRole ?? false,
    isModeratorRole: body.isModeratorRole ?? false,
    policies: body.policies ?? {},
  });

  return c.json(role, 201);
});

/**
 * Update Role
 *
 * PATCH /api/admin/roles/:id
 */
app.patch('/roles/:id', async (c) => {
  const roleRepository = c.get('roleRepository');
  const id = c.req.param('id');

  const role = await roleRepository.findById(id);
  if (!role) {
    return c.json({ error: 'Role not found' }, 404);
  }

  const body = await c.req.json();

  // Check name uniqueness if changing name
  if (body.name && body.name !== role.name) {
    const existing = await roleRepository.findByName(body.name);
    if (existing) {
      return c.json({ error: 'Role with this name already exists' }, 409);
    }
  }

  const updated = await roleRepository.update(id, {
    name: body.name,
    description: body.description,
    color: body.color,
    iconUrl: body.iconUrl,
    displayOrder: body.displayOrder,
    isPublic: body.isPublic,
    isDefault: body.isDefault,
    isAdminRole: body.isAdminRole,
    isModeratorRole: body.isModeratorRole,
    policies: body.policies,
  });

  return c.json(updated);
});

/**
 * Delete Role
 *
 * DELETE /api/admin/roles/:id
 */
app.delete('/roles/:id', async (c) => {
  const roleRepository = c.get('roleRepository');
  const id = c.req.param('id');

  const role = await roleRepository.findById(id);
  if (!role) {
    return c.json({ error: 'Role not found' }, 404);
  }

  // Don't allow deleting built-in roles
  if (role.name === 'Admin' || role.name === 'Moderator') {
    return c.json({ error: 'Cannot delete built-in roles' }, 400);
  }

  await roleRepository.delete(id);

  return c.json({ success: true, message: `Role "${role.name}" deleted` });
});

/**
 * Assign Role to User
 *
 * POST /api/admin/roles/:roleId/assign
 *
 * Request Body:
 * ```json
 * {
 *   "userId": "user123",
 *   "expiresAt": "2025-12-31T23:59:59Z" // optional
 * }
 * ```
 */
app.post('/roles/:roleId/assign', async (c) => {
  const roleRepository = c.get('roleRepository');
  const roleService = c.get('roleService');
  const admin = c.get('user');
  const roleId = c.req.param('roleId');

  const role = await roleRepository.findById(roleId);
  if (!role) {
    return c.json({ error: 'Role not found' }, 404);
  }

  const body = await c.req.json();
  if (!body.userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

  await roleService.assignRole(body.userId, roleId, admin?.id, expiresAt);

  return c.json({ success: true, message: `Role "${role.name}" assigned to user` });
});

/**
 * Unassign Role from User
 *
 * POST /api/admin/roles/:roleId/unassign
 *
 * Request Body:
 * ```json
 * {
 *   "userId": "user123"
 * }
 * ```
 */
app.post('/roles/:roleId/unassign', async (c) => {
  const roleRepository = c.get('roleRepository');
  const roleService = c.get('roleService');
  const roleId = c.req.param('roleId');

  const role = await roleRepository.findById(roleId);
  if (!role) {
    return c.json({ error: 'Role not found' }, 404);
  }

  const body = await c.req.json();
  if (!body.userId) {
    return c.json({ error: 'userId is required' }, 400);
  }

  const removed = await roleService.unassignRole(body.userId, roleId);
  if (!removed) {
    return c.json({ error: 'User does not have this role' }, 404);
  }

  return c.json({ success: true, message: `Role "${role.name}" removed from user` });
});

/**
 * Get User's Roles
 *
 * GET /api/admin/users/:userId/roles
 */
app.get('/users/:userId/roles', async (c) => {
  const userRepository = c.get('userRepository');
  const roleService = c.get('roleService');
  const userId = c.req.param('userId');

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const roles = await roleService.getUserRoles(userId);
  const policies = await roleService.getEffectivePolicies(userId);

  return c.json({ roles, effectivePolicies: policies });
});

// ============================================================================
// Instance Settings Endpoints
// ============================================================================

/**
 * Get Instance Settings
 *
 * GET /api/admin/settings
 *
 * Returns all instance settings.
 */
app.get('/settings', async (c) => {
  const instanceSettingsService = c.get('instanceSettingsService');

  const [registration, metadata] = await Promise.all([
    instanceSettingsService.getRegistrationSettings(),
    instanceSettingsService.getInstanceMetadata(),
  ]);

  return c.json({
    registration,
    instance: metadata,
  });
});

/**
 * Update Registration Settings
 *
 * PATCH /api/admin/settings/registration
 *
 * Request Body:
 * ```json
 * {
 *   "enabled": true,
 *   "inviteOnly": false,
 *   "approvalRequired": false
 * }
 * ```
 */
app.patch('/settings/registration', async (c) => {
  const instanceSettingsService = c.get('instanceSettingsService');
  const admin = c.get('user');

  const body = await c.req.json();

  await instanceSettingsService.updateRegistrationSettings(
    {
      enabled: body.enabled,
      inviteOnly: body.inviteOnly,
      approvalRequired: body.approvalRequired,
    },
    admin?.id
  );

  const settings = await instanceSettingsService.getRegistrationSettings();
  return c.json(settings);
});

/**
 * Update Instance Metadata
 *
 * PATCH /api/admin/settings/instance
 *
 * Request Body:
 * ```json
 * {
 *   "name": "My Instance",
 *   "description": "A cool ActivityPub server",
 *   "maintainerEmail": "admin@example.com"
 * }
 * ```
 */
app.patch('/settings/instance', async (c) => {
  const instanceSettingsService = c.get('instanceSettingsService');
  const admin = c.get('user');

  const body = await c.req.json();

  await instanceSettingsService.updateInstanceMetadata(
    {
      name: body.name,
      description: body.description,
      maintainerEmail: body.maintainerEmail,
      iconUrl: body.iconUrl,
      bannerUrl: body.bannerUrl,
      tosUrl: body.tosUrl,
      privacyPolicyUrl: body.privacyPolicyUrl,
    },
    admin?.id
  );

  const metadata = await instanceSettingsService.getInstanceMetadata();
  return c.json(metadata);
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
  const invitationCodeRepository = c.get('invitationCodeRepository');
  const userReportRepository = c.get('userReportRepository');

  const [
    totalUsers,
    localUsers,
    totalNotes,
    blockedInstances,
    totalInvitations,
    unusedInvitations,
    pendingReports,
  ] = await Promise.all([
    userRepository.count(false),
    userRepository.count(true),
    noteRepository.count(),
    instanceBlockRepository.count(),
    invitationCodeRepository.count(),
    invitationCodeRepository.countUnused(),
    userReportRepository.count({ status: 'pending' }),
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
    invitations: {
      total: totalInvitations,
      unused: unusedInvitations,
    },
    moderation: {
      pendingReports,
    },
  });
});

export default app;
