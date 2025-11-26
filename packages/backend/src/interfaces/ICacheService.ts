/**
 * Cache Service Interface
 *
 * Defines the contract for cache operations.
 * Can be implemented with Redis/Dragonfly, in-memory, or other cache backends.
 *
 * @module interfaces/ICacheService
 */

/**
 * Cache options for set operations
 */
export interface CacheSetOptions {
  /** Time to live in seconds */
  ttl?: number;
}

/**
 * Cache Service Interface
 *
 * Provides a unified interface for caching operations.
 */
export interface ICacheService {
  /**
   * Get a cached value
   *
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a cached value
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options (e.g., TTL)
   */
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;

  /**
   * Delete a cached value
   *
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Delete multiple keys matching a pattern
   *
   * @param pattern - Key pattern (e.g., "timeline:*")
   */
  deletePattern(pattern: string): Promise<void>;

  /**
   * Check if a key exists
   *
   * @param key - Cache key
   * @returns True if key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get remaining TTL for a key
   *
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  ttl(key: string): Promise<number>;

  /**
   * Check if cache is available
   *
   * @returns True if cache backend is connected
   */
  isAvailable(): boolean;
}
