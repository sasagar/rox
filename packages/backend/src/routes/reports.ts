/**
 * User Report API Routes
 *
 * Provides endpoints for users to report content and other users.
 *
 * @module routes/reports
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit, RateLimitPresets } from '../middleware/rateLimit.js';

const app = new Hono();

/**
 * Report reasons
 */
const VALID_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'nsfw',
  'impersonation',
  'copyright',
  'other',
] as const;

/**
 * Create Report
 *
 * POST /api/reports
 *
 * Creates a new report about a user or note.
 *
 * Request Body:
 * ```json
 * {
 *   "targetUserId": "user123", // optional if targetNoteId provided
 *   "targetNoteId": "note456", // optional if targetUserId provided
 *   "reason": "spam", // required
 *   "comment": "Additional details..." // optional
 * }
 * ```
 */
app.post('/', requireAuth(), rateLimit(RateLimitPresets.api), async (c) => {
  const user = c.get('user');
  const userReportRepository = c.get('userReportRepository');
  const userRepository = c.get('userRepository');
  const noteRepository = c.get('noteRepository');

  const body = await c.req.json();

  // Validate reason
  if (!body.reason || !VALID_REASONS.includes(body.reason)) {
    return c.json({
      error: `reason must be one of: ${VALID_REASONS.join(', ')}`,
    }, 400);
  }

  // Must have at least one target
  if (!body.targetUserId && !body.targetNoteId) {
    return c.json({ error: 'Either targetUserId or targetNoteId is required' }, 400);
  }

  // Validate target user exists
  if (body.targetUserId) {
    const targetUser = await userRepository.findById(body.targetUserId);
    if (!targetUser) {
      return c.json({ error: 'Target user not found' }, 404);
    }
    // Cannot report yourself
    if (targetUser.id === user!.id) {
      return c.json({ error: 'Cannot report yourself' }, 400);
    }
  }

  // Validate target note exists
  if (body.targetNoteId) {
    const targetNote = await noteRepository.findById(body.targetNoteId);
    if (!targetNote) {
      return c.json({ error: 'Target note not found' }, 404);
    }
    // Cannot report your own notes
    if (targetNote.userId === user!.id) {
      return c.json({ error: 'Cannot report your own content' }, 400);
    }
  }

  // Check for duplicate report
  const alreadyReported = await userReportRepository.hasReported(
    user!.id,
    body.targetUserId,
    body.targetNoteId
  );
  if (alreadyReported) {
    return c.json({ error: 'You have already reported this' }, 409);
  }

  const report = await userReportRepository.create({
    reporterId: user!.id,
    targetUserId: body.targetUserId || undefined,
    targetNoteId: body.targetNoteId || undefined,
    reason: body.reason,
    comment: body.comment || undefined,
  });

  return c.json({
    id: report.id,
    message: 'Report submitted successfully. Thank you for helping keep our community safe.',
  }, 201);
});

/**
 * Get Valid Report Reasons
 *
 * GET /api/reports/reasons
 *
 * Returns the list of valid report reasons.
 */
app.get('/reasons', (c) => {
  return c.json({
    reasons: VALID_REASONS.map((reason) => ({
      value: reason,
      label: reason.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    })),
  });
});

export default app;
