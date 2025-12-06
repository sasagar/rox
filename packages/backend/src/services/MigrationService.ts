/**
 * Migration Service
 *
 * Handles account migration business logic including:
 * - Managing account aliases (alsoKnownAs)
 * - Validating migration targets
 * - Initiating account transfers (sending Move activities)
 * - Enforcing migration cooldown periods
 *
 * @module services/MigrationService
 */

import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { IFollowRepository } from "../interfaces/repositories/IFollowRepository.js";
import type { RemoteActorService } from "./ap/RemoteActorService.js";
import { ActivityDeliveryService } from "./ap/ActivityDeliveryService.js";
import { logger } from "../lib/logger.js";

/** Migration cooldown period in days */
const MIGRATION_COOLDOWN_DAYS = 30;

/** Maximum number of aliases per account */
const MAX_ALIASES = 5;

/**
 * Result of migration validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  targetAccount?: {
    uri: string;
    username: string;
    host: string;
    hasReverseAlias: boolean;
  };
}

/**
 * Result of initiating migration
 */
export interface MigrationResult {
  success: boolean;
  error?: string;
  movedTo?: string;
  followersNotified?: number;
}

/**
 * Migration Service
 *
 * Provides methods for managing account migration including
 * alias management, validation, and transfer initiation.
 */
export class MigrationService {
  private userRepository: IUserRepository;
  private followRepository: IFollowRepository;
  private remoteActorService: RemoteActorService;
  private baseUrl: string;

  constructor(
    userRepository: IUserRepository,
    followRepository: IFollowRepository,
    remoteActorService: RemoteActorService,
  ) {
    this.userRepository = userRepository;
    this.followRepository = followRepository;
    this.remoteActorService = remoteActorService;
    this.baseUrl = process.env.URL || "http://localhost:3000";
  }

  /**
   * Get aliases for a user
   *
   * @param userId - User ID
   * @returns Array of alias URIs
   */
  async getAliases(userId: string): Promise<string[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user.alsoKnownAs || [];
  }

  /**
   * Add an alias to a user's account
   *
   * @param userId - User ID
   * @param aliasUri - URI of the alias account
   * @returns Updated list of aliases
   */
  async addAlias(userId: string, aliasUri: string): Promise<string[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Validate URI format
    if (!this.isValidActorUri(aliasUri)) {
      throw new Error("Invalid actor URI format");
    }

    // Check if it's not self-referential
    const localUri = `${this.baseUrl}/users/${user.username}`;
    if (aliasUri === localUri) {
      throw new Error("Cannot add own account as alias");
    }

    const currentAliases = user.alsoKnownAs || [];

    // Check if alias already exists
    if (currentAliases.includes(aliasUri)) {
      throw new Error("Alias already exists");
    }

    // Check max aliases
    if (currentAliases.length >= MAX_ALIASES) {
      throw new Error(`Maximum ${MAX_ALIASES} aliases allowed`);
    }

    // Verify the remote account exists
    try {
      await this.remoteActorService.resolveActor(aliasUri);
    } catch {
      throw new Error("Could not verify remote account");
    }

    // Add alias
    const newAliases = [...currentAliases, aliasUri];
    await this.userRepository.update(userId, {
      alsoKnownAs: newAliases,
    });

    return newAliases;
  }

  /**
   * Remove an alias from a user's account
   *
   * @param userId - User ID
   * @param aliasUri - URI of the alias to remove
   * @returns Updated list of aliases
   */
  async removeAlias(userId: string, aliasUri: string): Promise<string[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const currentAliases = user.alsoKnownAs || [];

    if (!currentAliases.includes(aliasUri)) {
      throw new Error("Alias not found");
    }

    const newAliases = currentAliases.filter((a) => a !== aliasUri);
    await this.userRepository.update(userId, {
      alsoKnownAs: newAliases,
    });

    return newAliases;
  }

