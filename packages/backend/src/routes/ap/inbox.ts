/**
 * ActivityPub Inbox Routes
 *
 * Handles incoming ActivityPub activities from remote servers.
 * Implements server-to-server (S2S) ActivityPub protocol.
 *
 * @module routes/ap/inbox
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { verifySignatureMiddleware } from "../../middleware/verifySignature.js";
import { inboxRateLimit, RateLimitPresets } from "../../middleware/rateLimit.js";
import { getDatabase } from "../../db/index.js";
import { receivedActivities } from "../../db/schema/pg.js";
import {
  validateActivity,
  formatValidationErrors,
  ValidationErrorType,
} from "../../utils/activityValidation.js";
import { getInboxService } from "../../services/ap/inbox/index.js";
import type { Activity } from "../../services/ap/inbox/index.js";
import { logger } from "../../lib/logger.js";

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
inbox.post(
  "/users/:username/inbox",
  inboxRateLimit(RateLimitPresets.inbox),
  verifySignatureMiddleware,
  async (c: Context) => {
    const { username } = c.req.param();

    // Verify recipient exists
    const userRepository = c.get("userRepository");
    const user = await userRepository.findByUsername(username as string);

    if (!user || user.host !== null) {
      return c.notFound();
    }

    // Parse activity
    let activity: Activity;
    try {
      // Body may have been pre-read by signature verification middleware
      const preReadBody = c.get("requestBody");
      if (preReadBody) {
        activity = JSON.parse(preReadBody);
      } else {
        activity = await c.req.json();
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to parse activity JSON");
      return c.json({ error: "Invalid JSON" }, 400);
    }

    // Enhanced activity validation
    const signatureKeyId = c.get("signatureKeyId");
    const validationResult = validateActivity(activity, signatureKeyId);

    if (!validationResult.valid) {
      logger.warn(
        { activityType: activity.type, actor: activity.actor, errors: validationResult.errors },
        "Activity validation failed",
      );

      // Determine appropriate status code based on error type
      const hasAuthError = validationResult.errors.some(
        (e) => e.type === ValidationErrorType.ACTOR_MISMATCH,
      );
      const statusCode = hasAuthError ? 401 : 422; // Unprocessable Entity

      return c.json(
        {
          error: "Validation failed",
          message: formatValidationErrors(validationResult.errors),
          details: validationResult.errors,
        },
        statusCode,
      );
    }

    logger.info(
      {
        activityType: activity.type,
        actor: activity.actor,
        username,
        activityId: activity.id,
        objectType: typeof activity.object === "object" ? (activity.object as { type?: string })?.type : "string",
      },
      "Inbox received activity",
    );

    // Check if actor's instance is blocked
    const actorUrl =
      typeof activity.actor === "string" ? activity.actor : (activity.actor as { id?: string })?.id;
    if (actorUrl) {
      try {
        const actorHost = new URL(actorUrl).hostname;
        const instanceBlockRepository = c.get("instanceBlockRepository");
        const isBlocked = await instanceBlockRepository.isBlocked(actorHost);

        if (isBlocked) {
          logger.debug({ actorHost }, "Activity from blocked instance, rejecting");
          // Return 202 to not reveal block status to remote (security through obscurity)
          return c.json({ status: "accepted" }, 202);
        }
      } catch (error) {
        logger.error({ err: error }, "Instance block check failed");
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
          logger.debug({ activityId }, "Duplicate activity detected, skipping");
          return c.json({ status: "accepted" }, 202);
        }

        // Record this activity as received
        await db.insert(receivedActivities).values({
          activityId,
          receivedAt: new Date(),
        });
      } catch (error) {
        logger.error({ err: error }, "Deduplication check failed");
        // Continue processing even if deduplication fails
      }
    }

    // Handle activity using InboxService (async, don't wait)
    // Return 202 immediately and process in background to avoid timeout
    const inboxService = getInboxService();
    inboxService.handleActivity(c, activity, user.id).catch((error) => {
      logger.error({ err: error, activityType: activity.type, actor: activity.actor }, "Activity handling error");
    });

    // Return 202 Accepted immediately
    return c.json({ status: "accepted" }, 202);
  },
);

/**
 * POST /inbox
 *
 * Shared inbox endpoint for receiving ActivityPub activities.
 * Many servers prefer to use a shared inbox for efficiency.
 * All requests must be signed with HTTP Signatures.
 *
 * @returns 202 Accepted (activity queued for processing)
 */
