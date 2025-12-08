/**
 * User Deletion Service
 *
 * Handles user account deletion including:
 * - Soft delete (marking as deleted) for ActivityPub compliance
 * - Sending Delete activities to followers
 * - Cleaning up associated data (sessions, follows, etc.)
 *
 * According to ActivityPub spec:
 * - Deleted actors should return 410 Gone
 * - A Delete activity with Tombstone should be sent to followers
 *
 * @module services/UserDeletionService
 */

import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { IFollowRepository } from "../interfaces/repositories/IFollowRepository.js";
import type { ISessionRepository } from "../interfaces/repositories/ISessionRepository.js";
import type { INoteRepository } from "../interfaces/repositories/INoteRepository.js";
import type { User } from "../db/schema/pg.js";
import type { ActivityPubDeliveryService } from "./ap/ActivityPubDeliveryService.js";
import { logger } from "../lib/logger.js";

/**
 * Options for user deletion
 */
export interface UserDeletionOptions {
  /** Whether to delete all notes (for local users only) */
  deleteNotes?: boolean;
  /** Admin who initiated the deletion (for audit logging) */
  deletedBy?: string;
}

/**
 * Result of user deletion operation
 */
export interface UserDeletionResult {
  success: boolean;
  message: string;
  deletedUserId: string;
  isRemoteUser: boolean;
  activitiesSent?: number;
}

/**
 * User Deletion Service
 *
 * Provides methods to safely delete user accounts while maintaining
 * ActivityPub federation compliance.
 */
