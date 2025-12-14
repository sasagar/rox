/**
 * Lists API client
 *
 * Provides methods for user list management operations
 *
 * @module lib/api/lists
 */

import { apiClient } from "./client";
import type { List, ListWithMemberCount, ListMember, ListMembership, ListNotifyLevel } from "shared";
import type { Note } from "../types/note";

export type { List, ListWithMemberCount, ListMember, ListMembership, ListNotifyLevel };

/**
 * Timeline fetch options for list timeline
 */
export interface ListTimelineOptions {
  limit?: number;
  sinceId?: string;
  untilId?: string;
}

/**
 * Lists API operations
 */
export const listsApi = {
  /**
   * Create a new list
   *
   * @param name - List name
   * @param isPublic - Whether the list is publicly visible (default: false)
   * @returns Created list
   */
  async create(name: string, isPublic = false): Promise<List> {
    return apiClient.post<List>("/api/users/lists/create", { name, isPublic });
  },

  /**
   * Delete a list
   *
   * @param listId - List ID to delete
   * @returns Success status
   */
  async delete(listId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>("/api/users/lists/delete", { listId });
  },

  /**
   * Update a list
   *
   * @param listId - List ID to update
   * @param data - Fields to update
   * @returns Updated list
   */
  async update(listId: string, data: { name?: string; isPublic?: boolean; notifyLevel?: ListNotifyLevel }): Promise<List> {
    return apiClient.post<List>("/api/users/lists/update", { listId, ...data });
  },

  /**
   * Get list details
   *
   * @param listId - List ID
   * @returns List details
   */
  async show(listId: string): Promise<List> {
    return apiClient.post<List>("/api/users/lists/show", { listId });
  },

  /**
   * Get user's lists
   *
   * @param userId - User ID (optional, defaults to current user)
   * @returns Lists with member counts
   */
  async list(userId?: string): Promise<ListWithMemberCount[]> {
    return apiClient.post<ListWithMemberCount[]>("/api/users/lists/list", userId ? { userId } : {});
  },

  /**
   * Add a user to a list
   *
   * @param listId - List ID
   * @param userId - User ID to add
   * @param withReplies - Include replies in timeline (default: true)
   * @returns Created membership
   */
  async push(listId: string, userId: string, withReplies = true): Promise<ListMember> {
    return apiClient.post<ListMember>("/api/users/lists/push", {
      listId,
      userId,
      withReplies,
    });
  },

  /**
   * Remove a user from a list
   *
   * @param listId - List ID
   * @param userId - User ID to remove
   * @returns Success status
   */
  async pull(listId: string, userId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>("/api/users/lists/pull", {
      listId,
      userId,
    });
  },

  /**
   * Get list members with user details
   *
   * @param listId - List ID
   * @param limit - Maximum number of members (default: 30)
   * @param offset - Pagination offset (default: 0)
   * @returns Members with user details
   */
  async getMemberships(listId: string, limit = 30, offset = 0): Promise<ListMembership[]> {
    return apiClient.post<ListMembership[]>("/api/users/lists/get-memberships", {
      listId,
      limit,
      offset,
    });
  },

  /**
   * Update member settings
   *
   * @param listId - List ID
   * @param userId - Member user ID
   * @param withReplies - Include replies in timeline
   * @returns Updated membership
   */
  async updateMembership(listId: string, userId: string, withReplies: boolean): Promise<ListMember> {
    return apiClient.post<ListMember>("/api/users/lists/update-membership", {
      listId,
      userId,
      withReplies,
    });
  },

  /**
   * Get list timeline (notes from list members)
   *
   * @param listId - List ID
   * @param options - Timeline options
   * @returns Notes from list members
   */
  async getTimeline(listId: string, options: ListTimelineOptions = {}): Promise<Note[]> {
    const params = new URLSearchParams({ listId });
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.sinceId) params.set("sinceId", options.sinceId);
    if (options.untilId) params.set("untilId", options.untilId);
    return apiClient.get<Note[]>(`/api/users/lists/timeline?${params.toString()}`);
  },

  /**
   * Get lists containing a specific user (owned by current user)
   *
   * @param userId - User ID to check
   * @returns Lists containing the user
   */
  async getContaining(userId: string): Promise<List[]> {
    return apiClient.post<List[]>("/api/users/lists/get-containing", { userId });
  },
};
