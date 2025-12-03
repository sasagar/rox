/**
 * Rate Limiting Middleware
 *
 * Provides sliding window rate limiting for API endpoints.
 * Uses Dragonfly/Redis for distributed rate limit tracking.
 *
 * @module middleware/rateLimit
 */

import type { Context, Next } from "hono";
import type { ICacheService } from "../interfaces/ICacheService.js";
import type { RoleService } from "../services/RoleService.js";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  limit: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Key generator function
   * Returns the rate limit key (e.g., IP address, user ID)
   * @default IP-based key
   */
  keyGenerator?: (c: Context) => string;

  /**
   * Skip rate limiting for certain requests
   * @returns true to skip rate limiting
   */
  skip?: (c: Context) => boolean;

  /**
   * Custom response when rate limited
   */
  onRateLimit?: (c: Context, retryAfter: number) => Response;
}

/**
 * Preset rate limit configurations
 */
export const RateLimitPresets = {
  /**
   * Strict limit for registration
   * 5 requests per hour per IP
   */
  register: {
    limit: 5,
    windowSeconds: 3600, // 1 hour
  },

  /**
   * Login endpoint limit
   * 10 requests per minute per IP
   */
  login: {
    limit: 10,
    windowSeconds: 60, // 1 minute
  },

  /**
   * Note creation limit
   * 60 requests per minute per user
   */
  createNote: {
    limit: 60,
    windowSeconds: 60, // 1 minute
  },

  /**
   * General API limit
   * 300 requests per minute per IP
   */
  api: {
    limit: 300,
    windowSeconds: 60, // 1 minute
  },

  /**
   * ActivityPub inbox limit
   * 100 requests per minute per server
   */
  inbox: {
    limit: 100,
    windowSeconds: 60, // 1 minute
  },

  /**
   * Follow/unfollow operations
   * 30 requests per minute per user
   */
  follow: {
    limit: 30,
    windowSeconds: 60, // 1 minute
  },

  /**
   * Reaction operations
   * 60 requests per minute per user
   */
  reaction: {
    limit: 60,
    windowSeconds: 60, // 1 minute
  },

  /**
   * File upload limit
   * 20 uploads per minute per user
   */
  fileUpload: {
    limit: 20,
    windowSeconds: 60, // 1 minute
  },

  /**
   * Strict write operations (delete, update)
   * 30 requests per minute per user
   */
  write: {
    limit: 30,
    windowSeconds: 60, // 1 minute
  },
} as const;

/**
 * Rate limit prefix for cache keys
 */
const RATE_LIMIT_PREFIX = "ratelimit";

/**
 * Get client IP address from request
 *
 * Handles various proxy configurations and headers.
 *
 * @param c - Hono context
 * @returns Client IP address
 */
function getClientIP(c: Context): string {
  // Check common proxy headers
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    // Take the first IP in the chain (original client)
    const firstIP = forwarded.split(",")[0];
    return firstIP?.trim() || "127.0.0.1";
  }

  const realIP = c.req.header("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to connection info (may not be available in all environments)
  // Using a default for development
  return "127.0.0.1";
}

/**
 * Get server hostname from actor URI (for inbox rate limiting)
 *
 * @param c - Hono context
 * @returns Server hostname or null
 */
function getActorServer(c: Context): string | null {
  try {
    // Use the signature's keyId header to identify the sender server
    const signature = c.req.header("signature");
    if (signature) {
      const keyIdMatch = signature.match(/keyId="([^"]+)"/);
      if (keyIdMatch?.[1]) {
        const url = new URL(keyIdMatch[1]);
        return url.hostname;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Rate Limiting Middleware
 *
 * Implements sliding window rate limiting using cache service.
 * Falls back to allowing requests if cache is unavailable.
 *
 * @param config - Rate limit configuration
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * // Apply to specific route
 * app.post('/api/auth/register', rateLimit(RateLimitPresets.register), handler);
 *
 * // Custom configuration
 * app.use('/api/*', rateLimit({
 *   limit: 100,
 *   windowSeconds: 60,
 *   keyGenerator: (c) => c.get('user')?.id || getClientIP(c),
 * }));
 * ```
 */
export function rateLimit(config: RateLimitConfig) {
  const { limit, windowSeconds, keyGenerator = getClientIP, skip, onRateLimit } = config;

  return async (c: Context, next: Next) => {
    // Check if rate limiting should be skipped
    if (skip?.(c)) {
      return next();
    }

    const cacheService = c.get("cacheService") as ICacheService | undefined;

    // If cache is unavailable, allow the request (fail open)
    if (!cacheService?.isAvailable()) {
      return next();
    }

    const key = keyGenerator(c);
    const cacheKey = `${RATE_LIMIT_PREFIX}:${c.req.path}:${key}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    try {
      // Get current request timestamps
      const data = await cacheService.get<number[]>(cacheKey);
      const timestamps = data || [];

      // Filter to only include timestamps within the current window
      const windowStart = now - windowMs;
      const validTimestamps = timestamps.filter((t) => t > windowStart);

      // Check if rate limit exceeded
      if (validTimestamps.length >= limit) {
        // Calculate retry-after time
        const oldestTimestamp = Math.min(...validTimestamps);
        const retryAfterMs = oldestTimestamp + windowMs - now;
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

        // Set rate limit headers
        c.header("X-RateLimit-Limit", limit.toString());
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", Math.ceil((now + retryAfterMs) / 1000).toString());
        c.header("Retry-After", retryAfterSeconds.toString());

        // Custom response or default 429
        if (onRateLimit) {
          return onRateLimit(c, retryAfterSeconds);
        }

        return c.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
            retryAfter: retryAfterSeconds,
          },
          429,
        );
      }

      // Add current timestamp and save
      validTimestamps.push(now);
      await cacheService.set(cacheKey, validTimestamps, { ttl: windowSeconds });

      // Set rate limit headers
      c.header("X-RateLimit-Limit", limit.toString());
      c.header("X-RateLimit-Remaining", (limit - validTimestamps.length).toString());
      c.header("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000).toString());

      return next();
    } catch (error) {
      // On error, allow the request (fail open)
      console.warn("Rate limit check failed:", error);
      return next();
    }
  };
}

