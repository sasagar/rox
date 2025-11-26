/**
 * Accept Activity Handler
 *
 * Processes Accept activities (e.g., follow request accepted).
 *
 * @module services/ap/inbox/handlers/AcceptHandler
 */

import type { Activity, HandlerContext, HandlerResult } from '../types.js';
import { BaseHandler } from './BaseHandler.js';

/**
 * Handler for Accept activities
 *
 * Currently handles:
 * - Accept Follow: Confirms that our follow request was accepted
 */
export class AcceptHandler extends BaseHandler {
  readonly activityType = 'Accept';

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c } = context;

    try {
      const object = activity.object;

      if (!object || typeof object !== 'object') {
        this.warn('Invalid Accept activity: missing or invalid object');
        return this.failure('Invalid Accept activity: missing or invalid object');
      }

      const actorUri = this.getActorUri(activity);
      const remoteActor = await this.resolveActor(actorUri, c);

      const objectType = (object as { type?: string }).type;

      // Handle Accept Follow (our follow request was accepted)
      if (objectType === 'Follow') {
        this.log('📥', `Accept Follow: ${remoteActor.username}@${remoteActor.host} accepted our follow request`);

        // In the current implementation, follows are created immediately when we send the Follow activity.
        // The Accept just confirms it was successful.
        // Future enhancement: track pending follow requests and only finalize on Accept.

        this.log('✅', `Follow confirmed: now following ${remoteActor.username}@${remoteActor.host}`);
        return this.success('Follow confirmed');
      }

      this.log('ℹ️', `Unsupported Accept object type: ${objectType}`);
      return this.success(`Unsupported Accept object type: ${objectType}`);
    } catch (error) {
      this.error('Failed to handle Accept activity:', error as Error);
      return this.failure('Failed to handle Accept activity', error as Error);
    }
  }
}
