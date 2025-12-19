/**
 * System Account Service
 *
 * Manages the server's system account (Application actor) for
 * server-level operations like signing HTTP requests for remote
 * actor fetches.
 *
 * @module services/SystemAccountService
 */

import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { IFollowRepository } from "../interfaces/repositories/IFollowRepository.js";
import type { IListRepository } from "../interfaces/repositories/IListRepository.js";
import type { User } from "../db/schema/pg.js";
import { generateKeyPair } from "../utils/crypto.js";
import { generateId } from "shared";
import { logger } from "../lib/logger.js";
import type { FollowService } from "./FollowService.js";

/**
 * System account username
 *
 * This username is reserved in DEFAULT_RESERVED_USERNAMES
 */
export const SYSTEM_USERNAME = "system";

/**
 * HTTP Signature configuration
 */
export interface SignatureConfig {
  keyId: string;
  privateKey: string;
}

/**
 * System Account Service
 *
 * Manages the server's system account for server-level operations.
 * The system account is an ActivityPub Application actor that:
 * - Has its own RSA keypair for HTTP Signatures
 * - Cannot be logged into (no password authentication)
 * - Is automatically created on server startup
 */
export class SystemAccountService {
  private followService?: FollowService;
  private followRepository?: IFollowRepository;
  private listRepository?: IListRepository;

  constructor(private userRepository: IUserRepository) {}

  /**
   * Set optional dependencies for system follow management
   *
   * These are set separately to avoid circular dependency issues during DI setup.
   *
   * @param followService - Follow service for follow/unfollow operations
   * @param followRepository - Follow repository for checking follow status
   * @param listRepository - List repository for reference counting
   */
  setFollowDependencies(
    followService: FollowService,
    followRepository: IFollowRepository,
    listRepository: IListRepository,
  ): void {
    this.followService = followService;
    this.followRepository = followRepository;
    this.listRepository = listRepository;
  }

  /**
   * Get or create the system account
   *
   * Ensures a system account exists, creating it if necessary.
   * Called during application startup.
   *
   * @returns The system user account
   */
  async ensureSystemAccount(): Promise<User> {
    // Check if system account already exists
    let systemUser = await this.userRepository.findSystemUser();

    if (systemUser) {
      logger.debug("System account already exists");
      return systemUser;
    }

    // Create new system account
    logger.info("Creating system account");

    const { publicKey, privateKey } = generateKeyPair();
    const baseUrl = process.env.URL || "http://localhost:3000";

    systemUser = await this.userRepository.create({
      id: generateId(),
      username: SYSTEM_USERNAME,
      email: `${SYSTEM_USERNAME}@localhost`, // Placeholder, not used for login
      passwordHash: "", // Empty - cannot login
      displayName: "System",
      host: null, // Local user
      avatarUrl: null,
      bannerUrl: null,
      bio: "System account for server operations",
      isAdmin: false,
      isSuspended: false,
      isDeleted: false,
      isSystemUser: true, // Mark as system user
      deletedAt: null,
      publicKey,
      privateKey,
      customCss: null,
      uiSettings: null,
      inbox: `${baseUrl}/users/${SYSTEM_USERNAME}/inbox`,
      outbox: `${baseUrl}/users/${SYSTEM_USERNAME}/outbox`,
      followersUrl: `${baseUrl}/users/${SYSTEM_USERNAME}/followers`,
      followingUrl: `${baseUrl}/users/${SYSTEM_USERNAME}/following`,
      uri: `${baseUrl}/users/${SYSTEM_USERNAME}`,
      sharedInbox: null,
      alsoKnownAs: [],
      movedTo: null,
      movedAt: null,
      profileEmojis: [],
      storageQuotaMb: null,
      goneDetectedAt: null,
      fetchFailureCount: 0,
      lastFetchAttemptAt: null,
      lastFetchError: null,
      followersCount: 0,
      followingCount: 0,
    });

    logger.info({ userId: systemUser.id }, "System account created successfully");
    return systemUser;
  }

