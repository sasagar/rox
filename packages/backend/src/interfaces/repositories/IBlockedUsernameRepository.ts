/**
 * Blocked Username Repository Interface
 *
 * Provides data access operations for admin-configurable username restrictions.
 * Used in conjunction with DEFAULT_RESERVED_USERNAMES from shared constants.
 *
 * @module interfaces/repositories/IBlockedUsernameRepository
 */

import type { BlockedUsername } from "../../db/schema/pg";

/**
 * Input for creating a new blocked username pattern
 */
export interface CreateBlockedUsernameInput {
  /** Pattern to block (exact string or regex) */
  pattern: string;
  /** Whether pattern is a regex (default: false = exact match) */
  isRegex?: boolean;
  /** Optional reason for blocking */
  reason?: string;
  /** Admin who created this block */
  createdById?: string;
}

/**
 * Repository interface for blocked username operations
 */
export interface IBlockedUsernameRepository {
  /**
   * Find all blocked username patterns
   *
   * @returns All blocked username entries
   */
  findAll(): Promise<BlockedUsername[]>;

  /**
   * Find a blocked username by ID
   *
   * @param id - Blocked username ID
   * @returns BlockedUsername or null if not found
   */
  findById(id: string): Promise<BlockedUsername | null>;

  /**
   * Find a blocked username by pattern
   *
   * @param pattern - Pattern to search for
   * @returns BlockedUsername or null if not found
   */
  findByPattern(pattern: string): Promise<BlockedUsername | null>;

  /**
   * Create a new blocked username pattern
   *
   * @param input - Creation input
   * @returns Created BlockedUsername
   */
  create(input: CreateBlockedUsernameInput): Promise<BlockedUsername>;

  /**
   * Delete a blocked username by ID
   *
   * @param id - Blocked username ID
   * @returns true if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if a username matches any blocked pattern
   * Only checks database patterns, not hardcoded defaults
   *
   * @param username - Username to check
   * @returns Matching BlockedUsername or null if not blocked
   */
  findMatchingPattern(username: string): Promise<BlockedUsername | null>;
}
