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
