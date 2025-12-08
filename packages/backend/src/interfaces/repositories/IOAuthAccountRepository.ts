import type { OAuthAccount, NewOAuthAccount } from "../../db/schema/pg.js";

/**
 * Supported OAuth providers
 */
export type OAuthProvider = "github" | "google" | "discord" | "mastodon";

/**
 * OAuth Account Repository Interface
 *
 * Handles storage and retrieval of OAuth account links.
 * Each user can have multiple OAuth providers linked to their account.
 */
export interface IOAuthAccountRepository {
  /**
   * Create a new OAuth account link
   *
   * @param account - OAuth account data to store
   * @returns Created OAuth account
   */
  create(account: NewOAuthAccount): Promise<OAuthAccount>;

  /**
   * Find OAuth account by ID
   *
   * @param id - OAuth account primary key ID
   * @returns OAuth account if found, null otherwise
   */
  findById(id: string): Promise<OAuthAccount | null>;

  /**
   * Find OAuth account by provider and provider account ID
   * Used during OAuth login to find existing linked account
   *
   * @param provider - OAuth provider name
   * @param providerAccountId - User ID from the OAuth provider
   * @returns OAuth account if found, null otherwise
   */
  findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<OAuthAccount | null>;

  /**
   * Find OAuth account for a specific user and provider
   * Used to check if user already has this provider linked
   *
   * @param userId - User ID
   * @param provider - OAuth provider name
   * @returns OAuth account if found, null otherwise
   */
  findByUserAndProvider(userId: string, provider: OAuthProvider): Promise<OAuthAccount | null>;

  /**
   * Find all OAuth accounts for a user
   *
   * @param userId - User ID
   * @returns Array of OAuth accounts linked to the user
   */
  findByUserId(userId: string): Promise<OAuthAccount[]>;

  /**
   * Update OAuth account tokens
   * Used when refreshing tokens or updating scope
   *
   * @param id - OAuth account ID
   * @param data - Token data to update
   * @returns Updated OAuth account
   */
  updateTokens(
    id: string,
    data: {
      accessToken?: string | null;
      refreshToken?: string | null;
      tokenExpiresAt?: Date | null;
      scope?: string | null;
    },
  ): Promise<OAuthAccount>;

  /**
   * Delete an OAuth account link
   *
   * @param id - OAuth account ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete OAuth account by user and provider
   * Used when user wants to unlink a specific provider
   *
   * @param userId - User ID
   * @param provider - OAuth provider name
   */
  deleteByUserAndProvider(userId: string, provider: OAuthProvider): Promise<void>;

  /**
   * Delete all OAuth accounts for a user
   *
   * @param userId - User ID
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * Count OAuth accounts for a user
   *
   * @param userId - User ID
   * @returns Number of linked OAuth accounts
   */
  countByUserId(userId: string): Promise<number>;
}
