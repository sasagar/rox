/**
 * Follow Activity Handler
 *
 * Processes incoming Follow activities from remote users.
 * Creates a follow relationship and sends an Accept activity back.
 *
 * @module services/ap/inbox/handlers/FollowHandler
 */

import type { Activity, HandlerContext, HandlerResult } from '../types.js';
import { BaseHandler } from './BaseHandler.js';
import { ActivityDeliveryService } from '../../ActivityDeliveryService.js';

/**
 * Handler for Follow activities
 *
 * When a remote user follows a local user:
 * 1. Resolves the remote actor
 * 2. Creates the follow relationship
 * 3. Sends an Accept activity back
 */
export class FollowHandler extends BaseHandler {
  readonly activityType = 'Follow';

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c, recipientId, baseUrl } = context;

    try {
      // Resolve remote actor
      const actorUri = this.getActorUri(activity);
      const remoteActor = await this.resolveActor(actorUri, c);

      this.log('📥', `Follow: ${remoteActor.username}@${remoteActor.host} → recipient ${recipientId}`);

      // Check if follow already exists
      const followRepository = this.getFollowRepository(c);
      const alreadyFollowing = await followRepository.exists(remoteActor.id, recipientId);

      if (alreadyFollowing) {
        this.log('⚠️', 'Follow already exists, skipping');
        return this.success('Follow already exists');
      }

      // Create follow relationship
      const id = await this.generateId();
      await followRepository.create({
        id,
        followerId: remoteActor.id,
        followeeId: recipientId,
      });

      this.log('✅', `Follow created: ${remoteActor.username}@${remoteActor.host} → recipient`);

      // Send Accept activity back to remote server
      const userRepository = this.getUserRepository(c);
      const recipient = await userRepository.findById(recipientId);

      if (!recipient || !recipient.privateKey) {
        this.error('Recipient not found or missing private key');
        return this.failure('Recipient not found or missing private key');
      }

      const recipientUri = `${baseUrl}/users/${recipient.username}`;
      const keyId = `${recipientUri}#main-key`;

      const deliveryService = new ActivityDeliveryService();
      const acceptActivity = deliveryService.createAcceptActivity(activity, recipientUri);

      if (!remoteActor.inbox) {
        this.error('Remote actor has no inbox URL');
        return this.failure('Remote actor has no inbox URL');
      }

      await deliveryService.deliver(
        acceptActivity,
        remoteActor.inbox,
        keyId,
        recipient.privateKey
      );

      this.log('📤', `Accept activity sent to ${remoteActor.inbox}`);

      return this.success('Follow processed and Accept sent');
    } catch (error) {
      this.error('Failed to handle Follow activity:', error as Error);
      return this.failure('Failed to handle Follow activity', error as Error);
    }
  }
}
