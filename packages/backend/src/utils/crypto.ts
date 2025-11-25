/**
 * Cryptographic utilities for ActivityPub federation
 *
 * Provides RSA key pair generation and HTTP Signatures for ActivityPub
 *
 * @module utils/crypto
 */

import { generateKeyPairSync, createSign, createHash } from 'node:crypto';

/**
 * Generate RSA key pair for ActivityPub HTTP Signatures
 *
 * @returns Object containing PEM-formatted public and private keys
 */
export function generateKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

/**
 * Sign HTTP request for ActivityPub federation
 *
 * Creates an HTTP Signature according to the draft-cavage-http-signatures specification.
 * Used for authenticating outgoing ActivityPub requests.
 *
 * @param privateKey - PEM-formatted RSA private key
 * @param keyId - Public key identifier URL (e.g., "https://example.com/users/alice#main-key")
 * @param method - HTTP method (e.g., "POST", "GET")
 * @param url - Full URL of the request
 * @param body - Request body (null for GET requests)
 * @returns Signature header value
 *
 * @example
 * ```typescript
 * const signature = signRequest(
 *   user.privateKey,
 *   `${process.env.URL}/users/${user.username}#main-key`,
 *   'POST',
 *   'https://remote.example.com/inbox',
 *   JSON.stringify(activity)
 * );
 * // Use in headers: { 'Signature': signature }
 * ```
 */
export function signRequest(
  privateKey: string,
  keyId: string,
  method: string,
  url: string,
  body: string | null
): string {
  const urlObj = new URL(url);
  const date = new Date().toUTCString();

  // Calculate digest for POST/PUT requests with body
  const digest = body
    ? `SHA-256=${createHash('sha256').update(body).digest('base64')}`
    : undefined;

  // Build signature string according to spec
  const signatureParts: string[] = [
    `(request-target): ${method.toLowerCase()} ${urlObj.pathname}${urlObj.search}`,
    `host: ${urlObj.hostname}`,
    `date: ${date}`,
  ];

  if (digest) {
    signatureParts.push(`digest: ${digest}`);
  }

  const signatureString = signatureParts.join('\n');

  // Sign with RSA-SHA256
  const signer = createSign('sha256');
  signer.update(signatureString);
  const signature = signer.sign(privateKey, 'base64');

  // Build Signature header
  const headers = ['(request-target)', 'host', 'date'];
  if (digest) {
    headers.push('digest');
  }

  const signatureHeader = [
    `keyId="${keyId}"`,
    'algorithm="rsa-sha256"',
    `headers="${headers.join(' ')}"`,
    `signature="${signature}"`,
  ].join(',');

  return signatureHeader;
}

/**
 * Get headers to include with signed request
 *
 * Returns the headers that should be included in the actual HTTP request.
 * These must match the headers specified in the signature.
 *
 * @param url - Full URL of the request
 * @param body - Request body (null for GET requests)
 * @returns Headers object
 */
export function getSignedHeaders(
  url: string,
  body: string | null
): Record<string, string> {
  const urlObj = new URL(url);
  const headers: Record<string, string> = {
    host: urlObj.hostname,
    date: new Date().toUTCString(),
  };

  if (body) {
    headers.digest = `SHA-256=${createHash('sha256').update(body).digest('base64')}`;
  }

  return headers;
}