  /**
   * Get the system account
   *
   * Returns the system user without creating it if it doesn't exist.
   *
   * @returns System user if exists, null otherwise
   */
  async getSystemAccount(): Promise<User | null> {
    return this.userRepository.findSystemUser();
  }

  /**
   * Get signature configuration for HTTP signing
   *
   * Returns the key ID and private key needed for HTTP Signatures.
   *
   * @returns SignatureConfig or null if system account not found
   */
  async getSignatureConfig(): Promise<SignatureConfig | null> {
    const systemUser = await this.userRepository.findSystemUser();
    if (!systemUser?.privateKey) {
      return null;
    }

    const baseUrl = process.env.URL || "http://localhost:3000";
    return {
      keyId: `${baseUrl}/users/${systemUser.username}#main-key`,
      privateKey: systemUser.privateKey,
    };
  }

  /**
   * Check if system account follows a user
   *
   * @param userId - User ID to check
   * @returns True if system account follows the user
   */
  async isFollowingUser(userId: string): Promise<boolean> {
    if (!this.followRepository) {
      return false;
    }

    const systemAccount = await this.getSystemAccount();
    if (!systemAccount) {
      return false;
    }

    return this.followRepository.exists(systemAccount.id, userId);
  }

  /**
   * Ensure system account follows a remote user
   *
   * This is idempotent - if already following, does nothing.
   * Only operates on remote users (users with a host).
   *
   * @param userId - Remote user ID to follow
   */
  async ensureSystemFollow(userId: string): Promise<void> {
    if (!this.followService || !this.followRepository) {
      logger.debug("Follow dependencies not set, skipping system follow");
      return;
    }

    const systemAccount = await this.getSystemAccount();
    if (!systemAccount) {
      logger.warn("System account not found, cannot create system follow");
      return;
    }

    // Check if user exists and is remote
    const targetUser = await this.userRepository.findById(userId);
    if (!targetUser) {
      logger.warn({ userId }, "Target user not found for system follow");
      return;
    }

    // Only follow remote users
    if (!targetUser.host) {
      logger.debug({ userId }, "Skipping system follow for local user");
      return;
    }

    // Check if already following (idempotent)
    const alreadyFollowing = await this.followRepository.exists(systemAccount.id, userId);
    if (alreadyFollowing) {
      logger.debug({ userId }, "System account already follows user");
      return;
    }

    try {
      await this.followService.follow(systemAccount.id, userId);
      logger.info({ userId, host: targetUser.host }, "System account now follows remote user");
    } catch (error) {
      // Log but don't throw - this is a best-effort operation
      logger.warn({ userId, error }, "Failed to create system follow");
    }
  }

  /**
   * Remove system follow if no lists contain the user
   *
   * Uses reference counting to determine if the system follow should be removed.
   * Only removes the follow if no lists contain this user.
   *
   * @param userId - User ID to potentially unfollow
   */
  async removeSystemFollowIfOrphaned(userId: string): Promise<void> {
    if (!this.followService || !this.followRepository || !this.listRepository) {
      logger.debug("Follow dependencies not set, skipping system unfollow check");
      return;
    }

    const systemAccount = await this.getSystemAccount();
    if (!systemAccount) {
      return;
    }

    // Check if system account follows this user
    const isFollowing = await this.followRepository.exists(systemAccount.id, userId);
    if (!isFollowing) {
      return;
    }

    // Check reference count - how many lists contain this user?
    const listCount = await this.listRepository.countListsContainingUser(userId);
    if (listCount > 0) {
      logger.debug({ userId, listCount }, "User still in lists, keeping system follow");
      return;
    }

    try {
      await this.followService.unfollow(systemAccount.id, userId);
      logger.info({ userId }, "Removed orphaned system follow");
    } catch (error) {
      logger.warn({ userId, error }, "Failed to remove orphaned system follow");
    }
  }
}
