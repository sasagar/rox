/**
 * Dragonfly Cache Adapter
 *
 * Implements ICacheService using Dragonfly (Redis-compatible) as the backend.
 * Uses ioredis for connection management.
 *
 * @module adapters/cache/DragonflyCacheAdapter
 */

import { Redis } from "ioredis";
import type { ICacheService, CacheSetOptions } from "../../interfaces/ICacheService.js";
import { logger } from "../../lib/logger.js";
import { recordCacheOperation } from "../../lib/metrics.js";

/**
 * Default TTL values in seconds
 */
export const CacheTTL = {
  /** Short-lived cache (30 seconds) - for frequently changing data */
  SHORT: 30,
  /** Medium cache (5 minutes) - for user profiles, etc. */
  MEDIUM: 300,
  /** Long cache (1 hour) - for rarely changing data */
  LONG: 3600,
  /** Very long cache (24 hours) - for static data */
  DAY: 86400,
} as const;

/**
 * Cache key prefixes for organization
 */
export const CachePrefix = {
  TIMELINE_LOCAL: "timeline:local",
  TIMELINE_HOME: "timeline:home",
  TIMELINE_SOCIAL: "timeline:social",
  TIMELINE_GLOBAL: "timeline:global",
  USER_PROFILE: "user:profile",
  USER_BY_USERNAME: "user:username",
  NOTE: "note",
  REMOTE_ACTOR: "remote:actor",
  INSTANCE_SETTINGS: "instance:settings",
  ROLE_POLICIES: "role:policies",
  PUBLIC_KEY: "pubkey",
} as const;

/**
 * Dragonfly Cache Adapter
 *
 * Provides caching functionality using Dragonfly (Redis-compatible database).
 */
export class DragonflyCacheAdapter implements ICacheService {
  private redis: Redis | null = null;
  private available: boolean = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  private async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 100, 1000);
        },
        connectTimeout: 5000,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      await this.redis.connect();
      await this.redis.ping();

      this.available = true;
      logger.debug("Dragonfly cache connected");
    } catch (error) {
      logger.debug({ err: error }, "Dragonfly cache not available, caching disabled");
      this.available = false;
      this.redis = null;
    }
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.available || !this.redis) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value === null) {
        recordCacheOperation("get", false);
        return null;
      }
      recordCacheOperation("get", true);
      return JSON.parse(value) as T;
    } catch (error) {
      logger.debug({ err: error, key }, "Cache get error");
      return null;
    }
  }

  /**
   * Set a cached value
   */
  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    if (!this.available || !this.redis) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (options?.ttl) {
        await this.redis.set(key, serialized, "EX", options.ttl);
      } else {
        await this.redis.set(key, serialized);
      }
      recordCacheOperation("set");
    } catch (error) {
      logger.debug({ err: error, key }, "Cache set error");
    }
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<void> {
    if (!this.available || !this.redis) {
      return;
    }

    try {
      await this.redis.del(key);
      recordCacheOperation("delete");
    } catch (error) {
      logger.debug({ err: error, key }, "Cache delete error");
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.available || !this.redis) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.debug({ err: error, pattern }, "Cache deletePattern error");
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.available || !this.redis) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.debug({ err: error, key }, "Cache exists error");
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.available || !this.redis) {
      return -2;
    }

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      logger.debug({ err: error, key }, "Cache ttl error");
      return -2;
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.available = false;
    }
  }
}
