/**
 * API Request Validation Schemas
 *
 * Centralized Zod schemas for validating API request bodies and query parameters.
 * Uses @hono/zod-validator for middleware integration.
 *
 * @module lib/validation
 */

import { z } from "zod";
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
  PASSWORD_MIN_LENGTH,
  NOTE_TEXT_MAX_LENGTH,
  NOTE_CW_MAX_LENGTH,
  NOTE_MAX_FILES,
  DISPLAY_NAME_MAX_LENGTH,
  BIO_MAX_LENGTH,
  REACTION_MAX_LENGTH,
  FILE_COMMENT_MAX_LENGTH,
  MAX_PAGE_LIMIT,
} from "shared";

// ============================================
// Common Schema Components
// ============================================

/**
 * Username validation rules:
 * - 3-20 characters
 * - Alphanumeric and underscores only
 */
export const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters`)
  .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`)
  .regex(USERNAME_PATTERN, "Username must contain only alphanumeric characters and underscores");

/**
 * Email validation with basic format check
 */
export const emailSchema = z.string().email("Invalid email address");

/**
 * Password validation rules:
 * - Minimum 8 characters
 */
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

/**
 * Note ID validation (nanoid format)
 */
export const noteIdSchema = z.string().min(1, "noteId is required");

/**
 * User ID validation (nanoid format)
 */
export const userIdSchema = z.string().min(1, "userId is required");

/**
 * File ID validation (nanoid format)
 */
export const fileIdSchema = z.string().min(1, "fileId is required");

/**
 * Pagination limit (1-100, default 20)
 */
export const limitSchema = z
  .string()
  .optional()
  .transform((val) => (val ? Number.parseInt(val, 10) : undefined))
  .pipe(z.number().int().min(1).max(MAX_PAGE_LIMIT).optional());

/**
 * Pagination cursor ID
 */
export const cursorIdSchema = z.string().optional();

/**
 * Note visibility enum
 */
export const visibilitySchema = z
  .enum(["public", "home", "followers", "specified"])
  .default("public");

// ============================================
// Auth Schemas
// ============================================

/**
 * POST /api/auth/register - User registration
 */
export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(DISPLAY_NAME_MAX_LENGTH, `Name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`).optional(),
});

/**
 * POST /api/auth/session - Login
 */
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// ============================================
// Note Schemas
// ============================================

/**
 * POST /api/notes/create - Create note
 */
export const createNoteSchema = z
  .object({
    text: z.string().max(NOTE_TEXT_MAX_LENGTH, `Note text must be at most ${NOTE_TEXT_MAX_LENGTH} characters`).nullable().optional(),
    cw: z.string().max(NOTE_CW_MAX_LENGTH, `Content warning must be at most ${NOTE_CW_MAX_LENGTH} characters`).nullable().optional(),
    visibility: visibilitySchema,
    localOnly: z.boolean().default(false),
    replyId: z.string().nullable().optional(),
    renoteId: z.string().nullable().optional(),
    fileIds: z.array(z.string()).max(NOTE_MAX_FILES, `Maximum ${NOTE_MAX_FILES} files allowed`).default([]),
  })
  .refine((data) => data.text || data.renoteId || (data.fileIds && data.fileIds.length > 0), {
    message: "Note must have text, a renote, or files",
  });

/**
 * POST /api/notes/show - Get note by ID
 */
export const showNoteSchema = z.object({
  noteId: noteIdSchema,
});

/**
 * POST /api/notes/delete - Delete note
 */
export const deleteNoteSchema = z.object({
  noteId: noteIdSchema,
});

/**
 * GET /api/notes/local-timeline - Query params
 */
export const timelineQuerySchema = z.object({
  limit: limitSchema,
  sinceId: cursorIdSchema,
  untilId: cursorIdSchema,
});

/**
 * GET /api/notes/user-notes - Query params
 */
export const userNotesQuerySchema = z.object({
  userId: userIdSchema,
  limit: limitSchema,
  sinceId: cursorIdSchema,
  untilId: cursorIdSchema,
});

/**
 * GET /api/notes/replies - Query params
 */
export const repliesQuerySchema = z.object({
  noteId: noteIdSchema,
  limit: limitSchema,
  sinceId: cursorIdSchema,
  untilId: cursorIdSchema,
});

// ============================================
// User Schemas
// ============================================

/**
 * POST /api/users - User registration (same as auth register)
 */
export const createUserSchema = registerSchema;

/**
 * GET /api/users/show - Query params
 */
