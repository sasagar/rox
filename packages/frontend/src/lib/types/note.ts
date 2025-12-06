import type { NoteWithRelations, Visibility } from "shared";

/**
 * Note visibility types
 * Extended from shared types with 'direct' alias for 'specified'
 */
export type NoteVisibility = Visibility | "direct";

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
 * User information in note responses
 */
export interface NoteUser {
  id: string;
  username: string;
  name: string;
  avatarUrl?: string;
  host?: string;
  /** Custom emojis for display name (remote users) */
  profileEmojis?: ProfileEmoji[] | null;
}

/**
 * File attachment in note responses
 */
export interface NoteFile {
  id: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  type: string;
  size: number;
  blurhash?: string;
  isSensitive?: boolean;
  comment?: string;
}

/**
 * Note entity from API responses
 * Extends the shared NoteWithRelations type with additional frontend-specific fields
 */
export interface Note extends Omit<
  NoteWithRelations,
  "createdAt" | "updatedAt" | "user" | "files" | "text" | "cw"
> {
  user: NoteUser;
  text?: string;
  cw?: string;
  renote?: Note;
  files?: NoteFile[];
  createdAt: string;
  updatedAt: string;

  // Interaction counts
  repliesCount?: number;
  renoteCount?: number;
  reactions?: Record<string, number>;
  reactionEmojis?: Record<string, string>; // Custom emoji URLs: { ":emoji_name:": "https://..." }
}

/**
 * Parameters for creating a new note
 */
export interface CreateNoteParams {
  text?: string;
  cw?: string;
  visibility?: NoteVisibility;
  localOnly?: boolean;
  replyId?: string;
  renoteId?: string;
  fileIds?: string[];
}

/**
 * Timeline query options
 */
export interface TimelineOptions {
  limit?: number;
  untilId?: string;
  sinceId?: string;
  includeReplies?: boolean;
  includeMyRenotes?: boolean;
  withFiles?: boolean;
}
