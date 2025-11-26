/**
 * ActivityPub Inbox Routes
 *
 * Handles incoming ActivityPub activities from remote servers.
 * Implements server-to-server (S2S) ActivityPub protocol.
 *
 * @module routes/ap/inbox
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { verifySignatureMiddleware } from '../../middleware/verifySignature.js';
import { inboxRateLimit, RateLimitPresets } from '../../middleware/rateLimit.js';
import { getDatabase } from '../../db/index.js';
import { receivedActivities } from '../../db/schema/pg.js';
import {
  validateActivity,
  formatValidationErrors,
  ValidationErrorType,
} from '../../utils/activityValidation.js';
import { getInboxService } from '../../services/ap/inbox/index.js';
import type { Activity } from '../../services/ap/inbox/index.js';

const inbox = new Hono();

/**
 * POST /users/:username/inbox
 *
 * Receives ActivityPub activities from remote servers.
 * All requests must be signed with HTTP Signatures.
 *
 * @param username - Username of the recipient
 * @returns 202 Accepted (activity queued for processing)
 *
 * @example
 * ```bash
 * curl -X POST https://example.com/users/alice/inbox \
 *   -H "Content-Type: application/activity+json" \
 *   -H "Signature: ..." \
 *   -d '{"type":"Follow","actor":"...","object":"..."}'
 * ```
 */
inbox.post('/users/:username/inbox', inboxRateLimit(RateLimitPresets.inbox), verifySignatureMiddleware, async (c: Context) => {
  const { username } = c.req.param();

  // Verify recipient exists
  const userRepository = c.get('userRepository');
  const user = await userRepository.findByUsername(username as string);

  if (!user || user.host !== null) {
    return c.notFound();
  }

  // Parse activity
  let activity: Activity;
  try {
    // Body may have been pre-read by signature verification middleware
    const preReadBody = c.get('requestBody');
    if (preReadBody) {
      activity = JSON.parse(preReadBody);
    } else {
      activity = await c.req.json();
    }
  } catch (error) {
    console.error('Failed to parse activity JSON:', error);
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Enhanced activity validation
  const signatureKeyId = c.get('signatureKeyId');
  const validationResult = validateActivity(activity, signatureKeyId);

  if (!validationResult.valid) {
    console.warn('Activity validation failed:', {
      activity: activity.type,
      actor: activity.actor,
      errors: validationResult.errors,
    });

    // Determine appropriate status code based on error type
    const hasAuthError = validationResult.errors.some(
      e => e.type === ValidationErrorType.ACTOR_MISMATCH
    );
    const statusCode = hasAuthError ? 401 : 422; // Unprocessable Entity

    return c.json(
      {
        error: 'Validation failed',
        message: formatValidationErrors(validationResult.errors),
        details: validationResult.errors,
      },
      statusCode
    );
  }

  console.log(`📥 Inbox: Received ${activity.type} from ${activity.actor} for ${username}`);

  // Check if actor's instance is blocked
  const actorUrl = typeof activity.actor === 'string' ? activity.actor : (activity.actor as { id?: string })?.id;
  if (actorUrl) {
    try {
      const actorHost = new URL(actorUrl).hostname;
      const instanceBlockRepository = c.get('instanceBlockRepository');
      const isBlocked = await instanceBlockRepository.isBlocked(actorHost);

      if (isBlocked) {
        console.log(`🚫 Activity from blocked instance ${actorHost}, rejecting`);
        // Return 202 to not reveal block status to remote (security through obscurity)
        return c.json({ status: 'accepted' }, 202);
      }
    } catch (error) {
      console.error('Instance block check failed:', error);
      // Continue processing if block check fails
    }
  }

  // Check for duplicate activity (deduplication)
  const activityId = activity.id;
  if (activityId) {
    try {
      const db = getDatabase();

      // Check if we've already received this activity
      const existing = await db
        .select()
        .from(receivedActivities)
        .where(eq(receivedActivities.activityId, activityId))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⚠️  Duplicate activity detected (ID: ${activityId}), skipping`);
        return c.json({ status: 'accepted' }, 202);
      }

      // Record this activity as received
      await db.insert(receivedActivities).values({
        activityId,
        receivedAt: new Date(),
      });
    } catch (error) {
      console.error('Deduplication check failed:', error);
      // Continue processing even if deduplication fails
    }
  }

  // Handle activity using InboxService
  try {
    const inboxService = getInboxService();
    await inboxService.handleActivity(c, activity, user.id);
  } catch (error) {
    console.error('Activity handling error:', error);
    // Return 202 even on errors (don't reveal internal errors to remote servers)
  }

  // Always return 202 Accepted
  return c.json({ status: 'accepted' }, 202);
});

export default inbox;
