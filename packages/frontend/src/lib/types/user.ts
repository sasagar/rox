import type { UserProfile } from "shared";

/**
 * Profile emoji (custom emoji used in user profile)
 */
export interface ProfileEmoji {
  /** Emoji shortcode (without colons) */
  name: string;
  /** URL to the emoji image */
  url: string;
}

/**
 * User entity from API responses
 * Extends the shared UserProfile type with additional frontend-specific fields
 */
export interface User extends Omit<UserProfile, "createdAt" | "displayName" | "host"> {
  name: string; // Alias for displayName
  displayName?: string; // Keep for backward compatibility
  email?: string;
  createdAt: string;
  updatedAt: string;
  host?: string | null;

  // Optional fields
  isBot?: boolean;
  isCat?: boolean;
  isLocked?: boolean;

  // Follow counts
  followersCount?: number;
  followingCount?: number;
  notesCount?: number;

  // User interaction state
  isFollowing?: boolean;
  isFollowed?: boolean;
  isBlocking?: boolean;
  isBlocked?: boolean;
  isMuted?: boolean;

  // Admin status
  isAdmin?: boolean;
  isSuspended?: boolean;

  // User customization
  customCss?: string;

  // Profile emojis (custom emojis used in name/bio for remote users)
  profileEmojis?: ProfileEmoji[];
}

/**
 * Authentication result
 */
export interface AuthResult {
  token: string;
  user: User;
}

/**
 * Session validation response
 */
export interface SessionResponse {
  user: User;
  expiresAt: string;
}