export class UserDeletionService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly followRepository: IFollowRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly noteRepository: INoteRepository,
    private readonly activityPubDeliveryService: ActivityPubDeliveryService,
  ) {}

  /**
   * Delete a local user account
   *
   * This performs a soft delete by:
   * 1. Marking the user as deleted (isDeleted = true)
   * 2. Invalidating all sessions
   * 3. Optionally deleting all notes
   * 4. Sending Delete activity to all followers
   *
   * @param userId - ID of the user to delete
   * @param options - Deletion options
   * @returns Deletion result
   */
  async deleteLocalUser(userId: string, options: UserDeletionOptions = {}): Promise<UserDeletionResult> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return {
        success: false,
        message: "User not found",
        deletedUserId: userId,
        isRemoteUser: false,
      };
    }

    // Cannot delete remote users with this method
    if (user.host !== null) {
      return {
        success: false,
        message: "Cannot delete remote users. Use deleteRemoteUser instead.",
        deletedUserId: userId,
        isRemoteUser: true,
      };
    }

    // Cannot delete admin users (safety measure)
    if (user.isAdmin) {
      return {
        success: false,
        message: "Cannot delete admin users. Remove admin status first.",
        deletedUserId: userId,
        isRemoteUser: false,
      };
    }

    // Already deleted
    if (user.isDeleted) {
      return {
        success: false,
        message: "User is already deleted",
        deletedUserId: userId,
        isRemoteUser: false,
      };
    }

    logger.info({ userId, username: user.username }, "Starting user deletion");

    try {
      // 1. Mark user as deleted
      await this.userRepository.update(userId, {
        isDeleted: true,
        deletedAt: new Date(),
        // Clear sensitive data but keep username for Tombstone
        passwordHash: "", // Clear password
        privateKey: null, // Clear private key (can no longer sign activities)
        email: `deleted_${userId}@deleted.local`, // Clear email but maintain uniqueness
        bio: null,
        avatarUrl: null,
        bannerUrl: null,
      });

      // 2. Invalidate all sessions
      await this.sessionRepository.deleteByUserId(userId);

      // 3. Remove all follows (both directions)
      await this.removeFollowRelationships(userId);

      // 4. Optionally delete all notes
      if (options.deleteNotes) {
        await this.deleteUserNotes(userId);
      }

      // 5. Send Delete activity to all followers
      const activitiesSent = await this.sendDeleteActorActivity(user);

      logger.info(
        { userId, username: user.username, activitiesSent },
        "User deletion completed successfully",
      );

      return {
        success: true,
        message: "User deleted successfully",
        deletedUserId: userId,
        isRemoteUser: false,
        activitiesSent,
      };
    } catch (error) {
      logger.error({ userId, error }, "Failed to delete user");
      throw error;
    }
  }

  /**
   * Mark a remote user as deleted
   *
   * This is called when receiving a Delete activity for an actor.
   * Remote users are soft-deleted to prevent re-federation.
   *
   * @param userId - ID of the remote user to mark as deleted
   * @returns Deletion result
   */
  async deleteRemoteUser(userId: string): Promise<UserDeletionResult> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return {
        success: false,
        message: "User not found",
        deletedUserId: userId,
        isRemoteUser: true,
      };
    }

    if (user.host === null) {
      return {
        success: false,
        message: "This is a local user. Use deleteLocalUser instead.",
        deletedUserId: userId,
        isRemoteUser: false,
      };
    }

    if (user.isDeleted) {
      return {
        success: true,
        message: "User was already deleted",
        deletedUserId: userId,
        isRemoteUser: true,
      };
    }

    logger.info({ userId, username: user.username, host: user.host }, "Marking remote user as deleted");

    try {
      // Mark as deleted
      await this.userRepository.update(userId, {
        isDeleted: true,
        deletedAt: new Date(),
      });

      // Remove follow relationships with local users
      await this.removeFollowRelationships(userId);

      return {
        success: true,
        message: "Remote user marked as deleted",
        deletedUserId: userId,
        isRemoteUser: true,
      };
    } catch (error) {
      logger.error({ userId, error }, "Failed to mark remote user as deleted");
      throw error;
    }
  }

  /**
   * Remove all follow relationships for a user
   */
  private async removeFollowRelationships(userId: string): Promise<void> {
    // Use the repository method that deletes all follow relationships for a user
    await this.followRepository.deleteByUserId(userId);
    logger.debug({ userId }, "Removed all follow relationships");
  }

  /**
   * Delete all notes by a user
   */
  private async deleteUserNotes(userId: string): Promise<void> {
    // Get all user's notes and delete them in batches
    let deletedCount = 0;
    let hasMore = true;

    while (hasMore) {
      const notes = await this.noteRepository.findByUserId(userId, { limit: 100 });
      if (notes.length === 0) {
        hasMore = false;
        break;
      }

      for (const note of notes) {
        await this.noteRepository.delete(note.id);
        deletedCount++;
      }
    }

    logger.debug({ userId, notesDeleted: deletedCount }, "Deleted user notes");
  }

  /**
   * Send Delete activity for an actor to all followers
   *
   * According to ActivityPub spec, the Delete activity should contain:
   * - type: "Delete"
   * - actor: the actor URI
   * - object: the actor URI
   *
   * @param user - The user being deleted (must still have privateKey)
   * @returns Number of inboxes the activity was sent to
   */
  private async sendDeleteActorActivity(user: User): Promise<number> {
    try {
      // Use the delivery service which handles inbox collection and signing
      const inboxCount = await this.activityPubDeliveryService.deliverDeleteActor(user);
      return inboxCount;
    } catch (error) {
      logger.warn({ userId: user.id, error }, "Failed to send Delete actor activity");
      return 0;
    }
  }

  /**
   * Check if a user is deleted
   *
   * @param userId - ID of the user to check
   * @returns true if the user is deleted
   */
  async isUserDeleted(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    return user?.isDeleted ?? false;
  }

  /**
   * Check if a user by username is deleted
   *
   * @param username - Username to check
   * @param host - Host (null for local users)
   * @returns true if the user is deleted
   */
  async isUserDeletedByUsername(username: string, host: string | null = null): Promise<boolean> {
    const user = await this.userRepository.findByUsername(username, host);
    return user?.isDeleted ?? false;
  }
}
