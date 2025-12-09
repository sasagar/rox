/**
 * User API client
 *
 * Provides methods for user-related API operations
 */

import { apiClient } from "./client";
import type { User } from "../types/user";

export type { User };

/**
 * Follow relationship data structure
 */
export interface Follow {
  followerId: string;
  followeeId: string;
  follower?: User;
  followee?: User;
  createdAt: string;
}

/**
 * User API operations
 */
export const usersApi = {
  /**
   * Get user by ID
   *
   * @param userId - User ID
   * @returns User data
   */
  async getById(userId: string): Promise<User> {
    return apiClient.get<User>(`/api/users/${userId}`);
  },

  /**
   * Get user by username
   *
   * @param username - Username
   * @param host - Optional host for remote users
   * @returns User data
   */
  async getByUsername(username: string, host?: string | null): Promise<User> {
    if (host) {
      // For remote users, use resolve endpoint
      const acct = `${username}@${host}`;
      return apiClient.get<User>(`/api/users/resolve?acct=${encodeURIComponent(acct)}`);
    }
    return apiClient.get<User>(`/api/users/show?username=${username}`);
  },

  /**
   * Get current user's information
   *
   * @returns User data
   */
  async getMe(): Promise<User> {
    return apiClient.get<User>("/api/users/@me");
  },

  /**
   * Update current user's profile
   *
   * @param data - Update data
   * @returns Updated user data
   */
  async updateMe(data: {
    name?: string;
    description?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    customCss?: string;
  }): Promise<User> {
    return apiClient.patch<User>("/api/users/@me", data);
  },

  /**
   * Get user's followers
   *
   * @param userId - User ID
   * @param limit - Maximum number of followers to retrieve
   * @returns List of follow relationships
   */
  async getFollowers(userId: string, limit?: number): Promise<Follow[]> {
    const params = new URLSearchParams({ userId });
    if (limit) params.append("limit", limit.toString());
    return apiClient.get<Follow[]>(`/api/users/followers?${params.toString()}`);
  },

  /**
   * Get user's following
   *
   * @param userId - User ID
   * @param limit - Maximum number of following to retrieve
   * @returns List of follow relationships
   */
  async getFollowing(userId: string, limit?: number): Promise<Follow[]> {
    const params = new URLSearchParams({ userId });
    if (limit) params.append("limit", limit.toString());
    return apiClient.get<Follow[]>(`/api/users/following?${params.toString()}`);
  },

  /**
   * Follow a user
   *
   * @param userId - User ID to follow
   * @returns Follow relationship
   */
  async follow(userId: string): Promise<Follow> {
    return apiClient.post<Follow>("/api/following/create", { userId });
  },

  /**
   * Unfollow a user
   *
   * @param userId - User ID to unfollow
   * @returns Success status
   */
  async unfollow(userId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>("/api/following/delete", { userId });
  },

  /**
   * Upload avatar image
   *
   * @param file - Image file to upload
   * @returns Object containing the new avatar URL
   */
  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.upload<{ avatarUrl: string }>("/api/users/@me/avatar", formData);
  },

  /**
   * Delete avatar image
   *
   * @returns Success status
   */
  async deleteAvatar(): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>("/api/users/@me/avatar");
  },

  /**
   * Upload banner image
   *
   * @param file - Image file to upload
   * @returns Object containing the new banner URL
   */
  async uploadBanner(file: File): Promise<{ bannerUrl: string }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.upload<{ bannerUrl: string }>("/api/users/@me/banner", formData);
  },

  /**
   * Delete banner image
   *
   * @returns Success status
   */
  async deleteBanner(): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>("/api/users/@me/banner");
  },

  /**
   * Search users by username or display name
   *
   * @param query - Search query (min 1 character)
   * @param options - Search options
   * @returns List of matching users
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      localOnly?: boolean;
    },
  ): Promise<User[]> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    if (options?.localOnly) params.append("localOnly", "true");
    return apiClient.get<User[]>(`/api/users/search?${params.toString()}`);
  },
};
