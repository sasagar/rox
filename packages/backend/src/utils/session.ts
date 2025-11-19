/**
 * Session management utilities
 *
 * Provides session token generation, expiration calculation, and session validation.
 * Uses Web Crypto API's crypto.getRandomValues() for secure random value generation.
 *
 * @module utils/session
 */

/**
 * Generate a session token
 *
 * Generates a cryptographically secure 64-character hexadecimal string.
 * The token is unpredictable and resistant to session hijacking attacks.
 *
 * @returns A 64-character hexadecimal session token
 *
 * @example
 * ```typescript
 * const token = generateSessionToken();
 * // => 'a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2'
 * ```
 *
 * @remarks
 * - Generated from 32 bytes of random data
 * - Uses crypto.getRandomValues() (CSPRNG)
 * - Result is hex-encoded to 64 characters
 */
export function generateSessionToken(): string {
  // Generate secure random string (64 characters)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate session expiration time
 *
 * Calculates the expiration time from the current time plus the specified number of days.
 *
 * @param days - Number of days until session expiration
 * @returns Date object representing the expiration time
 *
 * @example
 * ```typescript
 * const expiry = calculateSessionExpiry(30); // 30 days from now
 * // => Date('2025-12-18T15:00:00.000Z')
 * ```
 */
export function calculateSessionExpiry(days: number): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Check if a session is valid
 *
 * Checks whether the specified expiration time is after the current time.
 *
 * @param expiresAt - Session expiration time
 * @returns true if the session is valid, false if expired
 *
 * @example
 * ```typescript
 * const expiresAt = new Date('2025-12-31');
 * const isValid = isSessionValid(expiresAt);
 * if (!isValid) {
 *   // Session expired - re-login required
 * }
 * ```
 */
export function isSessionValid(expiresAt: Date): boolean {
  return new Date() < expiresAt;
}
