/**
 * Validation Constants
 *
 * Shared validation rules and limits used by both frontend and backend.
 * These constants ensure consistency between client-side and server-side validation.
 *
 * @module constants/validation
 */

// ============================================
// Username Validation
// ============================================

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Default reserved usernames (hardcoded)
 * These usernames cannot be registered regardless of admin settings.
 * Includes system accounts, ActivityPub routes, and common technical names.
 */
export const DEFAULT_RESERVED_USERNAMES: readonly string[] = [
  // System accounts (reserved for Issue #44)
  "system",
  "admin",
  "administrator",
  "root",
  "moderator",
  "support",

  // Development/Technical
  "dev",
  "developer",
  "test",
  "debug",

  // Project-specific
  "rox",
  "love_rox",
  "lovrox",
  "hono_rox",
  "waku_rox",

  // ActivityPub routes
  "inbox",
  "outbox",
  "followers",
  "following",
  "featured",
  "collections",

  // Web routes / API paths
  "api",
  "auth",
  "login",
  "logout",
  "register",
  "signup",
  "signin",
  "settings",
  "notifications",
  "timeline",
  "explore",
  "search",
  "about",
  "help",
  "terms",
  "privacy",
  "instance",

  // Technical names
  "null",
  "undefined",
  "anonymous",
  "guest",
  "bot",
  "official",

  // Well-known paths (underscores for valid username format)
  "well_known",
  "webfinger",
  "nodeinfo",
  "host_meta",
] as const;

/**
 * Check if a username is in the default reserved list
 * Case-insensitive comparison
 *
 * @param username - Username to check
 * @returns true if the username is reserved
 */
export function isDefaultReservedUsername(username: string): boolean {
  const lowerUsername = username.toLowerCase();
  return DEFAULT_RESERVED_USERNAMES.some((reserved) => reserved === lowerUsername);
}

// ============================================
// Password Validation
// ============================================

export const PASSWORD_MIN_LENGTH = 8;

// ============================================
// Note Validation
// ============================================

export const NOTE_TEXT_MAX_LENGTH = 3000;
export const NOTE_CW_MAX_LENGTH = 100;
export const NOTE_MAX_FILES = 4;

// ============================================
// User Profile Validation
// ============================================

export const DISPLAY_NAME_MAX_LENGTH = 100;
export const BIO_MAX_LENGTH = 500;

// ============================================
// Reaction Validation
// ============================================

export const REACTION_MAX_LENGTH = 50;

// ============================================
// File Validation
// ============================================

export const FILE_COMMENT_MAX_LENGTH = 512;

// ============================================
// Pagination Defaults
// ============================================

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
