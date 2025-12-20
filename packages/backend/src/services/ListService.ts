/**
 * List Management Service
 *
 * Handles list creation, management, and member operations.
 * Integrates with IListRepository for persistence, IUserRepository for user validation,
 * and INoteRepository for timeline retrieval.
 *
 * @module services/ListService
 */

import type { IListRepository } from "../interfaces/repositories/IListRepository.js";
import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { INoteRepository, TimelineOptions } from "../interfaces/repositories/INoteRepository.js";
import type { List, ListMember, ListWithMemberCount, ListMembership, ListNotifyLevel } from "shared";
import type { Note } from "shared";
import { generateId } from "../../../shared/src/utils/id.js";
import type { NoteService } from "./NoteService.js";
import type { SystemAccountService } from "./SystemAccountService.js";
import { logger } from "../lib/logger.js";

/**
 * List Service
 *
 * Provides business logic for list operations including:
 * - Creating and managing lists
 * - Adding/removing members from lists
 * - Retrieving list timelines
 * - Managing list visibility (public/private)
 *
 * @remarks
 * - List names must be unique per user
 * - Private lists are only visible to the owner
 * - List timelines show notes from all members
 */
export class ListService {
  /**
   * ListService Constructor
   *
   * @param listRepository - List repository
   * @param userRepository - User repository
   * @param noteRepository - Note repository
   * @param noteService - Note service for hydrating notes
   * @param systemAccountService - System account service for managing system follows
   */
  constructor(
    private readonly listRepository: IListRepository,
    private readonly userRepository: IUserRepository,
    private readonly noteRepository: INoteRepository,
    private readonly noteService?: NoteService,
    private readonly systemAccountService?: SystemAccountService,
  ) {}

  /**
   * Create a new list
   *
   * @param userId - Owner user ID
   * @param name - List name
   * @param isPublic - Whether the list is publicly visible (default: false)
   * @returns Created list
   * @throws Error if user not found
   * @throws Error if list name already exists for user
   *
   * @example
   * ```typescript
   * const list = await listService.createList(userId, "Tech News", true);
   * ```
   */
  async createList(userId: string, name: string, isPublic = false): Promise<List> {
    // Validate user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check for duplicate name
    const exists = await this.listRepository.existsByUserIdAndName(userId, name);
    if (exists) {
      throw new Error("List name already exists");
    }

    return await this.listRepository.create({
      id: generateId(),
      userId,
      name,
      isPublic,
      notifyLevel: "none",
    });
  }

  /**
   * Get a list by ID
   *
   * @param listId - List ID
   * @param requesterId - Requesting user ID (optional, for access control)
   * @returns List or null if not found/not accessible
   *
   * @example
   * ```typescript
   * const list = await listService.getList(listId, currentUserId);
   * ```
   */
  async getList(listId: string, requesterId?: string): Promise<List | null> {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      return null;
    }

    // Check access: owner can always see, others only if public
    if (!list.isPublic && list.userId !== requesterId) {
      return null;
    }

