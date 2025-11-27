/**
 * Custom Emoji Repository Interface
 *
 * Provides methods for managing instance-level custom emojis.
 *
 * @module interfaces/repositories/ICustomEmojiRepository
 */

import type { CustomEmoji, NewCustomEmoji } from '../../db/schema/pg.js';

/**
 * Options for listing custom emojis
 */
export interface ListCustomEmojisOptions {
  /** Filter by host (null for local emojis) */
  host?: string | null;
  /** Filter by category */
  category?: string;
  /** Search by name (partial match) */
  search?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Include sensitive emojis */
  includeSensitive?: boolean;
}

/**
 * Custom emoji repository interface
 */
export interface ICustomEmojiRepository {
  /**
   * Creates a new custom emoji
   * @param emoji - Emoji data
   * @returns Created emoji
   */
  create(emoji: NewCustomEmoji): Promise<CustomEmoji>;

  /**
   * Gets an emoji by ID
   * @param id - Emoji ID
   * @returns Emoji or null if not found
   */
  findById(id: string): Promise<CustomEmoji | null>;

  /**
   * Gets an emoji by name and host
   * @param name - Emoji shortcode (without colons)
   * @param host - Host domain (null for local)
   * @returns Emoji or null if not found
   */
  findByName(name: string, host?: string | null): Promise<CustomEmoji | null>;

  /**
   * Gets multiple emojis by names
   * @param names - Array of emoji shortcodes
   * @param host - Optional host filter (null for local)
   * @returns Map of name to emoji
   */
  findManyByNames(names: string[], host?: string | null): Promise<Map<string, CustomEmoji>>;

  /**
   * Lists emojis with optional filters
   * @param options - Filter options
   * @returns Array of emojis
   */
  list(options?: ListCustomEmojisOptions): Promise<CustomEmoji[]>;

  /**
   * Gets all local emojis (for federation and API responses)
   * @returns Array of local emojis
   */
  listLocal(): Promise<CustomEmoji[]>;

  /**
   * Gets all emoji categories
   * @returns Array of category names
   */
  listCategories(): Promise<string[]>;

  /**
   * Updates an emoji
   * @param id - Emoji ID
   * @param updates - Partial emoji data
   * @returns Updated emoji or null if not found
   */
  update(id: string, updates: Partial<NewCustomEmoji>): Promise<CustomEmoji | null>;

  /**
   * Deletes an emoji
   * @param id - Emoji ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Checks if an emoji name exists for a given host
   * @param name - Emoji shortcode
   * @param host - Host domain (null for local)
   * @returns True if exists
   */
  exists(name: string, host?: string | null): Promise<boolean>;

  /**
   * Counts emojis with optional filters
   * @param options - Filter options
   * @returns Count of emojis
   */
  count(options?: ListCustomEmojisOptions): Promise<number>;
}
