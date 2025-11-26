/**
 * ActivityPub Inbox Module
 *
 * Exports InboxService and related types for handling
 * incoming ActivityPub activities.
 *
 * @module services/ap/inbox
 */

export { InboxService, getInboxService, resetInboxService } from './InboxService.js';
export type {
  Activity,
  HandlerContext,
  HandlerResult,
  IActivityHandler,
  Repositories,
} from './types.js';
export { getActorUri, getObjectUri } from './types.js';

// Re-export handlers for extension/testing
export * from './handlers/index.js';