inbox.post(
  "/inbox",
  inboxRateLimit(RateLimitPresets.inbox),
  verifySignatureMiddleware,
  async (c: Context) => {
    // Parse activity
    let activity: Activity;
    try {
      // Body may have been pre-read by signature verification middleware
      const preReadBody = c.get("requestBody");
      if (preReadBody) {
        activity = JSON.parse(preReadBody);
      } else {
        activity = await c.req.json();
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to parse activity JSON in shared inbox");
      return c.json({ error: "Invalid JSON" }, 400);
    }

    // Enhanced activity validation
    const signatureKeyId = c.get("signatureKeyId");
    const validationResult = validateActivity(activity, signatureKeyId);

    if (!validationResult.valid) {
      logger.warn(
        { activityType: activity.type, actor: activity.actor, errors: validationResult.errors },
        "Shared inbox activity validation failed",
      );

      const hasAuthError = validationResult.errors.some(
        (e) => e.type === ValidationErrorType.ACTOR_MISMATCH,
      );
      const statusCode = hasAuthError ? 401 : 422;

      return c.json(
        {
          error: "Validation failed",
          message: formatValidationErrors(validationResult.errors),
          details: validationResult.errors,
        },
        statusCode,
      );
    }

    logger.info(
      {
        activityType: activity.type,
        actor: activity.actor,
        endpoint: "shared",
        activityId: activity.id,
        objectType: typeof activity.object === "object" ? (activity.object as { type?: string })?.type : "string",
      },
      "Shared inbox received activity",
    );

    // Check if actor's instance is blocked
    const actorUrl =
      typeof activity.actor === "string" ? activity.actor : (activity.actor as { id?: string })?.id;
    if (actorUrl) {
      try {
        const actorHost = new URL(actorUrl).hostname;
        const instanceBlockRepository = c.get("instanceBlockRepository");
        const isBlocked = await instanceBlockRepository.isBlocked(actorHost);

        if (isBlocked) {
          logger.debug({ actorHost }, "Shared inbox: Activity from blocked instance, rejecting");
          return c.json({ status: "accepted" }, 202);
        }
      } catch (error) {
        logger.error({ err: error }, "Shared inbox: Instance block check failed");
      }
    }

    // Check for duplicate activity (deduplication)
    const activityId = activity.id;
    if (activityId) {
      try {
        const db = getDatabase();

        const existing = await db
          .select()
          .from(receivedActivities)
          .where(eq(receivedActivities.activityId, activityId))
          .limit(1);

        if (existing.length > 0) {
          logger.debug({ activityId }, "Shared inbox: Duplicate activity detected, skipping");
          return c.json({ status: "accepted" }, 202);
        }

        await db.insert(receivedActivities).values({
          activityId,
          receivedAt: new Date(),
        });
      } catch (error) {
        logger.error({ err: error }, "Shared inbox: Deduplication check failed");
      }
    }

    // Handle activity using InboxService (async, don't wait)
    // For shared inbox, we don't have a specific recipient - pass null
    const inboxService = getInboxService();
    inboxService.handleActivity(c, activity, null).catch((error) => {
      logger.error(
        { err: error, activityType: activity.type, actor: activity.actor },
        "Shared inbox: Activity handling error",
      );
    });

    return c.json({ status: "accepted" }, 202);
  },
);

export default inbox;
