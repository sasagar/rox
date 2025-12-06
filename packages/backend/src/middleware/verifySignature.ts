/**
 * HTTP Signature Verification Middleware
 *
 * Verifies ActivityPub HTTP Signatures on incoming requests.
 * Fetches and caches remote actor public keys using Redis (with in-memory fallback).
 *
 * @module middleware/verifySignature
 */

import type { Context, Next } from "hono";
import {
  parseSignatureHeader,
  reconstructSignatureString,
  verifySignature,
  verifyDigest,
  verifyDateHeader,
} from "../utils/httpSignature.js";
import type { ICacheService } from "../interfaces/ICacheService.js";
import { CacheTTL, CachePrefix } from "../adapters/cache/DragonflyCacheAdapter.js";
import { logger } from "../lib/logger.js";

/**
 * In-memory cache fallback for public keys when Redis is unavailable
 */
const publicKeyMemoryCache = new Map<string, { key: string; expires: number }>();

/**
 * Fetch remote actor's public key
 *
 * Retrieves the public key from the remote actor's document.
 * Results are cached in Redis (1 hour) with in-memory fallback.
 *
 * @param keyId - Public key identifier URL
 * @param cacheService - Optional cache service for Redis caching
 * @returns PEM-formatted public key
 * @throws Error if key cannot be fetched
 */
async function fetchPublicKey(keyId: string, cacheService?: ICacheService): Promise<string> {
  const cacheKey = `${CachePrefix.PUBLIC_KEY}:${keyId}`;

  // Check Redis cache first
  if (cacheService?.isAvailable()) {
    const cached = await cacheService.get<string>(cacheKey);
    if (cached) {
      return cached;
    }
  } else {
    // Fallback to in-memory cache
    const cached = publicKeyMemoryCache.get(keyId);
    if (cached && cached.expires > Date.now()) {
      return cached.key;
    }
  }

  // Fetch actor document
  // keyId format: https://example.com/users/alice#main-key
  // Actor URL: https://example.com/users/alice
  const actorUrl = keyId.split("#")[0];

  if (!actorUrl) {
    throw new Error("Invalid keyId format");
  }

  try {
    const response = await fetch(actorUrl, {
      headers: new Headers({
        Accept: "application/activity+json, application/ld+json",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch actor: ${response.statusText}`);
    }

    const actor = (await response.json()) as {
      publicKey?: {
        publicKeyPem?: string;
      };
    };

    // Extract public key
    let publicKey: string;
    if (actor.publicKey && actor.publicKey.publicKeyPem) {
      publicKey = actor.publicKey.publicKeyPem;
    } else {
      throw new Error("Public key not found in actor document");
    }

    // Cache in Redis (1 hour)
    if (cacheService?.isAvailable()) {
      await cacheService.set(cacheKey, publicKey, { ttl: CacheTTL.LONG });
    } else {
      // Fallback to in-memory cache
      publicKeyMemoryCache.set(keyId, {
        key: publicKey,
        expires: Date.now() + CacheTTL.LONG * 1000,
      });
    }

    return publicKey;
  } catch (error) {
    logger.error({ err: error, actorUrl }, "Failed to fetch public key");
    throw error;
  }
}

/**
 * HTTP Signature Verification Middleware
 *
 * Verifies the HTTP Signature on incoming ActivityPub requests.
 * Should be applied to Inbox and other federation endpoints.
 *
 * @param c - Hono context
 * @param next - Next middleware
 * @returns Response or calls next middleware
 *
 * @example
 * ```typescript
 * app.post('/users/:username/inbox', verifySignatureMiddleware, async (c) => {
 *   // Handle activity
 * });
 * ```
 */
export async function verifySignatureMiddleware(c: Context, next: Next): Promise<Response | void> {
  const signatureHeader = c.req.header("Signature");

  if (!signatureHeader) {
    logger.debug("Missing Signature header");
    return c.json({ error: "Missing signature" }, 401);
  }

  try {
    // Parse signature header
    const params = parseSignatureHeader(signatureHeader);

    // Get cache service from context (if available)
    const cacheService = c.get("cacheService") as ICacheService | undefined;

    // Fetch public key (with Redis caching)
    const publicKey = await fetchPublicKey(params.keyId, cacheService);

    // Get request details
    const method = c.req.method;
    const url = c.req.url;
    const headers: Record<string, string | undefined> = {};

    // Collect headers needed for verification
    for (const headerName of params.headers) {
      if (headerName !== "(request-target)") {
        headers[headerName.toLowerCase()] = c.req.header(headerName);
      }
    }

    // Reconstruct signature string
    const signatureString = reconstructSignatureString(method, url, headers, params.headers);

    // Verify signature
    const isValid = verifySignature(publicKey, signatureString, params.signature, params.algorithm);

    if (!isValid) {
      logger.warn({ keyId: params.keyId }, "Invalid signature");
      return c.json({ error: "Invalid signature" }, 401);
    }

    // Verify Date header (prevent replay attacks)
    const dateHeader = c.req.header("Date");
    if (dateHeader && !verifyDateHeader(dateHeader, 30)) {
      logger.warn({ date: dateHeader }, "Date header too old or invalid");
      return c.json({ error: "Request too old" }, 401);
    }

    // Verify Digest header (if present)
    const digestHeader = c.req.header("Digest");
    if (digestHeader) {
      const body = await c.req.text();
      if (!verifyDigest(body, digestHeader)) {
        logger.warn("Invalid digest");
        return c.json({ error: "Invalid digest" }, 401);
      }
      // Store body for later use (since we've already read it)
      c.set("requestBody", body);
    }

    // Store keyId for activity validation
    c.set("signatureKeyId", params.keyId);

    logger.debug({ keyId: params.keyId }, "Signature verified successfully");

    return await next();
  } catch (error) {
    logger.error({ err: error }, "Signature verification error");
    return c.json({ error: "Signature verification failed" }, 401);
  }
}

/**
 * Clear public key cache
 *
 * Utility function to clear the in-memory cache (e.g., for testing).
 * Note: Does not clear Redis cache - use cache service directly for that.
 */
export function clearPublicKeyCache(): void {
  publicKeyMemoryCache.clear();
}
