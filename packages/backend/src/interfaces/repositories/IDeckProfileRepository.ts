/**
 * Deck Profile Repository Interface
 *
 * Defines the contract for deck profile storage operations.
 * Implementations handle user deck layouts for the multi-column view.
 *
 * @module interfaces/repositories/IDeckProfileRepository
 */

import type { DeckProfile } from "shared";

export interface IDeckProfileRepository {
  /**
   * Create a new deck profile
   */
  create(profile: Omit<DeckProfile, "createdAt" | "updatedAt">): Promise<DeckProfile>;

  /**
   * Find deck profile by ID
   */
  findById(id: string): Promise<DeckProfile | null>;

  /**
   * Find all deck profiles owned by a user
   */
  findByUserId(userId: string): Promise<DeckProfile[]>;

  /**
   * Find the default deck profile for a user
   */
  findDefaultByUserId(userId: string): Promise<DeckProfile | null>;

  /**
   * Check if profile name already exists for user
   */
  existsByUserIdAndName(userId: string, name: string): Promise<boolean>;

  /**
   * Update deck profile
   */
  update(
    id: string,
    data: Partial<Pick<DeckProfile, "name" | "columns" | "isDefault">>,
  ): Promise<DeckProfile>;

  /**
   * Delete deck profile
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all deck profiles owned by a user
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * Clear the default flag for all profiles of a user
   * Used when setting a new default profile
   */
  clearDefaultForUser(userId: string): Promise<void>;

  /**
   * Count profiles for a user
   */
  countByUserId(userId: string): Promise<number>;
}