export const showUserQuerySchema = z
  .object({
    userId: z.string().optional(),
    username: z.string().optional(),
  })
  .refine((data) => data.userId || data.username, { message: "userId or username is required" });

/**
 * GET /api/users/resolve - Query params
 */
export const resolveUserQuerySchema = z.object({
  acct: z.string().min(1, "acct parameter is required"),
});

/**
 * PATCH /api/users/@me - Update profile
 */
export const updateProfileSchema = z.object({
  name: z.string().max(DISPLAY_NAME_MAX_LENGTH, `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`).optional(),
  description: z.string().max(BIO_MAX_LENGTH, `Bio must be at most ${BIO_MAX_LENGTH} characters`).optional(),
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
  bannerUrl: z.string().url("Invalid banner URL").optional(),
  isBot: z.boolean().optional(),
});

// ============================================
// Reaction Schemas
// ============================================

/**
 * POST /api/notes/reactions/create - Create reaction
 */
export const createReactionSchema = z.object({
  noteId: noteIdSchema,
  reaction: z
    .string()
    .min(1, "Reaction is required")
    .max(REACTION_MAX_LENGTH, `Reaction must be at most ${REACTION_MAX_LENGTH} characters`),
});

/**
 * POST /api/notes/reactions/delete - Delete reaction
 */
export const deleteReactionSchema = z.object({
  noteId: noteIdSchema,
  reaction: z.string().min(1, "Reaction is required"),
});

/**
 * GET /api/notes/reactions - Query params
 */
export const reactionsQuerySchema = z.object({
  noteId: noteIdSchema,
  limit: limitSchema,
});

// ============================================
// Following Schemas
// ============================================

/**
 * POST /api/following/create - Follow user
 */
export const followSchema = z.object({
  userId: userIdSchema,
});

/**
 * POST /api/following/delete - Unfollow user
 */
export const unfollowSchema = z.object({
  userId: userIdSchema,
});

/**
 * GET /api/following/exists - Check follow status
 */
export const existsFollowQuerySchema = z.object({
  userId: userIdSchema,
});

/**
 * GET /api/following/users/followers - Get followers
 */
export const followersQuerySchema = z.object({
  userId: userIdSchema,
  limit: limitSchema,
});

/**
 * GET /api/following/users/following - Get following
 */
export const followingQuerySchema = z.object({
  userId: userIdSchema,
  limit: limitSchema,
});

// ============================================
// Drive Schemas
// ============================================

/**
 * GET /api/drive/files - Query params
 */
export const driveFilesQuerySchema = z.object({
  limit: limitSchema,
  sinceId: cursorIdSchema,
  untilId: cursorIdSchema,
});

/**
 * GET /api/drive/files/show - Query params
 */
export const showFileQuerySchema = z.object({
  fileId: fileIdSchema,
});

/**
 * POST /api/drive/files/update - Update file
 */
export const updateFileSchema = z.object({
  fileId: fileIdSchema,
  isSensitive: z.boolean().optional(),
  comment: z.string().max(FILE_COMMENT_MAX_LENGTH, `Comment must be at most ${FILE_COMMENT_MAX_LENGTH} characters`).nullable().optional(),
});

/**
 * POST /api/drive/files/delete - Delete file
 */
export const deleteFileSchema = z.object({
  fileId: fileIdSchema,
});

// ============================================
// Type Exports
// ============================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type ShowNoteInput = z.infer<typeof showNoteSchema>;
export type DeleteNoteInput = z.infer<typeof deleteNoteSchema>;
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
export type UserNotesQuery = z.infer<typeof userNotesQuerySchema>;
export type RepliesQuery = z.infer<typeof repliesQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ShowUserQuery = z.infer<typeof showUserQuerySchema>;
export type ResolveUserQuery = z.infer<typeof resolveUserQuerySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateReactionInput = z.infer<typeof createReactionSchema>;
export type DeleteReactionInput = z.infer<typeof deleteReactionSchema>;
export type ReactionsQuery = z.infer<typeof reactionsQuerySchema>;
export type FollowInput = z.infer<typeof followSchema>;
export type UnfollowInput = z.infer<typeof unfollowSchema>;
export type ExistsFollowQuery = z.infer<typeof existsFollowQuerySchema>;
export type FollowersQuery = z.infer<typeof followersQuerySchema>;
export type FollowingQuery = z.infer<typeof followingQuerySchema>;
export type DriveFilesQuery = z.infer<typeof driveFilesQuerySchema>;
export type ShowFileQuery = z.infer<typeof showFileQuerySchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
export type DeleteFileInput = z.infer<typeof deleteFileSchema>;
