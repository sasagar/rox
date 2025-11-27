/**
 * Move Activity Handler
 *
 * Processes incoming Move activities for account migration.
 * When a followed user migrates to a new account, this handler
 * automatically unfollows the old account and follows the new one.
 *
 * @module services/ap/inbox/handlers/MoveHandler
 */

import type { Activity, HandlerContext, HandlerResult } from '../types.js';
import { BaseHandler } from './BaseHandler.js';
import { ActivityDeliveryService } from '../../ActivityDeliveryService.js';

/**
 * Handler for Move activities
 *
 * When a remote user migrates their account:
 * 1. Validates the Move activity (bi-directional alsoKnownAs check)
 * 2. For each local follower of the old account:
 *    a. Creates a follow to the new account
 *    b. Sends a Follow activity to the new account
 *    c. Optionally unfollows the old account
 * 3. Updates the cached remote user data with movedTo
 */
export class MoveHandler extends BaseHandler {
  readonly activityType = 'Move';

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c, baseUrl } = context;

    try {
      // Extract actor (old account) and target (new account)
      const oldAccountUri = this.getActorUri(activity);
      const targetUri = this.getTargetUri(activity);

      if (!targetUri) {
        this.warn('Move activity missing target');
        return this.failure('Move activity missing target');
      }

      this.log('🚚', `Move: ${oldAccountUri} → ${targetUri}`);

      // Resolve both actors
      const remoteActorService = this.getRemoteActorService(c);
      const oldActor = await remoteActorService.resolveActor(oldAccountUri, true);
      const newActor = await remoteActorService.resolveActor(targetUri, true);

      if (!newActor) {
        this.warn(`Could not resolve new account: ${targetUri}`);
        return this.failure('Could not resolve new account');
      }

      // Validate bi-directional alsoKnownAs
      const validationResult = await this.validateMove(oldActor, newActor, oldAccountUri, targetUri);
      if (!validationResult.valid) {
        this.warn(`Move validation failed: ${validationResult.reason}`);
        return this.failure(`Move validation failed: ${validationResult.reason}`);
      }

      // Update old actor's movedTo in our database
      const userRepository = this.getUserRepository(c);
      if (oldActor.id) {
        await userRepository.update(oldActor.id, {
          movedTo: targetUri,
          movedAt: new Date(),
        });
      }

      // Find all local users who follow the old account
      const followRepository = this.getFollowRepository(c);
      const followers = await followRepository.findByFolloweeId(oldActor.id);

      this.log('📋', `Found ${followers.length} local followers to migrate`);

      let migratedCount = 0;
      let errorCount = 0;

      for (const follow of followers) {
        try {
          // Get the local follower user
          const follower = await userRepository.findById(follow.followerId);
          if (!follower || follower.host !== null) {
            // Skip if not a local user
            continue;
          }

          // Check if already following the new account
          const alreadyFollowing = await followRepository.exists(follower.id, newActor.id);
          if (alreadyFollowing) {
            this.log('⏭️', `${follower.username} already follows new account`);
            continue;
          }

          // Create follow relationship to new account
          const newFollowId = this.generateId();
          await followRepository.create({
            id: newFollowId,
            followerId: follower.id,
            followeeId: newActor.id,
          });

          // Send Follow activity to new account
          if (follower.privateKey && newActor.inbox) {
            const followerUri = `${baseUrl}/users/${follower.username}`;
            const keyId = `${followerUri}#main-key`;

            const deliveryService = new ActivityDeliveryService();
            const followActivity = {
              '@context': 'https://www.w3.org/ns/activitystreams',
              type: 'Follow',
              id: `${baseUrl}/activities/${newFollowId}`,
              actor: followerUri,
              object: targetUri,
            };

            await deliveryService.deliver(
              followActivity,
              newActor.inbox,
              keyId,
              follower.privateKey
            );

            this.log('📤', `Follow activity sent to ${newActor.inbox} for ${follower.username}`);
          }

          migratedCount++;
        } catch (err) {
          this.error(`Failed to migrate follow for user ${follow.followerId}:`, err as Error);
          errorCount++;
        }
      }

      this.log('✅', `Move processed: ${migratedCount} followers migrated, ${errorCount} errors`);

      return this.success(`Move processed: ${migratedCount} followers migrated`);
    } catch (error) {
      this.error('Failed to handle Move activity:', error as Error);
      return this.failure('Failed to handle Move activity', error as Error);
    }
  }

  /**
   * Extract target URI from Move activity
   */
  private getTargetUri(activity: Activity): string | null {
    const target = activity.target;
    if (!target) return null;

    if (typeof target === 'string') {
      return target;
    }

    if (typeof target === 'object' && 'id' in target) {
      return target.id as string;
    }

    return null;
  }

  /**
   * Validate Move activity
   *
   * Checks that:
   * 1. Old account has new account in alsoKnownAs
   * 2. New account has old account in alsoKnownAs
   */
  private async validateMove(
    oldActor: { alsoKnownAs?: string[] | null },
    newActor: { alsoKnownAs?: string[] | null },
    oldAccountUri: string,
    newAccountUri: string
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check if old account lists new account in alsoKnownAs
    const oldHasNew = oldActor.alsoKnownAs?.includes(newAccountUri);
    if (!oldHasNew) {
      return {
        valid: false,
        reason: 'Old account does not have new account in alsoKnownAs',
      };
    }

    // Check if new account lists old account in alsoKnownAs
    const newHasOld = newActor.alsoKnownAs?.includes(oldAccountUri);
    if (!newHasOld) {
      return {
        valid: false,
        reason: 'New account does not have old account in alsoKnownAs',
      };
    }

    return { valid: true };
  }
}
