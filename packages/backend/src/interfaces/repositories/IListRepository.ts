/**
 * List Repository Interface
 *
 * Defines the contract for list storage operations.
 * Implementations handle user-created lists (Twitter/X-like lists).
 *
 * @module interfaces/repositories/IListRepository
 */

import type { List, ListMember, ListWithMemberCount, ListMembership } from "shared";

export interface IListRepository {
  /**
   * Create a new list
   */
  create(list: Omit<List, "createdAt" | "updatedAt">): Promise<List>;

  /**
   * Find list by ID
   */
  findById(id: string): Promise<List | null>;

  /**
   * Find all lists owned by a user (with member counts)
   */
  findByUserId(userId: string): Promise<ListWithMemberCount[]>;

  /**
   * Find public lists by owner user ID (with member counts)
   */
  findPublicByUserId(userId: string): Promise<ListWithMemberCount[]>;

  /**
   * Check if list name already exists for user
   */
  existsByUserIdAndName(userId: string, name: string): Promise<boolean>;

  /**
   * Update list
   */
  update(id: string, data: Partial<Pick<List, "name" | "isPublic">>): Promise<List>;

  /**
   * Delete list
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all lists owned by a user
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * Add member to list
   */
  addMember(member: Omit<ListMember, "createdAt">): Promise<ListMember>;

  /**
   * Remove member from list
   */
  removeMember(listId: string, userId: string): Promise<void>;

  /**
   * Check if user is member of list
   */
  isMember(listId: string, userId: string): Promise<boolean>;

  /**
   * Get list members with user details (paginated)
   */
  getMembers(listId: string, limit?: number, offset?: number): Promise<ListMembership[]>;

  /**
   * Get member user IDs for timeline query
   */
  getMemberUserIds(listId: string): Promise<string[]>;

  /**
   * Count members in list
   */
  countMembers(listId: string): Promise<number>;

  /**
   * Update member settings
   */
  updateMember(
    listId: string,
    userId: string,
    data: Partial<Pick<ListMember, "withReplies">>,
  ): Promise<ListMember>;

  /**
   * Get lists that contain a specific user (owned by the requester)
   */
  findListsContainingUser(userId: string, ownerId: string): Promise<List[]>;
}
