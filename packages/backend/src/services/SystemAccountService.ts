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
import type { User } from "../db/schema/pg.js";
import { generateKeyPair } from "../utils/crypto.js";
import { generateId } from "shared";
import { logger } from "../lib/logger.js";

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
  constructor(private userRepository: IUserRepository) {}

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
}