    return list;
  }

  /**
   * Get all lists owned by a user
   *
   * @param userId - Owner user ID
   * @param requesterId - Requesting user ID (optional)
   * @returns Lists with member counts
   *
   * @example
   * ```typescript
   * const lists = await listService.getUserLists(targetUserId, currentUserId);
   * ```
   */
  async getUserLists(userId: string, requesterId?: string): Promise<ListWithMemberCount[]> {
    // If requesting own lists, return all
    if (userId === requesterId) {
      return await this.listRepository.findByUserId(userId);
    }

    // Otherwise, return only public lists
    return await this.listRepository.findPublicByUserId(userId);
  }

  /**
   * Update a list
   *
   * @param listId - List ID
   * @param ownerId - Owner user ID (for authorization)
   * @param data - Update data
   * @returns Updated list
   * @throws Error if list not found
   * @throws Error if not owner
   * @throws Error if new name already exists
   *
   * @example
   * ```typescript
   * const updated = await listService.updateList(listId, userId, { name: "New Name" });
   * ```
   */
  async updateList(
    listId: string,
    ownerId: string,
    data: { name?: string; isPublic?: boolean; notifyLevel?: ListNotifyLevel },
  ): Promise<List> {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error("List not found");
    }

    if (list.userId !== ownerId) {
      throw new Error("Not authorized to update this list");
    }

    // Check for duplicate name if changing name
    if (data.name && data.name !== list.name) {
      const exists = await this.listRepository.existsByUserIdAndName(ownerId, data.name);
      if (exists) {
        throw new Error("List name already exists");
      }
    }

    return await this.listRepository.update(listId, data);
  }

  /**
   * Delete a list
   *
   * @param listId - List ID
   * @param ownerId - Owner user ID (for authorization)
   * @throws Error if list not found
   * @throws Error if not owner
   *
   * @example
   * ```typescript
   * await listService.deleteList(listId, userId);
   * ```
   */
  async deleteList(listId: string, ownerId: string): Promise<void> {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error("List not found");
    }

    if (list.userId !== ownerId) {
      throw new Error("Not authorized to delete this list");
    }

    await this.listRepository.delete(listId);
  }

  /**
   * Add a member to a list
   *
   * @param listId - List ID
   * @param targetUserId - User ID to add
   * @param ownerId - List owner ID (for authorization)
   * @param withReplies - Whether to include replies in timeline (default: true)
   * @returns Created membership
   * @throws Error if list not found
   * @throws Error if not owner
   * @throws Error if target user not found
   * @throws Error if already a member
   *
   * @example
   * ```typescript
   * const member = await listService.addMember(listId, targetUserId, userId);
   * ```
   */
  async addMember(
    listId: string,
    targetUserId: string,
    ownerId: string,
    withReplies = true,
  ): Promise<ListMember> {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error("List not found");
    }

    if (list.userId !== ownerId) {
      throw new Error("Not authorized to modify this list");
    }

    // Validate target user exists
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Check if already a member
    const isMember = await this.listRepository.isMember(listId, targetUserId);
    if (isMember) {
      throw new Error("User is already a member of this list");
    }

    const member = await this.listRepository.addMember({
      id: generateId(),
      listId,
      userId: targetUserId,
      withReplies,
    });

    // For remote users, ensure system account follows them to receive their notes
    if (targetUser.host && this.systemAccountService) {
      this.systemAccountService.ensureSystemFollow(targetUserId).catch((error) => {
        logger.warn({ targetUserId, error }, "Failed to create system follow for remote user");
      });
    }

    return member;
  }

  /**
   * Remove a member from a list
   *
   * @param listId - List ID
   * @param targetUserId - User ID to remove
   * @param ownerId - List owner ID (for authorization)
   * @throws Error if list not found
   * @throws Error if not owner
   *
   * @example
   * ```typescript
   * await listService.removeMember(listId, targetUserId, userId);
   * ```
   */
  async removeMember(listId: string, targetUserId: string, ownerId: string): Promise<void> {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error("List not found");
    }

    if (list.userId !== ownerId) {
      throw new Error("Not authorized to modify this list");
    }

    // Get user info before removal to check if remote
    const targetUser = await this.userRepository.findById(targetUserId);

    await this.listRepository.removeMember(listId, targetUserId);

    // For remote users, remove system follow if no longer in any list
    if (targetUser?.host && this.systemAccountService) {
      this.systemAccountService.removeSystemFollowIfOrphaned(targetUserId).catch((error) => {
        logger.warn({ targetUserId, error }, "Failed to remove orphaned system follow");
      });
    }
  }

  /**
   * Get list members with user details
   *
   * @param listId - List ID
   * @param requesterId - Requesting user ID (optional, for access control)
   * @param limit - Maximum number of members to return
   * @param offset - Number of members to skip
   * @returns List of memberships with user details
   * @throws Error if list not found
   * @throws Error if not authorized to view
   *
   * @example
   * ```typescript
   * const members = await listService.getMembers(listId, userId, 20, 0);
   * ```
   */
  async getMembers(
    listId: string,
    requesterId?: string,
    limit = 30,
    offset = 0,
  ): Promise<ListMembership[]> {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error("List not found");
    }

    // Check access
    if (!list.isPublic && list.userId !== requesterId) {
      throw new Error("Not authorized to view this list");
    }

    const members = await this.listRepository.getMembers(listId, limit, offset);

    // Lazy initialization: ensure system follows exist for remote members
    // This handles existing list members that were added before the system follow feature
    // Uses Promise.allSettled for efficient batch processing without blocking the response
    if (this.systemAccountService) {
      const remoteMembers = members.filter((m) => m.user?.host);
      if (remoteMembers.length > 0) {
        // Promise.allSettled never rejects, so no .catch() needed
        // All failures are handled in .then() via results with status === "rejected"
        void Promise.allSettled(
          remoteMembers.map((member) => this.systemAccountService!.ensureSystemFollow(member.userId)),
        ).then((results) => {
          const failures = results.filter((r) => r.status === "rejected");
          if (failures.length > 0) {
            logger.warn(
              { listId, failureCount: failures.length, totalRemote: remoteMembers.length },
              "Some system follows failed during lazy initialization",
            );
          }
        });
      }
    }

    return members;
  }

  /**
   * Update member settings
   *
   * @param listId - List ID
   * @param targetUserId - Member user ID
   * @param ownerId - List owner ID (for authorization)
   * @param data - Update data
   * @returns Updated membership
   * @throws Error if list not found
   * @throws Error if not owner
   *
   * @example
   * ```typescript
   * const updated = await listService.updateMember(listId, targetUserId, userId, { withReplies: false });
   * ```
   */
  async updateMember(
    listId: string,
    targetUserId: string,
    ownerId: string,
    data: { withReplies?: boolean },
  ): Promise<ListMember> {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error("List not found");
    }

    if (list.userId !== ownerId) {
      throw new Error("Not authorized to modify this list");
    }

    return await this.listRepository.updateMember(listId, targetUserId, data);
  }

  /**
   * Get list timeline (notes from all members)
   *
   * @param listId - List ID
   * @param requesterId - Requesting user ID (optional, for access control)
   * @param options - Timeline options (limit, sinceId, untilId)
   * @returns Notes from list members
   * @throws Error if list not found
   * @throws Error if not authorized to view
   *
   * @example
   * ```typescript
   * const notes = await listService.getListTimeline(listId, userId, { limit: 20 });
   * ```
   */
  async getListTimeline(
    listId: string,
    requesterId?: string,
    options: Omit<TimelineOptions, "userIds"> = {},
  ): Promise<Note[]> {
    const list = await this.listRepository.findById(listId);
    if (!list) {
      throw new Error("List not found");
    }

    // Check access
    if (!list.isPublic && list.userId !== requesterId) {
      throw new Error("Not authorized to view this list");
    }

    // Get member user IDs
    const memberUserIds = await this.listRepository.getMemberUserIds(listId);
    if (memberUserIds.length === 0) {
      return [];
    }

    // Get timeline for those users
    const notes = await this.noteRepository.getTimeline({
      ...options,
      userIds: memberUserIds,
    });

    // Hydrate renote and file information if noteService is available
    if (this.noteService) {
      return await this.noteService.hydrateNotesForTimeline(notes);
    }

    return notes;
  }

  /**
   * Get lists that contain a specific user
   *
   * @param targetUserId - User ID to check
   * @param ownerId - List owner ID (returns only lists owned by this user)
   * @returns Lists containing the target user
   *
   * @example
   * ```typescript
   * const lists = await listService.getListsContainingUser(targetUserId, currentUserId);
   * ```
   */
  async getListsContainingUser(targetUserId: string, ownerId: string): Promise<List[]> {
    return await this.listRepository.findListsContainingUser(targetUserId, ownerId);
  }
}
