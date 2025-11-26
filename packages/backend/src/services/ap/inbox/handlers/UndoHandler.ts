/**
 * Undo Activity Handler
 *
 * Processes Undo activities (unfollow, unlike, unannounce).
 *
 * @module services/ap/inbox/handlers/UndoHandler
 */

import type { Activity, HandlerContext, HandlerResult } from '../types.js';
import { getObjectUri } from '../types.js';
import { BaseHandler } from './BaseHandler.js';

/**
 * Handler for Undo activities
 *
 * Currently handles:
 * - Undo Follow: Removes follow relationship
 * - Undo Like: Removes reaction from note
 * - Undo Announce: Removes renote
 */
export class UndoHandler extends BaseHandler {
  readonly activityType = 'Undo';

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c, recipientId } = context;

    try {
      const object = activity.object;

      if (!object || typeof object !== 'object') {
        this.warn('Invalid Undo activity: missing or invalid object');
        return this.failure('Invalid Undo activity: missing or invalid object');
      }

      const actorUri = this.getActorUri(activity);
      const remoteActor = await this.resolveActor(actorUri, c);
      const objectType = (object as { type?: string }).type;

      // Handle Undo Follow (unfollow)
      if (objectType === 'Follow') {
        return this.handleUndoFollow(remoteActor, recipientId, c);
      }

      // Handle Undo Like (unlike)
      if (objectType === 'Like') {
        return this.handleUndoLike(object, remoteActor, c);
      }

      // Handle Undo Announce (unboost/unrenote)
      if (objectType === 'Announce') {
        return this.handleUndoAnnounce(object, remoteActor, c);
      }

      this.log('ℹ️', `Unsupported Undo object type: ${objectType}`);
      return this.success(`Unsupported Undo object type: ${objectType}`);
    } catch (error) {
      this.error('Failed to handle Undo activity:', error as Error);
      return this.failure('Failed to handle Undo activity', error as Error);
    }
  }

  /**
   * Handle Undo Follow (unfollow)
   */
  private async handleUndoFollow(
    remoteActor: any,
    recipientId: string,
    c: any
  ): Promise<HandlerResult> {
    this.log('📥', `Undo Follow: ${remoteActor.username}@${remoteActor.host} → recipient ${recipientId}`);

    const followRepository = this.getFollowRepository(c);
    await followRepository.delete(remoteActor.id, recipientId);

    this.log('✅', `Follow deleted: ${remoteActor.username}@${remoteActor.host} unfollowed recipient`);
    return this.success('Follow deleted');
  }

  /**
   * Handle Undo Like (unlike)
   */
  private async handleUndoLike(
    object: any,
    remoteActor: any,
    c: any
  ): Promise<HandlerResult> {
    const objectUri = getObjectUri(object.object);

    if (!objectUri) {
      this.warn('Invalid Undo Like: missing object');
      return this.failure('Invalid Undo Like: missing object');
    }

    this.log('📥', `Undo Like: ${remoteActor.username}@${remoteActor.host} → ${objectUri}`);

    // Find the note
    const noteRepository = this.getNoteRepository(c);
    const note = await noteRepository.findByUri(objectUri);

    if (!note) {
      this.warn(`Note not found: ${objectUri}`);
      return this.failure(`Note not found: ${objectUri}`);
    }

    // Delete reaction (default to heart emoji for standard Like)
    const reactionRepository = this.getReactionRepository(c);
    await reactionRepository.deleteByUserNoteAndReaction(remoteActor.id, note.id, '❤️');

    this.log('✅', `Reaction deleted: ${remoteActor.username}@${remoteActor.host} unliked note ${note.id}`);
    return this.success('Reaction deleted');
  }

  /**
   * Handle Undo Announce (unboost/unrenote)
   */
  private async handleUndoAnnounce(
    object: any,
    remoteActor: any,
    c: any
  ): Promise<HandlerResult> {
    const announceUri = object.id;

    if (!announceUri) {
      this.warn('Invalid Undo Announce: missing object id');
      return this.failure('Invalid Undo Announce: missing object id');
    }

    this.log('📥', `Undo Announce: ${remoteActor.username}@${remoteActor.host} → ${announceUri}`);

    // Find the renote by URI (the Announce activity URI is stored as the note's uri)
    const noteRepository = this.getNoteRepository(c);
    const renote = await noteRepository.findByUri(announceUri);

    if (!renote) {
      this.warn(`Renote not found: ${announceUri}`);
      return this.failure(`Renote not found: ${announceUri}`);
    }

    // Verify the actor owns this renote
    if (renote.userId !== remoteActor.id) {
      this.warn(`Actor ${remoteActor.id} does not own renote ${renote.id}`);
      return this.failure('Cannot delete renote owned by another user');
    }

    // Delete the renote
    await noteRepository.delete(renote.id);

    this.log('✅', `Renote deleted: ${remoteActor.username}@${remoteActor.host} unannounced note`);
    return this.success('Renote deleted');
  }
}
