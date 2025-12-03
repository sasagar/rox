/**
 * Reject Activity Handler
 *
 * Processes Reject activities (e.g., follow request rejected).
 *
 * @module services/ap/inbox/handlers/RejectHandler
 */

import type { Activity, HandlerContext, HandlerResult } from "../types.js";
import { BaseHandler } from "./BaseHandler.js";

/**
 * Handler for Reject activities
 *
 * Currently a stub - will handle:
 * - Reject Follow: Our follow request was rejected
 */
export class RejectHandler extends BaseHandler {
  readonly activityType = "Reject";

  async handle(_activity: Activity, _context: HandlerContext): Promise<HandlerResult> {
    // TODO: Implement Reject handler
    // Should handle rejected follow requests by removing pending follow state
    this.log("ℹ️", "TODO: Implement Reject handler");
    return this.success("Reject handler not yet implemented");
  }
}
