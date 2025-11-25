/**
 * Activity Delivery Service
 *
 * Handles delivery of ActivityPub activities to remote servers.
 * Signs requests with HTTP Signatures and sends them to remote inboxes.
 *
 * @module services/ap/ActivityDeliveryService
 */

import { signRequest, getSignedHeaders } from '../../utils/crypto.js';

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
    senderPrivateKey: string
  ): Promise<boolean> {
    try {
      const body = JSON.stringify(activity);

      // Generate HTTP Signature
      const signature = signRequest(senderPrivateKey, senderKeyId, 'POST', inboxUrl, body);

      // Get required headers
      const headers = getSignedHeaders(inboxUrl, body);

      // Send request
      const headersObj = new Headers();
      headersObj.set('Content-Type', 'application/activity+json');
      headersObj.set('Host', headers.host!);
      headersObj.set('Date', headers.date!);
      headersObj.set('Signature', signature);
      if (headers.digest) {
        headersObj.set('Digest', headers.digest);
      }

      const response = await fetch(inboxUrl, {
        method: 'POST',
        headers: headersObj,
        body,
      });

      if (!response.ok) {
        console.error(
          `Failed to deliver activity to ${inboxUrl}: ${response.status} ${response.statusText}`
        );
        return false;
      }

      console.log(`✅ Activity delivered to ${inboxUrl}: ${activity.type}`);
      return true;
    } catch (error) {
      console.error(`Error delivering activity to ${inboxUrl}:`, error);
      return false;
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
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Accept',
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
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: activityId,
      type: 'Follow',
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
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: activityId,
      type: 'Undo',
      actor: actorUri,
      object: originalActivity,
    };
  }
}
