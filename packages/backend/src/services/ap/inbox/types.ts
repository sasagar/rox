/**
 * ActivityPub Inbox Handler Types
 *
 * Defines interfaces and types for inbox activity handlers.
 *
 * @module services/ap/inbox/types
 */

import type { Context } from "hono";

/**
 * ActivityPub Activity object
 *
 * Represents an incoming ActivityPub activity.
 * Using a more specific type than `any` for better type safety.
 */
export interface Activity {
  "@context"?: string | string[] | Record<string, unknown>[];
  id?: string;
  type: string;
  actor: string | { id: string; [key: string]: unknown };
  object?: unknown;
  target?: unknown;
  published?: string;
  to?: string[];
  cc?: string[];
  [key: string]: unknown;
}

/**
 * Handler context containing all dependencies
 *
 * Provides access to repositories and services needed by handlers.
 */
export interface HandlerContext {
  /** Hono request context */
  c: Context;
  /** Local recipient user ID */
  recipientId: string;
  /** Base URL of this instance */
  baseUrl: string;
}

/**
 * Handler result indicating success/failure
 */
export interface HandlerResult {
  success: boolean;
  message?: string;
  error?: Error;
}

/**
 * Activity handler interface
 *
 * All activity handlers must implement this interface.
 */
export interface IActivityHandler {
  /**
   * The activity type this handler processes
   */
  readonly activityType: string;

  /**
   * Handle an incoming activity
   *
   * @param activity - The ActivityPub activity to process
   * @param context - Handler context with dependencies
   * @returns Handler result
   */
  handle(activity: Activity, context: HandlerContext): Promise<HandlerResult>;
}

/**
 * Repository interfaces available in handler context
 */
export interface Repositories {
  userRepository: {
    findById(id: string): Promise<any>;
    findByUsername(username: string): Promise<any>;
    update(id: string, data: Record<string, any>): Promise<any>;
  };
  followRepository: {
    exists(followerId: string, followeeId: string): Promise<boolean>;
    create(data: { id: string; followerId: string; followeeId: string }): Promise<any>;
    delete(followerId: string, followeeId: string): Promise<void>;
  };
  noteRepository: {
    findById(id: string): Promise<any>;
    findByUri(uri: string): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
  };
  reactionRepository: {
    findByUserNoteAndReaction(userId: string, noteId: string, reaction: string): Promise<any>;
    create(data: any): Promise<any>;
    deleteByUserNoteAndReaction(userId: string, noteId: string, reaction: string): Promise<void>;
  };
}

/**
 * Extract actor URI from activity
 *
 * @param actor - Actor field from activity (string or object)
 * @returns Actor URI string
 */
export function getActorUri(actor: string | { id: string; [key: string]: unknown }): string {
  return typeof actor === "string" ? actor : actor.id;
}

/**
 * Extract object URI from activity object field
 *
 * @param object - Object field from activity
 * @returns Object URI string or undefined
 */
export function getObjectUri(object: unknown): string | undefined {
  if (typeof object === "string") {
    return object;
  }
  if (object && typeof object === "object" && "id" in object) {
    return (object as { id: string }).id;
  }
  return undefined;
}
