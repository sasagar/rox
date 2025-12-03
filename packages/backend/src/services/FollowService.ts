/**
 * Follow Management Service
 *
 * Handles follow/unfollow operations, follower/following list retrieval.
 * Integrates with IFollowRepository for persistence and IUserRepository for user validation.
 *
 * @module services/FollowService
 */

import type { IFollowRepository } from "../interfaces/repositories/IFollowRepository.js";
import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { Follow } from "../../../shared/src/types/user.js";
import { generateId } from "../../../shared/src/utils/id.js";
import type { ActivityPubDeliveryService } from "./ap/ActivityPubDeliveryService.js";
import type { NotificationService } from "./NotificationService.js";

/**
 * Follow Service
 *
 * Provides business logic for follow operations including:
 * - Creating follow relationships with validation
 * - Preventing duplicate follows
 * - Unfollowing users
 * - Retrieving follower/following lists
 * - Counting followers/following
 *
 * @remarks
 * - Users cannot follow themselves
 * - Follow relationships are unique (follower + followee combination)
 * - Unfollowing a non-existent relationship is idempotent (no error)
 */
export class FollowService {
  /**
   * FollowService Constructor
   *
   * @param followRepository - Follow repository
   * @param userRepository - User repository
   * @param deliveryService - ActivityPub delivery service (optional, for federation)
   * @param notificationService - Notification service (optional, for notifications)
   */
  constructor(
    private readonly followRepository: IFollowRepository,
    private readonly userRepository: IUserRepository,
    private readonly deliveryService?: ActivityPubDeliveryService,
    private readonly notificationService?: NotificationService,
  ) {}

  /**
   * Create a follow relationship
   *
   * Validates that both users exist, the follower is not following themselves,
   * and the follow relationship doesn't already exist.
   *
   * @param followerId - User ID who wants to follow
   * @param followeeId - User ID to be followed
   * @returns Created Follow record
   * @throws Error if follower or followee not found
   * @throws Error if trying to follow oneself
   * @throws Error if already following
   *
   * @example
   * ```typescript
   * const follow = await followService.follow(user.id, targetUserId);
   * ```
   */
  async follow(followerId: string, followeeId: string): Promise<Follow> {
    // 自分自身をフォローできない
    if (followerId === followeeId) {
      throw new Error("Cannot follow yourself");
    }

    // フォローする人が存在するか確認
    const follower = await this.userRepository.findById(followerId);
    if (!follower) {
      throw new Error("Follower not found");
    }

    // フォローされる人が存在するか確認
    const followee = await this.userRepository.findById(followeeId);
    if (!followee) {
      throw new Error("Followee not found");
    }

    // 既にフォローしているか確認
    const exists = await this.followRepository.exists(followerId, followeeId);
    if (exists) {
      throw new Error("Already following");
    }

    // フォロー関係を作成
    const follow = await this.followRepository.create({
      id: generateId(),
      followerId,
      followeeId,
    });

    // If federation is enabled and followee is remote, send Follow activity
    if (this.deliveryService && followee.host) {
      // Fire-and-forget delivery (don't await to avoid blocking)
      this.deliveryService.deliverFollow(follower, followee).catch((error) => {
        console.error(`Failed to deliver Follow activity:`, error);
      });
    }

    // Create notification for the followee (only for local users)
    if (this.notificationService && !followee.host) {
      this.notificationService.createFollowNotification(followeeId, followerId).catch((error) => {
        console.error(`Failed to create follow notification:`, error);
      });
    }

    return follow;
  }

  /**
   * Delete a follow relationship (unfollow)
   *
   * Removes the follow relationship between follower and followee.
   * If the followee is a remote user, sends an Undo Follow activity via ActivityPub.
   * This operation is idempotent - no error if relationship doesn't exist.
   *
   * @param followerId - User ID who wants to unfollow
   * @param followeeId - User ID to be unfollowed
   *
   * @example
   * ```typescript
   * await followService.unfollow(user.id, targetUserId);
   * ```
   *
   * @remarks
   * - Sends Undo Follow activity to remote users automatically
   * - ActivityPub delivery is fire-and-forget (non-blocking)
   */
  async unfollow(followerId: string, followeeId: string): Promise<void> {
    // Get follower and followee info for ActivityPub delivery
    const follower = await this.userRepository.findById(followerId);
    const followee = await this.userRepository.findById(followeeId);

    // Delete the follow relationship from local database
    await this.followRepository.delete(followerId, followeeId);

    // If federation is enabled and followee is remote, send Undo Follow activity
    if (this.deliveryService && follower && followee && followee.host) {
      // Fire-and-forget delivery (don't await to avoid blocking)
      this.deliveryService.deliverUndoFollow(follower, followee).catch((error) => {
        console.error(`Failed to deliver Undo Follow activity:`, error);
      });
    }
  }

  /**
   * Get follower list
   *
   * Returns users who follow the specified user.
   *
   * @param userId - User ID
   * @param limit - Maximum number of followers to retrieve (default: 100)
   * @returns List of Follow records
   *
   * @example
   * ```typescript
   * const followers = await followService.getFollowers(user.id, 50);
   * ```
   */
  async getFollowers(userId: string, limit?: number): Promise<Follow[]> {
    return await this.followRepository.findByFolloweeId(userId, limit);
  }

  /**
   * Get following list
   *
   * Returns users that the specified user is following.
   *
   * @param userId - User ID
   * @param limit - Maximum number of following to retrieve (default: 100)
   * @returns List of Follow records
   *
   * @example
   * ```typescript
   * const following = await followService.getFollowing(user.id, 50);
   * ```
   */
  async getFollowing(userId: string, limit?: number): Promise<Follow[]> {
    return await this.followRepository.findByFollowerId(userId, limit);
  }

  /**
   * Get follower count
   *
   * Returns the number of users following the specified user.
   *
   * @param userId - User ID
   * @returns Follower count
   *
   * @example
   * ```typescript
   * const count = await followService.getFollowerCount(user.id);
   * ```
   */
  async getFollowerCount(userId: string): Promise<number> {
    return await this.followRepository.countFollowers(userId);
  }

  /**
   * Get following count
   *
   * Returns the number of users that the specified user is following.
   *
   * @param userId - User ID
   * @returns Following count
   *
   * @example
   * ```typescript
   * const count = await followService.getFollowingCount(user.id);
   * ```
   */
  async getFollowingCount(userId: string): Promise<number> {
    return await this.followRepository.countFollowing(userId);
  }

  /**
   * Check if a follow relationship exists
   *
   * Returns true if followerId is following followeeId.
   *
   * @param followerId - User ID of potential follower
   * @param followeeId - User ID of potential followee
   * @returns True if following, false otherwise
   *
   * @example
   * ```typescript
   * const isFollowing = await followService.isFollowing(user.id, targetUserId);
   * ```
   */
  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return await this.followRepository.exists(followerId, followeeId);
  }
}
