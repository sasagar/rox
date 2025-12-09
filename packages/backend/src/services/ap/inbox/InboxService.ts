/**
 * Inbox Service
 *
 * Main dispatcher for incoming ActivityPub activities.
 * Routes activities to appropriate handlers based on type.
 *
 * @module services/ap/inbox/InboxService
 */

import type { Context } from "hono";
import type { Activity, HandlerContext, HandlerResult, IActivityHandler } from "./types.js";
import {
  FollowHandler,
  AcceptHandler,
  RejectHandler,
  CreateHandler,
  UpdateHandler,
  DeleteHandler,
  LikeHandler,
  AnnounceHandler,
  UndoHandler,
  MoveHandler,
} from "./handlers/index.js";
import { logger } from "../../../lib/logger.js";
import { recordInboxActivity } from "../../../lib/metrics.js";

/**
 * InboxService - Activity dispatcher
 *
 * Manages a registry of activity handlers and dispatches
 * incoming activities to the appropriate handler.
 */
export class InboxService {
  private handlers: Map<string, IActivityHandler>;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.URL || "http://localhost:3000";
    this.handlers = new Map();
    this.registerDefaultHandlers();
  }

  /**
   * Register default activity handlers
   */
  private registerDefaultHandlers(): void {
    this.registerHandler(new FollowHandler());
    this.registerHandler(new AcceptHandler());
    this.registerHandler(new RejectHandler());
    this.registerHandler(new CreateHandler());
    this.registerHandler(new UpdateHandler());
    this.registerHandler(new DeleteHandler());
    this.registerHandler(new LikeHandler());
    this.registerHandler(new AnnounceHandler());
    this.registerHandler(new UndoHandler());
    this.registerHandler(new MoveHandler());
  }

  /**
   * Register an activity handler
   *
   * @param handler - Handler to register
   */
  registerHandler(handler: IActivityHandler): void {
    this.handlers.set(handler.activityType, handler);
  }

  /**
   * Get handler for activity type
   *
   * @param activityType - Activity type string
   * @returns Handler or undefined
   */
  getHandler(activityType: string): IActivityHandler | undefined {
    return this.handlers.get(activityType);
  }

  /**
   * Get all registered activity types
   *
   * @returns Array of activity type strings
   */
  getSupportedActivityTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Handle an incoming activity
   *
   * Routes the activity to the appropriate handler based on type.
   *
   * @param c - Hono context
   * @param activity - The ActivityPub activity
   * @param recipientId - Local user ID receiving the activity
   * @returns Handler result
   */
  async handleActivity(
    c: Context,
    activity: Activity,
    recipientId: string,
  ): Promise<HandlerResult> {
    const handler = this.handlers.get(activity.type);

    if (!handler) {
      logger.debug({ activityType: activity.type }, "Unsupported activity type");
      return {
        success: true,
        message: `Unsupported activity type: ${activity.type}`,
      };
    }

    const context: HandlerContext = {
      c,
      recipientId,
      baseUrl: this.baseUrl,
    };

    const result = await handler.handle(activity, context);

    // Record metrics for inbox activity
    recordInboxActivity(activity.type, result.success);

    return result;
  }
}

/**
 * Singleton instance for convenience
 */
let inboxServiceInstance: InboxService | null = null;

/**
 * Get or create InboxService singleton
 *
 * @returns InboxService instance
 */
export function getInboxService(): InboxService {
  if (!inboxServiceInstance) {
    inboxServiceInstance = new InboxService();
  }
  return inboxServiceInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetInboxService(): void {
  inboxServiceInstance = null;
}
