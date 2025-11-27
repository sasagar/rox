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

  return c.json({
    user: userData,
    reports: {
      items: reportsAgainst,
      total: reportsAgainstCount,
    },
    moderationHistory,
  });
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

  const [
    pendingReports,
    totalReports,
    resolvedReports,
    rejectedReports,
    totalAuditLogs,
    suspendedUsers,
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
  });
});

export default app;
