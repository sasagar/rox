/**
 * Moderator API Routes
 *
 * Provides moderation endpoints for managing reports, users, and notes.
 * All endpoints require moderator authentication (moderator role or admin).
 *
 * @module routes/moderator
 */

import { Hono } from 'hono';
import { requireModeratorRole } from '../middleware/auth.js';

const app = new Hono();

// All moderator routes require moderator authentication
app.use('/*', requireModeratorRole());

// ============================================================================
// Report Management Endpoints
// ============================================================================

/**
 * List Reports
 *
 * GET /api/mod/reports
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
 * GET /api/mod/reports/:id
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
 * POST /api/mod/reports/:id/resolve
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
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const moderator = c.get('user');
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
    moderator!.id,
    body.resolution || '',
    body.status
  );

  // Log moderation action
  await moderationAuditLogRepository.create({
    moderatorId: moderator!.id,
    action: body.status === 'resolved' ? 'resolve_report' : 'reject_report',
    targetType: 'report',
    targetId: id,
    reason: body.resolution || undefined,
    details: {
      reportReason: report.reason,
      reportComment: report.comment,
      targetUserId: report.targetUserId,
      targetNoteId: report.targetNoteId,
    },
  });

  return c.json(updated);
});

// ============================================================================
// Note Moderation Endpoints
// ============================================================================

/**
 * Delete Note (Moderation)
 *
 * DELETE /api/mod/notes/:id
 *
 * Soft-deletes a note as a moderation action.
 * The note is hidden from public view but preserved for audit purposes.
 *
 * Request Body (optional):
 * ```json
 * {
 *   "reason": "Violation of community guidelines"
 * }
 * ```
 */
app.delete('/notes/:id', async (c) => {
  const noteRepository = c.get('noteRepository');
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const moderator = c.get('user');
  const id = c.req.param('id');

  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason as string | undefined;

  const note = await noteRepository.findById(id);
  if (!note) {
    return c.json({ error: 'Note not found' }, 404);
  }

  // Check if already deleted
  if (note.isDeleted) {
    return c.json({ error: 'Note is already deleted' }, 400);
  }

  // Soft-delete the note
  await noteRepository.softDelete(id, moderator!.id, reason);

  // Log moderation action with original content
  await moderationAuditLogRepository.create({
    moderatorId: moderator!.id,
    action: 'delete_note',
    targetType: 'note',
    targetId: id,
    reason,
    details: {
      originalContent: {
        text: note.text,
        cw: note.cw,
        userId: note.userId,
        visibility: note.visibility,
        fileIds: note.fileIds,
        createdAt: note.createdAt,
      },
    },
  });

  return c.json({ success: true, message: 'Note deleted' });
});

/**
 * Restore Deleted Note
 *
 * POST /api/mod/notes/:id/restore
 *
 * Restores a soft-deleted note.
 *
 * Request Body (optional):
 * ```json
 * {
 *   "reason": "False positive, content is acceptable"
 * }
 * ```
 */
app.post('/notes/:id/restore', async (c) => {
  const noteRepository = c.get('noteRepository');
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const moderator = c.get('user');
  const id = c.req.param('id');

  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason as string | undefined;

  const note = await noteRepository.findById(id);
  if (!note) {
    return c.json({ error: 'Note not found' }, 404);
  }

  // Check if actually deleted
  if (!note.isDeleted) {
    return c.json({ error: 'Note is not deleted' }, 400);
  }

  // Restore the note
  const restored = await noteRepository.restore(id);

  // Log moderation action
  await moderationAuditLogRepository.create({
    moderatorId: moderator!.id,
    action: 'restore_note',
    targetType: 'note',
    targetId: id,
    reason,
    details: {
      previouslyDeletedBy: note.deletedById,
      previousDeletionReason: note.deletionReason,
    },
  });

  return c.json({ success: true, message: 'Note restored', note: restored });
});

/**
 * List Deleted Notes
 *
 * GET /api/mod/notes/deleted
 *
 * Returns a paginated list of soft-deleted notes.
 *
 * Query Parameters:
 * - deletedById: Filter by moderator who deleted
 * - limit: Maximum number of notes (default: 100)
 * - offset: Number of notes to skip (default: 0)
 */
