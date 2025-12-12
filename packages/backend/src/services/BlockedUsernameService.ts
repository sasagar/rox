/**
 * Blocked Username Service
 *
 * Manages username restrictions for registration.
 * Combines hardcoded defaults with admin-configurable database patterns.
 *
 * @module services/BlockedUsernameService
 */

import type { BlockedUsername } from "../db/schema/pg.js";
import type { IBlockedUsernameRepository } from "../interfaces/repositories/IBlockedUsernameRepository.js";
import { isDefaultReservedUsername } from "shared";

/**
 * Result of username block check
 */
export interface UsernameBlockCheckResult {
  /** Whether the username is blocked */
  blocked: boolean;
  /** Reason for blocking (if blocked) */
  reason?: string;
  /** Source of the block: 'default' (hardcoded) or 'custom' (database) */
  source?: "default" | "custom";
  /** The pattern that matched (for custom blocks) */
  matchedPattern?: string;
}

/**
 * Service for managing blocked usernames
 */
export class BlockedUsernameService {
  constructor(private blockedUsernameRepository: IBlockedUsernameRepository) {}

  /**
   * Check if a username is blocked
   * Checks both default reserved list and custom database patterns
   *
   * @param username - Username to check
   * @returns Block check result with source and reason
   */
  async isUsernameBlocked(username: string): Promise<UsernameBlockCheckResult> {
    // Check hardcoded default reserved usernames first
    if (isDefaultReservedUsername(username)) {
      return {
        blocked: true,
        reason: "This username is reserved by the system",
        source: "default",
      };
    }

    // Check custom database patterns
    const matchingPattern = await this.blockedUsernameRepository.findMatchingPattern(username);
    if (matchingPattern) {
      return {
        blocked: true,
        reason: matchingPattern.reason || "This username is not allowed",
        source: "custom",
        matchedPattern: matchingPattern.pattern,
      };
    }

    return { blocked: false };
  }

  /**
   * Get all custom blocked username patterns from database
   *
   * @returns Array of blocked username patterns
   */
  async getAll(): Promise<BlockedUsername[]> {
    return this.blockedUsernameRepository.findAll();
  }

  /**
   * Get a blocked username by ID
   *
   * @param id - Blocked username ID
   * @returns BlockedUsername or null
   */
  async getById(id: string): Promise<BlockedUsername | null> {
    return this.blockedUsernameRepository.findById(id);
  }

  /**
   * Add a new blocked username pattern
   *
   * @param pattern - Pattern to block (exact string or regex)
   * @param isRegex - Whether pattern is a regex
   * @param reason - Optional reason for blocking
   * @param createdById - ID of admin who created this block
   * @returns Created BlockedUsername
   * @throws Error if pattern is invalid or already exists
   */
  async add(
    pattern: string,
    isRegex: boolean,
    reason?: string,
    createdById?: string,
  ): Promise<BlockedUsername> {
    // Validate pattern
    if (!pattern || pattern.trim().length === 0) {
      throw new Error("Pattern cannot be empty");
    }

    // Validate regex if applicable
    if (isRegex && !this.isValidRegex(pattern)) {
      throw new Error("Invalid regular expression pattern");
    }

    // Check if pattern already exists
    const existing = await this.blockedUsernameRepository.findByPattern(pattern);
    if (existing) {
      throw new Error("This pattern already exists");
    }

    return this.blockedUsernameRepository.create({
      pattern: pattern.trim(),
      isRegex,
      reason: reason?.trim() || undefined,
      createdById,
    });
  }

  /**
   * Remove a blocked username pattern
   *
   * @param id - Blocked username ID
   * @returns true if deleted, false if not found
   */
  async remove(id: string): Promise<boolean> {
    return this.blockedUsernameRepository.delete(id);
  }

  /**
   * Test if a username would be blocked
   * Useful for admin UI to test patterns
   *
   * @param username - Username to test
   * @returns Block check result
   */
  async testUsername(username: string): Promise<UsernameBlockCheckResult> {
    return this.isUsernameBlocked(username);
  }

  /**
   * Validate a regex pattern
   *
   * @param pattern - Regex pattern to validate
   * @returns true if valid regex
   */
  isValidRegex(pattern: string): boolean {
    try {
      new RegExp(pattern, "i");
      return true;
    } catch {
      return false;
    }
  }
}