/**
 * Create rate limiter for authenticated endpoints
 *
 * Uses user ID as key when authenticated, falls back to IP.
 * Adjusts rate limit based on user's role rateLimitFactor.
 *
 * @param config - Rate limit configuration (without keyGenerator)
 * @returns Hono middleware function
 */
export function userRateLimit(config: Omit<RateLimitConfig, "keyGenerator">) {
  const { limit, windowSeconds, skip, onRateLimit } = config;

  return async (c: Context, next: Next) => {
    // Check if rate limiting should be skipped
    if (skip?.(c)) {
      return next();
    }

    const cacheService = c.get("cacheService") as ICacheService | undefined;

    // If cache is unavailable, allow the request (fail open)
    if (!cacheService?.isAvailable()) {
      return next();
    }

    const user = c.get("user") as { id: string } | undefined;
    const key = user?.id || getClientIP(c);

    // Get rate limit factor from RoleService if user is authenticated
    let effectiveLimit = limit;
    if (user?.id) {
      const roleService = c.get("roleService") as RoleService | undefined;
      if (roleService) {
        try {
          const factor = await roleService.getRateLimitFactor(user.id);
          // Factor > 1 means more lenient (higher limit)
          // Factor < 1 means stricter (lower limit)
          effectiveLimit = Math.floor(limit * factor);
        } catch {
          // On error, use default limit
        }
      }
    }

    const cacheKey = `${RATE_LIMIT_PREFIX}:${c.req.path}:${key}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    try {
      // Get current request timestamps
      const data = await cacheService.get<number[]>(cacheKey);
      const timestamps = data || [];

      // Filter to only include timestamps within the current window
      const windowStart = now - windowMs;
      const validTimestamps = timestamps.filter((t) => t > windowStart);

      // Check if rate limit exceeded
      if (validTimestamps.length >= effectiveLimit) {
        // Calculate retry-after time
        const oldestTimestamp = Math.min(...validTimestamps);
        const retryAfterMs = oldestTimestamp + windowMs - now;
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

        // Set rate limit headers
        c.header("X-RateLimit-Limit", effectiveLimit.toString());
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", Math.ceil((now + retryAfterMs) / 1000).toString());
        c.header("Retry-After", retryAfterSeconds.toString());

        // Custom response or default 429
        if (onRateLimit) {
          return onRateLimit(c, retryAfterSeconds);
        }

        return c.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
            retryAfter: retryAfterSeconds,
          },
          429,
        );
      }

      // Add current timestamp and save
      validTimestamps.push(now);
      await cacheService.set(cacheKey, validTimestamps, { ttl: windowSeconds });

      // Set rate limit headers
      c.header("X-RateLimit-Limit", effectiveLimit.toString());
      c.header("X-RateLimit-Remaining", (effectiveLimit - validTimestamps.length).toString());
      c.header("X-RateLimit-Reset", Math.ceil((now + windowMs) / 1000).toString());

      return next();
    } catch (error) {
      // On error, allow the request (fail open)
      console.warn("Rate limit check failed:", error);
      return next();
    }
  };
}

/**
 * Create rate limiter for ActivityPub inbox
 *
 * Uses sender server hostname as key.
 *
 * @param config - Rate limit configuration (without keyGenerator)
 * @returns Hono middleware function
 */
export function inboxRateLimit(config: Omit<RateLimitConfig, "keyGenerator">) {
  return rateLimit({
    ...config,
    keyGenerator: (c) => {
      const server = getActorServer(c);
      return server || getClientIP(c);
    },
  });
}