app.get('/notes/deleted', async (c) => {
  const noteRepository = c.get('noteRepository');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');
  const deletedById = c.req.query('deletedById');

  const notes = await noteRepository.findDeletedNotes({ limit, offset, deletedById });

  return c.json({ notes, total: notes.length });
});

// ============================================================================
// User Moderation Endpoints
// ============================================================================

/**
 * Suspend User
 *
 * POST /api/mod/users/:id/suspend
 *
 * Suspends a user, preventing them from logging in or performing actions.
 *
 * Request Body:
 * ```json
 * {
 *   "reason": "Repeated violations of community guidelines"
 * }
 * ```
 */
app.post('/users/:id/suspend', async (c) => {
  const userRepository = c.get('userRepository');
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const moderator = c.get('user');
  const userId = c.req.param('id');

  // Prevent self-suspension
  if (userId === moderator?.id) {
    return c.json({ error: 'Cannot suspend yourself' }, 400);
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot suspend admins
  if (user.isAdmin) {
    return c.json({ error: 'Cannot suspend an admin user' }, 400);
  }

  // Check if already suspended
  if (user.isSuspended) {
    return c.json({ error: 'User is already suspended' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason as string | undefined;

  const updatedUser = await userRepository.update(userId, { isSuspended: true });

  // Log moderation action
  await moderationAuditLogRepository.create({
    moderatorId: moderator!.id,
    action: 'suspend_user',
    targetType: 'user',
    targetId: userId,
    reason,
    details: {
      username: user.username,
      host: user.host,
    },
  });

  const { passwordHash: _p, privateKey: _pk, ...userData } = updatedUser;
  return c.json(userData);
});

/**
 * Unsuspend User
 *
 * POST /api/mod/users/:id/unsuspend
 *
 * Removes suspension from a user.
 *
 * Request Body (optional):
 * ```json
 * {
 *   "reason": "Suspension period completed"
 * }
 * ```
 */
app.post('/users/:id/unsuspend', async (c) => {
  const userRepository = c.get('userRepository');
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const moderator = c.get('user');
  const userId = c.req.param('id');

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check if actually suspended
  if (!user.isSuspended) {
    return c.json({ error: 'User is not suspended' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason as string | undefined;

  const updatedUser = await userRepository.update(userId, { isSuspended: false });

  // Log moderation action
  await moderationAuditLogRepository.create({
    moderatorId: moderator!.id,
    action: 'unsuspend_user',
    targetType: 'user',
    targetId: userId,
    reason,
    details: {
      username: user.username,
      host: user.host,
    },
  });

  const { passwordHash: _p, privateKey: _pk, ...userData } = updatedUser;
  return c.json(userData);
});

/**
 * Get User Details for Moderation
 *
 * GET /api/mod/users/:id
 *
 * Returns user details including moderation history.
 */
app.get('/users/:id', async (c) => {
  const userRepository = c.get('userRepository');
  const userReportRepository = c.get('userReportRepository');
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const userId = c.req.param('id');

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get reports against this user
  const reportsAgainst = await userReportRepository.findAll({
    targetUserId: userId,
    limit: 10,
  });
  const reportsAgainstCount = await userReportRepository.count({ targetUserId: userId });

  // Get moderation history for this user
  const moderationHistory = await moderationAuditLogRepository.findByTarget('user', userId, { limit: 20 });

  const { passwordHash: _p, privateKey: _pk, ...userData } = user;

  // Get warnings for this user
  const userWarningRepository = c.get('userWarningRepository');
  const warnings = await userWarningRepository.findByUserId(userId, { limit: 10 });
  const warningsCount = await userWarningRepository.countByUserId(userId);

  return c.json({
    user: userData,
    reports: {
      items: reportsAgainst,
      total: reportsAgainstCount,
    },
    warnings: {
      items: warnings,
      total: warningsCount,
    },
    moderationHistory,
  });
});

// ============================================================================
// User Warning Endpoints
// ============================================================================

/**
 * Issue Warning to User
 *
 * POST /api/mod/users/:id/warn
 *
 * Issues a warning to a user.
 *
 * Request Body:
 * ```json
 * {
 *   "reason": "Violation of community guidelines",
 *   "expiresAt": "2025-12-31T23:59:59Z" // Optional
 * }
 * ```
 */
app.post('/users/:id/warn', async (c) => {
  const userRepository = c.get('userRepository');
  const userWarningRepository = c.get('userWarningRepository');
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const moderator = c.get('user');
  const userId = c.req.param('id');

  // Prevent self-warning
  if (userId === moderator?.id) {
    return c.json({ error: 'Cannot warn yourself' }, 400);
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Cannot warn admins
  if (user.isAdmin) {
    return c.json({ error: 'Cannot warn an admin user' }, 400);
  }

  const body = await c.req.json();

  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    return c.json({ error: 'reason is required' }, 400);
  }

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

  const warning = await userWarningRepository.create({
    userId,
    moderatorId: moderator!.id,
    reason: body.reason.trim(),
    expiresAt,
  });

  // Log moderation action
  await moderationAuditLogRepository.create({
    moderatorId: moderator!.id,
    action: 'warn_user',
    targetType: 'user',
    targetId: userId,
    reason: body.reason.trim(),
    details: {
      username: user.username,
      host: user.host,
      warningId: warning.id,
      expiresAt: expiresAt?.toISOString(),
    },
  });

  return c.json(warning, 201);
});

/**
 * List User Warnings
 *
 * GET /api/mod/users/:id/warnings
 *
 * Returns all warnings for a specific user.
 *
 * Query Parameters:
 * - limit: Maximum number of warnings (default: 100)
 * - offset: Number of warnings to skip (default: 0)
 * - includeExpired: Include expired warnings (default: false)
 */
app.get('/users/:id/warnings', async (c) => {
  const userWarningRepository = c.get('userWarningRepository');
  const userRepository = c.get('userRepository');
  const userId = c.req.param('id');

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');
  const includeExpired = c.req.query('includeExpired') === 'true';

  const warnings = await userWarningRepository.findByUserId(userId, { limit, offset, includeExpired });
  const total = await userWarningRepository.countByUserId(userId, { includeExpired });

  return c.json({ warnings, total });
});

/**
 * List All Warnings
 *
 * GET /api/mod/warnings
 *
 * Returns a paginated list of all user warnings.
 *
 * Query Parameters:
 * - userId: Filter by user
 * - moderatorId: Filter by moderator
 * - limit: Maximum number of warnings (default: 100)
 * - offset: Number of warnings to skip (default: 0)
 * - includeExpired: Include expired warnings (default: false)
 */
app.get('/warnings', async (c) => {
  const userWarningRepository = c.get('userWarningRepository');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');
  const userId = c.req.query('userId');
  const moderatorId = c.req.query('moderatorId');
  const includeExpired = c.req.query('includeExpired') === 'true';

  const warnings = await userWarningRepository.findAll({
    userId,
    moderatorId,
    limit,
    offset,
    includeExpired,
  });
  const total = await userWarningRepository.count();

  return c.json({ warnings, total });
});

/**
 * Delete Warning
 *
 * DELETE /api/mod/warnings/:id
 *
 * Deletes a warning.
 */
app.delete('/warnings/:id', async (c) => {
  const userWarningRepository = c.get('userWarningRepository');
  const id = c.req.param('id');

  const warning = await userWarningRepository.findById(id);
  if (!warning) {
    return c.json({ error: 'Warning not found' }, 404);
  }

  const deleted = await userWarningRepository.delete(id);
  if (!deleted) {
    return c.json({ error: 'Failed to delete warning' }, 500);
  }

  return c.json({ success: true, message: 'Warning deleted' });
});

// ============================================================================
// Audit Log Endpoints
// ============================================================================

/**
 * List Audit Logs
 *
 * GET /api/mod/audit-logs
 *
 * Returns a paginated list of moderation audit logs.
 *
 * Query Parameters:
 * - moderatorId: Filter by moderator
 * - action: Filter by action type
 * - targetType: Filter by target type
 * - limit: Maximum number of logs (default: 100)
 * - offset: Number of logs to skip (default: 0)
 */
app.get('/audit-logs', async (c) => {
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
  const offset = parseInt(c.req.query('offset') || '0');
  const moderatorId = c.req.query('moderatorId');
  const action = c.req.query('action') as any;
  const targetType = c.req.query('targetType') as any;

  const logs = await moderationAuditLogRepository.findAll({
    moderatorId,
    action,
    targetType,
    limit,
    offset,
  });
  const total = await moderationAuditLogRepository.count({
    moderatorId,
    action,
    targetType,
  });

  return c.json({ logs, total });
});

/**
 * Get Audit Log Details
 *
 * GET /api/mod/audit-logs/:id
 *
 * Returns detailed information about a specific audit log entry.
 */
app.get('/audit-logs/:id', async (c) => {
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const userRepository = c.get('userRepository');
  const id = c.req.param('id');

  const log = await moderationAuditLogRepository.findById(id);
  if (!log) {
    return c.json({ error: 'Audit log not found' }, 404);
  }

  // Fetch moderator details
  const moderator = await userRepository.findById(log.moderatorId);

  return c.json({
    ...log,
    moderator: moderator ? { id: moderator.id, username: moderator.username } : null,
  });
});

// ============================================================================
// Instance Block Endpoints
// ============================================================================

/**
 * List Blocked Instances
 *
 * GET /api/mod/instance-blocks
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
 * GET /api/mod/instance-blocks/check
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
 * POST /api/mod/instance-blocks
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
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const moderator = c.get('user');

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
    blockedById: moderator!.id,
  });

  // Log moderation action
  await moderationAuditLogRepository.create({
    moderatorId: moderator!.id,
    action: 'block_instance',
    targetType: 'instance',
    targetId: host,
    reason: body.reason || undefined,
  });

  return c.json(block, 201);
});

/**
 * Unblock an Instance
 *
 * DELETE /api/mod/instance-blocks/:host
 *
 * Removes an instance from the block list.
 *
 * Request Body (optional):
 * ```json
 * {
 *   "reason": "Block was applied in error"
 * }
 * ```
 */
app.delete('/instance-blocks/:host', async (c) => {
  const instanceBlockRepository = c.get('instanceBlockRepository');
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const moderator = c.get('user');
  const host = c.req.param('host');

  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason as string | undefined;

  // Get block details before deletion for audit log
  const block = await instanceBlockRepository.findByHost(host);
  if (!block) {
    return c.json({ error: `Instance ${host} is not blocked` }, 404);
  }

  const deleted = await instanceBlockRepository.deleteByHost(host);
  if (!deleted) {
    return c.json({ error: `Failed to unblock instance ${host}` }, 500);
  }

  // Log moderation action
  await moderationAuditLogRepository.create({
    moderatorId: moderator!.id,
    action: 'unblock_instance',
    targetType: 'instance',
    targetId: host,
    reason,
    details: {
      previousReason: block.reason,
      blockedAt: block.createdAt,
    },
  });

  return c.json({ success: true, message: `Instance ${host} has been unblocked` });
});

// ============================================================================
// Statistics Endpoint
// ============================================================================

/**
 * Get Moderation Statistics
 *
 * GET /api/mod/stats
 *
 * Returns moderation statistics.
 */
app.get('/stats', async (c) => {
  const userReportRepository = c.get('userReportRepository');
  const moderationAuditLogRepository = c.get('moderationAuditLogRepository');
  const userRepository = c.get('userRepository');
  const instanceBlockRepository = c.get('instanceBlockRepository');

  const [
    pendingReports,
    totalReports,
    resolvedReports,
    rejectedReports,
    totalAuditLogs,
    suspendedUsers,
    blockedInstances,
  ] = await Promise.all([
    userReportRepository.count({ status: 'pending' }),
    userReportRepository.count({}),
    userReportRepository.count({ status: 'resolved' }),
    userReportRepository.count({ status: 'rejected' }),
    moderationAuditLogRepository.count({}),
    userRepository.count(false).then(async () => {
      // Count suspended users - this is a workaround since we don't have a direct filter
      const users = await userRepository.findAll({ isSuspended: true, limit: 10000 });
      return users.length;
    }),
    instanceBlockRepository.count(),
  ]);

  return c.json({
    reports: {
      pending: pendingReports,
      resolved: resolvedReports,
      rejected: rejectedReports,
      total: totalReports,
    },
    auditLogs: {
      total: totalAuditLogs,
    },
    users: {
      suspended: suspendedUsers,
    },
    instances: {
      blocked: blockedInstances,
    },
  });
});

export default app;
