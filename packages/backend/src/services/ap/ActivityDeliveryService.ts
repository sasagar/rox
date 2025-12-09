/**
 * Activity Delivery Service
 *
 * Handles delivery of ActivityPub activities to remote servers.
 * Signs requests with HTTP Signatures and sends them to remote inboxes.
 *
 * @module services/ap/ActivityDeliveryService
 */

import { signRequest, getSignedHeaders } from "../../utils/crypto.js";
import { logger } from "../../lib/logger.js";
import { recordActivityDelivery } from "../../lib/metrics.js";

/**
 * Delivery timeout in milliseconds (30 seconds)
 */
const DELIVERY_TIMEOUT = 30000;

/**
 * Activity Delivery Service
 *
 * Responsible for delivering ActivityPub activities to remote servers
 * with proper HTTP Signature authentication.
 */
export class ActivityDeliveryService {
  /**
   * Deliver activity to remote inbox
   *
   * Signs the request with the sender's private key and posts to the inbox.
   *
   * @param activity - ActivityPub activity to send
   * @param inboxUrl - Remote inbox URL
   * @param senderKeyId - Sender's key ID (e.g., "https://example.com/users/alice#main-key")
   * @param senderPrivateKey - Sender's private key (PEM format)
   * @returns True if delivery succeeded, false otherwise
   *
   * @example
   * ```typescript
   * const service = new ActivityDeliveryService();
   * await service.deliver(
   *   { type: 'Accept', ... },
   *   'https://remote.example.com/users/bob/inbox',
   *   'https://example.com/users/alice#main-key',
   *   alicePrivateKey
   * );
   * ```
   */
  async deliver(
    activity: any,
    inboxUrl: string,
    senderKeyId: string,
    senderPrivateKey: string,
  ): Promise<boolean> {
    const startTime = Date.now();
    const activityType = activity.type || "Unknown";

    try {
      const body = JSON.stringify(activity);

      // Generate HTTP Signature
      const signature = signRequest(senderPrivateKey, senderKeyId, "POST", inboxUrl, body);

      // Get required headers
      const headers = getSignedHeaders(inboxUrl, body);

      // Send request with timeout
      const headersObj = new Headers();
      headersObj.set("Content-Type", "application/activity+json");
      headersObj.set("Host", headers.host!);
      headersObj.set("Date", headers.date!);
      headersObj.set("Signature", signature);
      if (headers.digest) {
        headersObj.set("Digest", headers.digest);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

      let response: Response;
      try {
        response = await fetch(inboxUrl, {
          method: "POST",
          headers: headersObj,
          body,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        logger.error({ inboxUrl, status: response.status, statusText: response.statusText }, "Failed to deliver activity");
        const duration = (Date.now() - startTime) / 1000;
        recordActivityDelivery(activityType, false, duration);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.debug({ inboxUrl, activityType: activity.type }, "Activity delivered");
      const duration = (Date.now() - startTime) / 1000;
      recordActivityDelivery(activityType, true, duration);
      return true;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      if (error instanceof Error && error.name === "AbortError") {
        logger.error({ inboxUrl, timeoutMs: DELIVERY_TIMEOUT }, "Timeout delivering activity");
        recordActivityDelivery(activityType, false, duration);
        throw new Error(`Delivery timeout after ${DELIVERY_TIMEOUT}ms`);
      }

      logger.error({ err: error, inboxUrl }, "Error delivering activity");
      recordActivityDelivery(activityType, false, duration);
      throw error; // Re-throw for queue retry logic
    }
  }

  /**
   * Create Accept activity
   *
   * Creates an Accept activity in response to a Follow request.
   *
   * @param followActivity - Original Follow activity
   * @param acceptorUri - URI of the user accepting the follow
   * @returns Accept activity
   */
  createAcceptActivity(followActivity: any, acceptorUri: string): any {
    // Generate a unique ID for the Accept activity
    const acceptId = `${acceptorUri}#accepts/${Date.now()}`;
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: acceptId,
      type: "Accept",
      actor: acceptorUri,
      object: followActivity,
    };
  }

  /**
   * Create Follow activity
   *
   * Creates a Follow activity to send to a remote user.
   *
   * @param followerUri - URI of the follower
   * @param followeeUri - URI of the user to follow
   * @param activityId - Unique ID for this activity
   * @returns Follow activity
   */
  createFollowActivity(followerUri: string, followeeUri: string, activityId: string): any {
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: activityId,
      type: "Follow",
      actor: followerUri,
      object: followeeUri,
    };
  }

  /**
   * Create Undo activity
   *
   * Creates an Undo activity to reverse a previous action.
   *
   * @param actorUri - URI of the actor undoing the action
   * @param originalActivity - Original activity to undo
   * @param activityId - Unique ID for this activity
   * @returns Undo activity
   */
  createUndoActivity(actorUri: string, originalActivity: any, activityId: string): any {
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: activityId,
      type: "Undo",
      actor: actorUri,
      object: originalActivity,
    };
  }
}
