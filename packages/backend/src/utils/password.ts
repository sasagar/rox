/**
 * Password hashing utilities
 *
 * Hashes passwords using the Argon2id algorithm via Bun's built-in Bun.password.
 * Argon2id is the winner of the Password Hashing Competition (PHC) and is
 * resistant to both side-channel attacks and GPU attacks.
 *
 * @module utils/password
 */

/**
 * Hash a password using Argon2id
 *
 * @param password - Plain text password to hash
 * @returns Hashed password string
 *
 * @example
 * ```typescript
 * const hash = await hashPassword('mySecretPassword123');
 * // => '$argon2id$v=19$m=19456,t=2,p=1$...'
 * ```
 *
 * @remarks
 * - Algorithm: argon2id
 * - Memory cost: 19456 KiB (approximately 19 MiB)
 * - Time cost: 2 iterations
 * - Parallelism: 1 (Bun default)
 */
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
  });
}

/**
 * Verify a password
 *
 * Compares a plain text password with a hashed password to verify if they match.
 * Safe against timing attacks.
 *
 * @param password - Plain text password to verify
 * @param hash - Hashed password stored in database
 * @returns true if password matches, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword('mySecretPassword123', storedHash);
 * if (isValid) {
 *   // Login successful
 * }
 * ```
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}
