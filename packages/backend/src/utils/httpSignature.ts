/**
 * HTTP Signature verification utilities for ActivityPub
 *
 * Implements signature verification according to draft-cavage-http-signatures.
 * Used for authenticating incoming ActivityPub requests.
 *
 * @module utils/httpSignature
 */

import { createVerify, createHash } from "node:crypto";

/**
 * Parsed HTTP Signature parameters
 */
export interface SignatureParams {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
}

/**
 * Parse Signature header
 *
 * Extracts signature parameters from the Signature HTTP header.
 *
 * @param signatureHeader - Value of the Signature header
 * @returns Parsed signature parameters
 * @throws Error if signature header is malformed
 *
 * @example
 * ```typescript
 * const params = parseSignatureHeader(
 *   'keyId="https://example.com/users/alice#main-key",algorithm="rsa-sha256",...'
 * );
 * // => { keyId: "https://...", algorithm: "rsa-sha256", ... }
 * ```
 */
export function parseSignatureHeader(signatureHeader: string): SignatureParams {
  const params: Record<string, string> = {};

  // Split by comma, but be careful with quoted values
  const parts = signatureHeader.match(/(\w+)="([^"]+)"/g);
  if (!parts) {
    throw new Error("Invalid signature header format");
  }

  for (const part of parts) {
    const match = part.match(/(\w+)="([^"]+)"/);
    if (match && match[1] && match[2]) {
      params[match[1]] = match[2];
    }
  }

  if (!params.keyId || !params.signature) {
    throw new Error("Missing required signature parameters");
  }

  return {
    keyId: params.keyId,
    algorithm: params.algorithm || "rsa-sha256",
    headers: params.headers ? params.headers.split(" ") : ["date"],
    signature: params.signature,
  };
}

/**
 * Reconstruct signature string from request
 *
 * Builds the signature string that should match what the sender signed.
 *
 * @param method - HTTP method
 * @param url - Request URL (path + query)
 * @param headers - Request headers
 * @param signedHeaders - List of headers that were signed
 * @returns Signature string
 */
export function reconstructSignatureString(
  method: string,
  url: string,
  headers: Record<string, string | undefined>,
  signedHeaders: string[],
): string {
  const parts: string[] = [];

  for (const headerName of signedHeaders) {
    if (headerName === "(request-target)") {
      const urlObj = new URL(url, "http://dummy");
      parts.push(`(request-target): ${method.toLowerCase()} ${urlObj.pathname}${urlObj.search}`);
    } else {
      const headerValue = headers[headerName.toLowerCase()];
      if (headerValue === undefined) {
        throw new Error(`Required header '${headerName}' not found in request`);
      }
      parts.push(`${headerName}: ${headerValue}`);
    }
  }

  return parts.join("\n");
}

/**
 * Verify HTTP signature
 *
 * Verifies that the request signature is valid using the provided public key.
 *
 * @param publicKey - PEM-formatted RSA public key
 * @param signatureString - Reconstructed signature string
 * @param signature - Base64-encoded signature
 * @param algorithm - Signature algorithm (default: "rsa-sha256")
 * @returns True if signature is valid, false otherwise
 */
export function verifySignature(
  publicKey: string,
  signatureString: string,
  signature: string,
  algorithm = "rsa-sha256",
): boolean {
  try {
    // Map algorithm to hash algorithm
    // - hs2019: New HTTP Signatures standard, typically uses RSA-SHA256
    // - rsa-sha256: Legacy format
    // - rsa-sha512: Legacy format with SHA-512
    let hashAlgorithm: string;
    const lowerAlgorithm = algorithm.toLowerCase();

    if (lowerAlgorithm === "hs2019") {
      // hs2019 is the modern HTTP Signature algorithm identifier
      // Most implementations use RSA-SHA256 with this identifier
      hashAlgorithm = "sha256";
    } else if (lowerAlgorithm.startsWith("rsa-")) {
      // Extract hash algorithm (rsa-sha256 => sha256)
      hashAlgorithm = lowerAlgorithm.replace("rsa-", "");
    } else {
      // Default to sha256 for unknown algorithms
      hashAlgorithm = "sha256";
    }

    const verifier = createVerify(hashAlgorithm);
    verifier.update(signatureString);
    return verifier.verify(publicKey, signature, "base64");
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

/**
 * Verify digest header
 *
 * Verifies that the Digest header matches the request body.
 * Used to ensure request body integrity.
 *
 * @param body - Request body
 * @param digestHeader - Value of the Digest header
 * @returns True if digest is valid, false otherwise
 */
export function verifyDigest(body: string, digestHeader: string): boolean {
  try {
    // Parse digest header (e.g., "SHA-256=base64string")
    const match = digestHeader.match(/^SHA-256=(.+)$/);
    if (!match) {
      return false;
    }

    const providedDigest = match[1];
    const calculatedDigest = createHash("sha256").update(body).digest("base64");

    return providedDigest === calculatedDigest;
  } catch (error) {
    console.error("Digest verification error:", error);
    return false;
  }
}

/**
 * Verify Date header freshness
 *
 * Checks that the Date header is recent (within acceptable time window).
 * Helps prevent replay attacks.
 *
 * @param dateHeader - Value of the Date header
 * @param maxAgeSeconds - Maximum age in seconds (default: 30)
 * @returns True if date is fresh, false otherwise
 */
export function verifyDateHeader(dateHeader: string, maxAgeSeconds = 30): boolean {
  try {
    const requestDate = new Date(dateHeader);
    const now = new Date();
    const ageSeconds = (now.getTime() - requestDate.getTime()) / 1000;

    // Allow some clock skew (check both past and future)
    return Math.abs(ageSeconds) <= maxAgeSeconds;
  } catch (error) {
    console.error("Date verification error:", error);
    return false;
  }
}