  /**
   * Check if user can perform migration (cooldown check)
   *
   * @param userId - User ID
   * @returns Whether migration is allowed and reason if not
   */
  async canMigrate(
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string; daysRemaining?: number }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return { allowed: false, reason: "User not found" };
    }

    // Check if already migrated
    if (user.movedTo) {
      return { allowed: false, reason: "Account has already migrated" };
    }

    // Check cooldown (based on movedAt from any previous migration)
    if (user.movedAt) {
      const daysSinceMigration = Math.floor(
        (Date.now() - user.movedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceMigration < MIGRATION_COOLDOWN_DAYS) {
        const daysRemaining = MIGRATION_COOLDOWN_DAYS - daysSinceMigration;
        return {
          allowed: false,
          reason: `Migration cooldown active. ${daysRemaining} days remaining.`,
          daysRemaining,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validate migration to target account
   *
   * @param userId - User ID initiating migration
   * @param targetUri - URI of target account
   * @returns Validation result
   */
  async validateMigration(userId: string, targetUri: string): Promise<ValidationResult> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return { valid: false, error: "User not found" };
    }

    // Check cooldown
    const canMigrateResult = await this.canMigrate(userId);
    if (!canMigrateResult.allowed) {
      return { valid: false, error: canMigrateResult.reason };
    }

    // Check if target is in our alsoKnownAs
    const aliases = user.alsoKnownAs || [];
    if (!aliases.includes(targetUri)) {
      return {
        valid: false,
        error: "Target account must be added as alias first",
      };
    }

    // Fetch and verify target account
    let targetActor;
    try {
      targetActor = await this.remoteActorService.resolveActor(targetUri, true);
    } catch {
      return { valid: false, error: "Could not fetch target account" };
    }

    if (!targetActor) {
      return { valid: false, error: "Target account not found" };
    }

    // Check reverse alias (target must have our account in their alsoKnownAs)
    const localUri = `${this.baseUrl}/users/${user.username}`;
    const hasReverseAlias = targetActor.alsoKnownAs?.includes(localUri) || false;

    return {
      valid: hasReverseAlias,
      error: hasReverseAlias ? undefined : "Target account does not have reverse alias configured",
      targetAccount: {
        uri: targetUri,
        username: targetActor.username,
        host: targetActor.host || "",
        hasReverseAlias,
      },
    };
  }

  /**
   * Initiate account migration
   *
   * Sends Move activity to all followers and sets movedTo on account.
   *
   * @param userId - User ID initiating migration
   * @param targetUri - URI of target account
   * @returns Migration result
   */
  async initiateMigration(userId: string, targetUri: string): Promise<MigrationResult> {
    // Validate first
    const validation = await this.validateMigration(userId, targetUri);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.privateKey) {
      return { success: false, error: "User not found or missing private key" };
    }

    const localUri = `${this.baseUrl}/users/${user.username}`;
    const keyId = `${localUri}#main-key`;

    // Set movedTo on our account
    await this.userRepository.update(userId, {
      movedTo: targetUri,
      movedAt: new Date(),
    });

    // Get all followers
    const followers = await this.followRepository.findByFolloweeId(userId);
    const deliveryService = new ActivityDeliveryService();

    // Create Move activity
    const moveActivity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Move",
      id: `${localUri}/activities/move-${Date.now()}`,
      actor: localUri,
      object: localUri,
      target: targetUri,
      to: [`${localUri}/followers`],
    };

    // Collect unique inboxes (prefer shared inbox for efficiency)
    const inboxMap = new Map<string, string>();
    for (const follow of followers) {
      const follower = await this.userRepository.findById(follow.followerId);
      if (follower && follower.host !== null) {
        // Remote follower
        const inbox = follower.sharedInbox || follower.inbox;
        if (inbox && !inboxMap.has(inbox)) {
          inboxMap.set(inbox, inbox);
        }
      }
    }

    // Send Move to all unique inboxes
    let notifiedCount = 0;
    for (const inbox of inboxMap.values()) {
      try {
        await deliveryService.deliver(moveActivity, inbox, keyId, user.privateKey);
        notifiedCount++;
      } catch (err) {
        logger.error({ err, inbox }, "Failed to deliver Move activity");
      }
    }

    logger.info(
      { from: localUri, to: targetUri, notifiedCount },
      "Migration initiated",
    );

    return {
      success: true,
      movedTo: targetUri,
      followersNotified: notifiedCount,
    };
  }

  /**
   * Get migration status for a user
   *
   * @param userId - User ID
   * @returns Migration status information
   */
  async getMigrationStatus(userId: string): Promise<{
    movedTo: string | null;
    movedAt: Date | null;
    aliases: string[];
    canMigrate: boolean;
    cooldownDaysRemaining?: number;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const canMigrateResult = await this.canMigrate(userId);

    return {
      movedTo: user.movedTo || null,
      movedAt: user.movedAt || null,
      aliases: user.alsoKnownAs || [],
      canMigrate: canMigrateResult.allowed,
      cooldownDaysRemaining: canMigrateResult.daysRemaining,
    };
  }

  /**
   * Validate actor URI format
   */
  private isValidActorUri(uri: string): boolean {
    try {
      const url = new URL(uri);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }
}
