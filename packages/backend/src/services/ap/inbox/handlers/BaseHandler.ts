/**
 * Base Activity Handler
 *
 * Abstract base class for all ActivityPub activity handlers.
 * Provides common functionality and dependencies.
 *
 * @module services/ap/inbox/handlers/BaseHandler
 */

import type { Context } from 'hono';
import type {
  Activity,
  HandlerContext,
  HandlerResult,
  IActivityHandler,
} from '../types.js';
import { getActorUri } from '../types.js';

/**
 * Abstract base class for activity handlers
 *
 * Provides common functionality like actor resolution and logging.
 * Subclasses must implement the `activityType` and `handle` method.
 */
export abstract class BaseHandler implements IActivityHandler {
  /**
   * The activity type this handler processes
   */
  abstract readonly activityType: string;

  /**
   * Handle an incoming activity
   *
   * @param activity - The ActivityPub activity to process
   * @param context - Handler context with dependencies
   * @returns Handler result
   */
  abstract handle(activity: Activity, context: HandlerContext): Promise<HandlerResult>;

  /**
   * Get user repository from context
   */
  protected getUserRepository(c: Context) {
    return c.get('userRepository');
  }

  /**
   * Get follow repository from context
   */
  protected getFollowRepository(c: Context) {
    return c.get('followRepository');
  }

  /**
   * Get note repository from context
   */
  protected getNoteRepository(c: Context) {
    return c.get('noteRepository');
  }

  /**
   * Get reaction repository from context
   */
  protected getReactionRepository(c: Context) {
    return c.get('reactionRepository');
  }

  /**
   * Get remote actor service from context
   */
  protected getRemoteActorService(c: Context) {
    return c.get('remoteActorService');
  }

  /**
   * Get remote note service from context
   */
  protected getRemoteNoteService(c: Context) {
    return c.get('remoteNoteService');
  }

  /**
   * Resolve remote actor from URI
   *
   * @param actorUri - Actor URI to resolve
   * @param c - Hono context
   * @returns Resolved actor or null
   */
  protected async resolveActor(actorUri: string, c: Context) {
    const remoteActorService = this.getRemoteActorService(c);
    return remoteActorService.resolveActor(actorUri);
  }

  /**
   * Extract actor URI from activity
   */
  protected getActorUri(activity: Activity): string {
    return getActorUri(activity.actor);
  }

  /**
   * Generate a unique ID
   */
  protected async generateId(): Promise<string> {
    const { generateId } = await import('shared');
    return generateId();
  }

  /**
   * Log handler activity
   */
  protected log(emoji: string, message: string): void {
    console.log(`${emoji} ${message}`);
  }

  /**
   * Log warning
   */
  protected warn(message: string): void {
    console.warn(message);
  }

  /**
   * Log error
   */
  protected error(message: string, err?: Error): void {
    console.error(message, err);
  }

  /**
   * Create success result
   */
  protected success(message?: string): HandlerResult {
    return { success: true, message };
  }

  /**
   * Create failure result
   */
  protected failure(message: string, error?: Error): HandlerResult {
    return { success: false, message, error };
  }
}
