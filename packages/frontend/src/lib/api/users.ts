/**
 * User API client
 *
 * Provides methods for user-related API operations
 */

import { apiClient } from './client';
import type { User } from '../types/user';

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
   * @returns User data
   */
  async getByUsername(username: string): Promise<User> {
    return apiClient.get<User>(`/api/users/show?username=${username}`);
  },

  /**
   * Get current user's information
   *
   * @returns User data
   */
  async getMe(): Promise<User> {
    return apiClient.get<User>('/api/users/@me');
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
    return apiClient.patch<User>('/api/users/@me', data);
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
    if (limit) params.append('limit', limit.toString());
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
    if (limit) params.append('limit', limit.toString());
    return apiClient.get<Follow[]>(`/api/users/following?${params.toString()}`);
  },

  /**
   * Follow a user
   *
   * @param userId - User ID to follow
   * @returns Follow relationship
   */
  async follow(userId: string): Promise<Follow> {
    return apiClient.post<Follow>('/api/following/create', { userId });
  },

  /**
   * Unfollow a user
   *
   * @param userId - User ID to unfollow
   * @returns Success status
   */
  async unfollow(userId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>('/api/following/delete', { userId });
  },
};
