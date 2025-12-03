/**
 * User Management Service
 *
 * Handles user profile operations and ActivityPub delivery.
 * Supports optional caching for user profiles.
 *
 * @module services/UserService
 */

import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { User } from "../db/schema/pg.js";
import type { ActivityPubDeliveryService } from "./ap/ActivityPubDeliveryService.js";
import type { ICacheService } from "../interfaces/ICacheService.js";
import { CacheTTL, CachePrefix } from "../adapters/cache/DragonflyCacheAdapter.js";

/**
 * User profile update input data
 */
export interface UserUpdateInput {
  /** Display name */
  displayName?: string;
  /** Bio/description */
  bio?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Header/banner URL */
  headerUrl?: string;
}

/**
 * User Service
 *
 * Provides business logic for user operations including:
 * - Profile updates with ActivityPub delivery
 * - User information retrieval with caching
 *
 * @remarks
 * When a local user updates their profile, Update activity is delivered
 * to all remote followers. User profiles are cached for 5 minutes.
 */
export class UserService {
  private readonly cacheService: ICacheService | null;

  /**
   * UserService Constructor
   *
   * @param userRepository - User repository
   * @param deliveryService - ActivityPub delivery service (injected via DI)
   * @param cacheService - Optional cache service for profile caching
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly deliveryService: ActivityPubDeliveryService,
    cacheService?: ICacheService,
  ) {
    this.cacheService = cacheService ?? null;
  }

  /**
   * Update user profile
   *
   * Updates user profile information and delivers Update activity to remote followers.
   *
   * @param userId - User ID
   * @param updateData - Profile update data
   * @returns Updated User record
   *
   * @example
   * ```typescript
   * const updatedUser = await userService.updateProfile('user123', {
   *   displayName: 'New Name',
   *   bio: 'Updated bio',
   * });
   * ```
   *
   * @remarks
   * - Only provided fields will be updated
   * - If user is local, Update activity is delivered to all remote followers
   * - Delivery is non-blocking (fire-and-forget)
   * - Cache is invalidated on profile update
   */
  async updateProfile(userId: string, updateData: UserUpdateInput): Promise<User> {
    // Update user in database
    const updatedUser = await this.userRepository.update(userId, updateData);

    // Invalidate cache for this user
    if (this.cacheService?.isAvailable()) {
      const cacheKey = `${CachePrefix.USER_PROFILE}:${userId}`;
      this.cacheService.delete(cacheKey).catch((error) => {
        console.warn(`Failed to invalidate user cache for ${userId}:`, error);
      });

      // Also invalidate username cache if we have the username
      if (updatedUser?.username) {
        const usernameKey = `${CachePrefix.USER_BY_USERNAME}:${updatedUser.username}`;
        this.cacheService.delete(usernameKey).catch((error) => {
          console.warn(`Failed to invalidate username cache for ${updatedUser.username}:`, error);
        });
      }
    }

    // Deliver Update activity to remote followers (async, non-blocking)
    if (updatedUser && !updatedUser.host) {
      // Only deliver if user is local
      this.deliveryService.deliverUpdate(updatedUser).catch((error) => {
        console.error(`Failed to deliver Update activity for user ${userId}:`, error);
      });
    }

    return updatedUser;
  }

  /**
   * Get user by ID
   *
   * Returns cached user if available, otherwise fetches from database.
   *
   * @param userId - User ID
   * @returns User record or null if not found
   */
  async findById(userId: string): Promise<User | null> {
    const cacheKey = `${CachePrefix.USER_PROFILE}:${userId}`;

    // Try cache first
    if (this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<User>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Fetch from database
    const user = await this.userRepository.findById(userId);

    // Cache the result (including null to avoid repeated DB hits)
    if (user && this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, user, { ttl: CacheTTL.MEDIUM });
    }

    return user;
  }

  /**
   * Get user by username
   *
   * Returns cached user if available, otherwise fetches from database.
   *
   * @param username - Username
   * @returns User record or null if not found
   */
  async findByUsername(username: string): Promise<User | null> {
    const cacheKey = `${CachePrefix.USER_BY_USERNAME}:${username}`;

    // Try cache first
    if (this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<User>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Fetch from database
    const user = await this.userRepository.findByUsername(username);

    // Cache the result
    if (user && this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, user, { ttl: CacheTTL.MEDIUM });
    }

    return user;
  }
}
