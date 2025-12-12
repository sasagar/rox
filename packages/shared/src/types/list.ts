/**
 * List types for user-created lists (Twitter/X-like lists)
 *
 * @module types/list
 */

import type { ID, Timestamps } from "./common.js";

/**
 * User list entity
 *
 * Represents a list created by a user to organize followed users
 */
export interface List extends Timestamps {
  id: ID;
  /** Owner of the list */
  userId: ID;
  /** Display name of the list */
  name: string;
  /** Whether the list is publicly visible */
  isPublic: boolean;
}

/**
 * List member entity
 *
 * Represents the membership of a user in a list
 */
export interface ListMember {
  id: ID;
  /** The list this membership belongs to */
  listId: ID;
  /** The user who is a member of the list */
  userId: ID;
  /** Whether to include replies from this member in list timeline */
  withReplies: boolean;
  createdAt: Date;
}

/**
 * List with member count
 *
 * Extended list type for API responses that include member count
 */
export interface ListWithMemberCount extends List {
  memberCount: number;
}

/**
 * List membership with user details
 *
 * Used for displaying list members with user information
 */
export interface ListMembership extends ListMember {
  user?: {
    id: ID;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    host: string | null;
  };
}
