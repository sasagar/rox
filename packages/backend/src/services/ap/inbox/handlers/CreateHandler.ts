/**
 * Create Activity Handler
 *
 * Processes Create activities for new objects (notes, etc).
 *
 * @module services/ap/inbox/handlers/CreateHandler
 */

import type { Activity, HandlerContext, HandlerResult } from '../types.js';
import { BaseHandler } from './BaseHandler.js';

/**
 * Handler for Create activities
 *
 * Currently handles:
 * - Create Note: Stores remote posts in local database
 * - Create Article: Same as Note
 */
export class CreateHandler extends BaseHandler {
  readonly activityType = 'Create';

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c } = context;

    try {
      const object = activity.object;

      if (!object || typeof object !== 'object') {
        this.warn('Invalid Create activity: missing or invalid object');
        return this.failure('Invalid Create activity: missing or invalid object');
      }

      const objectType = (object as { type?: string }).type;

      // Only handle Note and Article objects for now
      if (objectType !== 'Note' && objectType !== 'Article') {
        this.log('ℹ️', `Unsupported object type: ${objectType}`);
        return this.success(`Unsupported object type: ${objectType}`);
      }

      this.log('📥', `Create: Receiving ${objectType} from ${activity.actor}`);

      // Process the note using injected service
      const remoteNoteService = this.getRemoteNoteService(c);
      // Cast to the expected APNote type - validation already done above
      const note = await remoteNoteService.processNote(object as Parameters<typeof remoteNoteService.processNote>[0]);

      this.log('✅', `Note created: ${note.id} (URI: ${note.uri})`);
      return this.success(`Note created: ${note.id}`);
    } catch (error) {
      this.error('Failed to handle Create activity:', error as Error);
      return this.failure('Failed to handle Create activity', error as Error);
    }
  }
}
