/**
 * Shared Route Utilities
 *
 * Common utility functions for route handlers to reduce code duplication
 * across admin.ts, moderator.ts, and other route files.
 *
 * @module lib/routeUtils
 */

import type { Context } from "hono";

/**
 * User data with sensitive fields that should be removed before API responses
 */
interface UserWithSensitiveData {
  passwordHash?: string | null;
  privateKey?: string | null;
  [key: string]: unknown;
}

/**
 * Sanitized user data safe for API responses
 */
type SanitizedUser<T extends UserWithSensitiveData> = Omit<T, "passwordHash" | "privateKey">;

/**
 * Removes sensitive fields (passwordHash, privateKey) from user objects
 * before sending in API responses.
 *
 * @param user - User object potentially containing sensitive data
 * @returns User object with sensitive fields removed
 *
 * @example
 * ```typescript
 * const user = await userRepo.findById(id);
 * return c.json(sanitizeUser(user));
 * ```
 */
export function sanitizeUser<T extends UserWithSensitiveData>(user: T): SanitizedUser<T> {
  const { passwordHash: _p, privateKey: _pk, ...userData } = user;
  return userData as SanitizedUser<T>;
}

/**
 * Pagination parameters extracted from query string
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Options for pagination parsing
 */
export interface PaginationOptions {
  /** Default limit if not specified (default: 100) */
  defaultLimit?: number;
  /** Maximum allowed limit (default: 1000) */
  maxLimit?: number;
  /** Default offset if not specified (default: 0) */
  defaultOffset?: number;
}

/**
 * Parses pagination parameters from query string with sensible defaults.
 *
 * @param c - Hono context
 * @param options - Optional configuration for default/max values
 * @returns Parsed pagination parameters
 *
 * @example
 * ```typescript
 * const { limit, offset } = parsePagination(c);
 * const items = await repo.findMany({ limit, offset });
 * ```
 */
export function parsePagination(c: Context, options: PaginationOptions = {}): PaginationParams {
  const { defaultLimit = 100, maxLimit = 1000, defaultOffset = 0 } = options;

  const limit = Math.min(
    Number.parseInt(c.req.query("limit") || String(defaultLimit), 10),
    maxLimit
  );
  const offset = Number.parseInt(c.req.query("offset") || String(defaultOffset), 10);

  return { limit, offset };
}

/**
 * Normalizes a hostname by removing protocol prefix and path suffix.
 * Used for instance block management.
 *
 * @param host - Raw hostname that may include protocol or path
 * @returns Normalized hostname (lowercase, no protocol, no path)
 *
 * @example
 * ```typescript
 * normalizeHostname("https://example.com/path"); // "example.com"
 * normalizeHostname("EXAMPLE.COM");              // "example.com"
 * normalizeHostname("http://sub.example.com/");  // "sub.example.com"
 * ```
 */
export function normalizeHostname(host: string): string {
  return host
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
}

/**
 * Creates a standardized error response.
 *
 * @param c - Hono context
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @returns JSON response with error
 *
 * @example
 * ```typescript
 * if (!user) {
 *   return errorResponse(c, "User not found", 404);
 * }
 * ```
 */
export function errorResponse(
  c: Context,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 = 400
) {
  return c.json({ error: message } satisfies ErrorResponse, status);
}

/**
 * Parses and validates a status filter from query string.
 * Used for filtering reports, warnings, etc.
 *
 * @param c - Hono context
 * @param validStatuses - Array of valid status values
 * @param defaultStatus - Default status if not specified (optional)
 * @returns Parsed status or undefined
 *
 * @example
 * ```typescript
 * const status = parseStatusFilter(c, ["open", "resolved"], "open");
 * ```
 */
export function parseStatusFilter<T extends string>(
  c: Context,
  validStatuses: readonly T[],
  defaultStatus?: T
): T | undefined {
  const status = c.req.query("status") as T | undefined;
  if (status && validStatuses.includes(status)) {
    return status;
  }
  return defaultStatus;
}
