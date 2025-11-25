/**
 * HTTP Signature Verification Middleware
 *
 * Verifies ActivityPub HTTP Signatures on incoming requests.
 * Fetches and caches remote actor public keys.
 *
 * @module middleware/verifySignature
 */

import type { Context, Next } from 'hono';
import {
  parseSignatureHeader,
  reconstructSignatureString,
  verifySignature,
  verifyDigest,
  verifyDateHeader,
} from '../utils/httpSignature.js';

/**
 * Simple in-memory cache for public keys
 * TODO: Replace with Redis/database for production
 */
const publicKeyCache = new Map<string, { key: string; expires: number }>();

/**
 * Fetch remote actor's public key
 *
 * Retrieves the public key from the remote actor's document.
 * Results are cached for 1 hour to reduce network requests.
 *
 * @param keyId - Public key identifier URL
 * @returns PEM-formatted public key
 * @throws Error if key cannot be fetched
 */
async function fetchPublicKey(keyId: string): Promise<string> {
  // Check cache
  const cached = publicKeyCache.get(keyId);
  if (cached && cached.expires > Date.now()) {
    return cached.key;
  }

  // Fetch actor document
  // keyId format: https://example.com/users/alice#main-key
  // Actor URL: https://example.com/users/alice
  const actorUrl = keyId.split('#')[0];

  if (!actorUrl) {
    throw new Error('Invalid keyId format');
  }

  try {
    const response = await fetch(actorUrl, {
      headers: new Headers({
        'Accept': 'application/activity+json, application/ld+json',
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
      throw new Error('Public key not found in actor document');
    }

    // Cache for 1 hour
    publicKeyCache.set(keyId, {
      key: publicKey,
      expires: Date.now() + 3600 * 1000,
    });

    return publicKey;
  } catch (error) {
    console.error(`Failed to fetch public key from ${actorUrl}:`, error);
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
  const signatureHeader = c.req.header('Signature');

  if (!signatureHeader) {
    console.warn('Missing Signature header');
    return c.json({ error: 'Missing signature' }, 401);
  }

  try {
    // Parse signature header
    const params = parseSignatureHeader(signatureHeader);

    // Fetch public key
    const publicKey = await fetchPublicKey(params.keyId);

    // Get request details
    const method = c.req.method;
    const url = c.req.url;
    const headers: Record<string, string | undefined> = {};

    // Collect headers needed for verification
    for (const headerName of params.headers) {
      if (headerName !== '(request-target)') {
        headers[headerName.toLowerCase()] = c.req.header(headerName);
      }
    }

    // Reconstruct signature string
    const signatureString = reconstructSignatureString(
      method,
      url,
      headers,
      params.headers
    );

    // Verify signature
    const isValid = verifySignature(
      publicKey,
      signatureString,
      params.signature,
      params.algorithm
    );

    if (!isValid) {
      console.warn('Invalid signature', { keyId: params.keyId });
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Verify Date header (prevent replay attacks)
    const dateHeader = c.req.header('Date');
    if (dateHeader && !verifyDateHeader(dateHeader, 30)) {
      console.warn('Date header too old or invalid', { date: dateHeader });
      return c.json({ error: 'Request too old' }, 401);
    }

    // Verify Digest header (if present)
    const digestHeader = c.req.header('Digest');
    if (digestHeader) {
      const body = await c.req.text();
      if (!verifyDigest(body, digestHeader)) {
        console.warn('Invalid digest');
        return c.json({ error: 'Invalid digest' }, 401);
      }
      // Store body for later use (since we've already read it)
      c.set('requestBody', body);
    }

    console.log('Signature verified successfully', { keyId: params.keyId });

    return await next();
  } catch (error) {
    console.error('Signature verification error:', error);
    return c.json({ error: 'Signature verification failed' }, 401);
  }
}

/**
 * Clear public key cache
 *
 * Utility function to clear the cache (e.g., for testing).
 */
export function clearPublicKeyCache(): void {
  publicKeyCache.clear();
}
