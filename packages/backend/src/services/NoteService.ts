/**
 * Note Management Service
 *
 * Handles note creation, deletion, and timeline retrieval.
 * Integrates with INoteRepository for persistence and IDriveFileRepository for file validation.
 *
 * @module services/NoteService
 */

import type { INoteRepository } from "../interfaces/repositories/INoteRepository.js";
import type { IDriveFileRepository } from "../interfaces/repositories/IDriveFileRepository.js";
import type { IFollowRepository } from "../interfaces/repositories/IFollowRepository.js";
import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { IListRepository } from "../interfaces/repositories/IListRepository.js";
import type { ICacheService } from "../interfaces/ICacheService.js";
import type { Note } from "../../../shared/src/types/note.js";
import type { User } from "../../../shared/src/types/user.js";
import type { Visibility } from "../../../shared/src/types/common.js";
import { generateId } from "../../../shared/src/utils/id.js";
import type { ActivityPubDeliveryService } from "./ap/ActivityPubDeliveryService.js";
import { CacheTTL, CachePrefix } from "../adapters/cache/DragonflyCacheAdapter.js";
import type { NotificationService } from "./NotificationService.js";
import { getTimelineStreamService } from "./TimelineStreamService.js";
import { logger } from "../lib/logger.js";

/**
 * Note creation input data
 */
export interface NoteCreateInput {
  /** User ID creating the note */
  userId: string;
  /** Note text content (can be null if files are attached) */
  text?: string | null;
  /** Content Warning text */
  cw?: string | null;
  /** Visibility level */
  visibility?: Visibility;
  /** Local-only flag (disable federation) */
  localOnly?: boolean;
  /** Reply target note ID */
  replyId?: string | null;
  /** Renote target note ID */
  renoteId?: string | null;
  /** File IDs to attach */
  fileIds?: string[];
  /** Visible user IDs for DM (visibility: specified) */
  visibleUserIds?: string[];
}

/**
 * Timeline retrieval options
 */
export interface TimelineOptions {
  /** Maximum number of notes to retrieve (default: 20, max: 100) */
  limit?: number;
  /** Get notes newer than this ID */
  sinceId?: string;
  /** Get notes older than this ID */
  untilId?: string;
}

/**
 * Note Service
 *
 * Provides business logic for note operations including:
 * - Note creation with validation
 * - File attachment verification
 * - Note deletion with ownership verification
 * - Timeline retrieval (local, home, user)
 *
 * @remarks
 * - Text or files are required (cannot be both empty)
 * - File ownership is verified before attachment
 * - Maximum 4 files per note
 * - Default visibility: public
 * - Default limit: 20 notes (max: 100)
 */
export class NoteService {
  private readonly maxFilesPerNote = 4;
  private readonly defaultTimelineLimit = 20;
  private readonly maxTimelineLimit = 100;

  private readonly cacheService: ICacheService | null;

  /**
   * NoteService Constructor
   *
   * @param noteRepository - Note repository
   * @param driveFileRepository - Drive file repository
   * @param followRepository - Follow repository for timeline queries
   * @param userRepository - User repository
   * @param deliveryService - ActivityPub delivery service (injected via DI)
   * @param cacheService - Optional cache service for timeline caching
   * @param notificationService - Optional notification service for notifications
   * @param listRepository - Optional list repository for list notifications
   */
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly driveFileRepository: IDriveFileRepository,
    private readonly followRepository: IFollowRepository,
    private readonly userRepository: IUserRepository,
    private readonly deliveryService: ActivityPubDeliveryService,
    cacheService?: ICacheService,
    private readonly notificationService?: NotificationService,
    private readonly listRepository?: IListRepository,
  ) {
    this.cacheService = cacheService ?? null;
  }

  /**
   * Create a new note
   *
   * Validates input, verifies file ownership, and creates the note.
   *
   * @param input - Note creation parameters
   * @returns Created Note record
   * @throws Error if validation fails
   * @throws Error if file ownership verification fails
   *
   * @example
   * ```typescript
   * const note = await noteService.create({
   *   userId: user.id,
   *   text: 'Hello, world!',
   *   visibility: 'public',
   *   fileIds: ['file123'],
   * });
   * ```
   *
   * @remarks
   * - At least text or files must be provided
   * - Maximum 4 files per note
   * - Files must be owned by the user
   * - Renote can have no text (quote renote if text is provided)
   */
  async create(input: NoteCreateInput): Promise<Note> {
    const {
      userId,
      text = null,
      cw = null,
      visibility = "public",
      localOnly = false,
      replyId = null,
      renoteId = null,
      fileIds = [],
      visibleUserIds = [],
    } = input;

    // バリデーション: テキストまたはファイルが必須（Renoteの場合は除く）
    if (!renoteId && !text && fileIds.length === 0) {
      throw new Error("Note must have text or files");
    }

    // バリデーション: ファイル数制限
    if (fileIds.length > this.maxFilesPerNote) {
      throw new Error(`Maximum ${this.maxFilesPerNote} files allowed per note`);
    }

    // バリデーション: DM (visibility: specified) には受信者が必要
    if (visibility === "specified" && visibleUserIds.length === 0) {
      throw new Error("Direct message must have at least one recipient");
    }

    // ファイル所有権の確認
    if (fileIds.length > 0) {
      await this.verifyFileOwnership(fileIds, userId);
    }

    // リプライ先の存在確認
    if (replyId) {
      const replyNote = await this.noteRepository.findById(replyId);
      if (!replyNote) {
        throw new Error("Reply target note not found");
      }
    }

    // Renote先の存在確認
    let renoteTarget: Note | null = null;
    if (renoteId) {
      renoteTarget = await this.noteRepository.findById(renoteId);
      if (!renoteTarget) {
        throw new Error("Renote target note not found");
      }
    }

    // メンション抽出（簡易実装、Phase 1.1で拡張予定）
    // For DMs, use visibleUserIds as mentions (recipient user IDs)
    const extractedMentions = this.extractMentions(text || "");
    const mentions = visibility === "specified" ? visibleUserIds : extractedMentions;

    // Debug log for DM mentions
    if (visibility === "specified") {
      logger.info(
        { visibleUserIds, mentions, mentionsLength: mentions.length },
        "DM mentions array being saved",
      );
    }

    // ハッシュタグ抽出（簡易実装、Phase 1.1で拡張予定）
    const tags = this.extractHashtags(text || "");

    // 絵文字抽出（簡易実装、Phase 1.1で拡張予定）
    const emojis = this.extractEmojis(text || "");

    // ノート作成
    const noteId = generateId();
    const baseUrl = process.env.URL || "http://localhost:3000";

    const note = await this.noteRepository.create({
      id: noteId,
      userId,
      text,
      cw,
      visibility,
      localOnly,
      replyId,
      renoteId,
      fileIds,
      mentions,
      emojis,
      tags,
      uri: `${baseUrl}/notes/${noteId}`, // ActivityPub URI for local notes
      isDeleted: false,
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
      // repliesCount and renoteCount use database defaults (0)
    });

    // Increment reply count on parent note (async, non-blocking)
    if (replyId) {
      this.noteRepository.incrementRepliesCount(replyId).catch((error) => {
        logger.error({ err: error, replyId }, "Failed to increment replies count");
      });
    }

    // Increment renote count on target note (async, non-blocking)
    if (renoteId) {
      this.noteRepository.incrementRenoteCount(renoteId).catch((error) => {
        logger.error({ err: error, renoteId }, "Failed to increment renote count");
      });
    }

    // Determine if this is a pure renote (no text, no CW, no reply, no files)
    // Pure renotes get Announce activity, quote renotes get Create activity
    const isPureRenote = renoteTarget && !text && !cw && !replyId && fileIds.length === 0;

    // Deliver ActivityPub activity (async, non-blocking)
    const author = await this.userRepository.findById(userId);

    // Log DM delivery decision for debugging
    if (visibility === "specified") {
      logger.info(
        {
          noteId,
          visibility,
          visibleUserIds,
          visibleUserIdsLength: visibleUserIds.length,
          authorExists: !!author,
          authorHost: author?.host,
          localOnly,
        },
        "DM note created - checking delivery conditions",
      );
    }

    if (author && !author.host && !localOnly) {
      if (visibility === "specified" && visibleUserIds.length > 0) {
        // Direct message: deliver to specific recipients
        logger.info({ noteId, visibleUserIds }, "Starting DM delivery");
        this.deliveryService
          .deliverDirectMessage(note, author, visibleUserIds)
          .catch((error) => {
            logger.error({ err: error, noteId }, "Failed to deliver Direct Message activity");
          });
      } else if (visibility === "public") {
        if (isPureRenote && renoteTarget) {
          // Pure renote: send Announce activity to all followers
          this.deliveryService
            .deliverAnnounceActivity(note.id, renoteTarget, author)
            .catch((error) => {
              logger.error({ err: error, noteId }, "Failed to deliver Announce activity for renote");
            });
        } else {
          // Regular note or quote renote: send Create activity
          this.deliveryService.deliverCreateNote(note, author).catch((error) => {
            logger.error({ err: error, noteId }, "Failed to deliver Create activity");
          });
        }
      }
    }

    // Invalidate timeline cache on new local note
    if (this.cacheService?.isAvailable() && visibility === "public") {
      this.cacheService.deletePattern(`${CachePrefix.TIMELINE_LOCAL}:*`).catch((error) => {
        logger.debug({ err: error }, "Failed to invalidate timeline cache");
      });
    }

    // Create notifications (async, non-blocking)
    if (this.notificationService) {
      this.createNotifications(note, userId, mentions, replyId, renoteId, renoteTarget).catch(
        (error) => {
          logger.error({ err: error, noteId }, "Failed to create notifications");
        },
      );
    }

    // Create list notifications (async, non-blocking)
    // Notify list owners who have enabled notifications for lists containing this user
    const isPureRenoteForNotification = renoteId && !text;
    this.createListNotifications(note, userId, !!replyId, !!isPureRenoteForNotification).catch(
      (error) => {
        logger.error({ err: error, noteId }, "Failed to create list notifications");
      },
    );

    // Push to timeline streams (async, non-blocking)
    this.pushToTimelineStreams(note, userId, visibility, localOnly).catch((error) => {
      logger.error({ err: error, noteId }, "Failed to push note to timeline streams");
    });

    return note;
  }

  /**
   * Get a note by ID
   *
   * @param noteId - Note ID
   * @returns Note record or null if not found
   *
   * @example
   * ```typescript
   * const note = await noteService.findById('note123');
   * if (!note) {
   *   throw new Error('Note not found');
   * }
   * ```
   */
  async findById(noteId: string): Promise<Note | null> {
    const note = await this.noteRepository.findById(noteId);
    if (!note) return null;

    // Hydrate file information
    const [hydratedNote] = await this.hydrateFiles([note]);
    return hydratedNote ?? null;
  }


  /**
   * Hydrate renote information for a list of notes
   * Fetches the renoted notes and their users for notes that have renoteId
   */
  private async hydrateRenotes(notesList: Note[]): Promise<Note[]> {
    // Collect unique renote IDs and reply IDs
    const renoteIds = [...new Set(notesList.filter((n) => n.renoteId).map((n) => n.renoteId!))];
    const replyIds = [...new Set(notesList.filter((n) => n.replyId).map((n) => n.replyId!))];
    const allIds = [...new Set([...renoteIds, ...replyIds])];

    if (allIds.length === 0) {
      return notesList;
    }

    // Fetch all referenced notes in a single batch
    const referencedNotes = await Promise.all(allIds.map((id) => this.noteRepository.findById(id)));

    // Hydrate files for referenced notes
    const validNotes = referencedNotes.filter((n): n is Note => n !== null);
    const notesWithFiles = await this.hydrateFiles(validNotes);

    // Create a map for quick lookup
    const noteMap = new Map<string, Note>();
    for (const note of notesWithFiles) {
      // Fetch user info for the referenced note
      const user = await this.userRepository.findById(note.userId);
      if (user) {
        noteMap.set(note.id, {
          ...note,
          user: {
            id: user.id,
            username: user.username,
            name: user.displayName || user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            host: user.host,
            profileEmojis: user.profileEmojis,
          },
        } as Note);
      } else {
        noteMap.set(note.id, note);
      }
    }

    // Attach renote and reply data to notes
    return notesList.map((note) => {
      const result = { ...note } as Note & { renote?: Note; reply?: Note };

      if (note.renoteId && noteMap.has(note.renoteId)) {
        result.renote = noteMap.get(note.renoteId);
      }

      if (note.replyId && noteMap.has(note.replyId)) {
        result.reply = noteMap.get(note.replyId);
      }

      return result as Note;
    });
  }

  /**
   * Hydrate file metadata for notes
   *
   * Fetches file objects from drive_files table using fileIds.
   * Uses batch query to avoid N+1 problem.
   *
   * @param notesList - List of notes to hydrate
   * @returns Notes with files property populated
   *
   * @private
   */
  private async hydrateFiles(notesList: Note[]): Promise<Note[]> {
    const allFileIds = [...new Set(notesList.flatMap((n) => n.fileIds || []))];

    if (allFileIds.length === 0) {
      return notesList;
    }

    const files = await this.driveFileRepository.findByIds(allFileIds);
    const fileMap = new Map(files.map((f) => [f.id, f]));

    return notesList.map((note) => {
      if (!note.fileIds || note.fileIds.length === 0) {
        return note;
      }

      const noteFiles = note.fileIds
        .map((id) => fileMap.get(id))
        .filter((f) => f !== undefined)
        .map((f) => ({
          id: f.id,
          url: f.url,
          thumbnailUrl: f.thumbnailUrl,
          type: f.type,
          name: f.name,
          size: f.size,
          blurhash: f.blurhash,
          isSensitive: f.isSensitive,
          comment: f.comment,
        }));

      return { ...note, files: noteFiles } as Note;
    });
  }

  /**
   * Delete a note
   *
   * Verifies ownership before deletion.
   *
   * @param noteId - Note ID
   * @param userId - User ID (for ownership verification)
   * @throws Error if note not found or access denied
   *
   * @example
   * ```typescript
   * await noteService.delete('note123', 'user456');
   * ```
   */
  async delete(noteId: string, userId: string): Promise<void> {
    const note = await this.noteRepository.findById(noteId);

    if (!note) {
      throw new Error("Note not found");
    }

    // 所有者確認
    if (note.userId !== userId) {
      throw new Error("Access denied");
    }

    // Get author info before deletion for ActivityPub delivery
    const author = await this.userRepository.findById(userId);

    // Decrement reply count on parent note (async, non-blocking)
    if (note.replyId) {
      this.noteRepository.decrementRepliesCount(note.replyId).catch((error) => {
        logger.error({ err: error, replyId: note.replyId }, "Failed to decrement replies count");
      });
    }

    // Decrement renote count on target note (async, non-blocking)
    if (note.renoteId) {
      this.noteRepository.decrementRenoteCount(note.renoteId).catch((error) => {
        logger.error({ err: error, renoteId: note.renoteId }, "Failed to decrement renote count");
      });
    }

    // Delete the note from local database
    await this.noteRepository.delete(noteId);

    // Deliver Delete activity to remote followers (async, non-blocking)
    if (author && !author.host) {
      // Only deliver if author is a local user
      this.deliveryService.deliverDelete(note, author).catch((error) => {
        logger.error({ err: error, noteId }, "Failed to deliver Delete activity");
      });
    }
  }

  /**
   * Get local timeline
   *
   * Returns public posts from local users only.
   *
   * @param options - Pagination options
   * @returns List of Note records
   *
   * @example
   * ```typescript
   * const notes = await noteService.getLocalTimeline({
   *   limit: 20,
   *   sinceId: 'note123',
   * });
   * ```
   */
  async getLocalTimeline(options: TimelineOptions = {}): Promise<Note[]> {
    const limit = this.normalizeLimit(options.limit);

    // Cache only the first page (no cursor) for performance
    const isFirstPage = !options.sinceId && !options.untilId;
    const cacheKey = `${CachePrefix.TIMELINE_LOCAL}:${limit}`;

    // Try cache for first page
    if (isFirstPage && this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<Note[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const notes = await this.noteRepository.getLocalTimeline({
      limit,
      sinceId: options.sinceId,
      untilId: options.untilId,
    });

    // Hydrate renote and file information
    const hydratedNotes = await this.hydrateRenotes(notes);
    const notesWithFiles = await this.hydrateFiles(hydratedNotes);

    // Cache first page results
    if (isFirstPage && this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, notesWithFiles, { ttl: CacheTTL.SHORT });
    }

    return notesWithFiles;
  }

  /**
   * Get home timeline
   *
   * Returns posts from followed users.
   *
   * @param userId - User ID requesting the timeline
   * @param options - Pagination options
   * @returns List of Note records
   *
   * @example
   * ```typescript
   * const notes = await noteService.getHomeTimeline('user456', {
   *   limit: 20,
   * });
   * ```
   */
  async getHomeTimeline(userId: string, options: TimelineOptions = {}): Promise<Note[]> {
    const limit = this.normalizeLimit(options.limit);

    // フォロー中のユーザーIDを取得
    const followings = await this.followRepository.findByFollowerId(userId);
    const followingUserIds = followings.map((f: { followeeId: string }) => f.followeeId);

    // 自分の投稿も含める
    const userIds = [userId, ...followingUserIds];

    const notes = await this.noteRepository.getTimeline({
      userIds,
      limit,
      sinceId: options.sinceId,
      untilId: options.untilId,
    });

    // Hydrate renote and file information
    const hydratedNotes = await this.hydrateRenotes(notes);
    return await this.hydrateFiles(hydratedNotes);
  }

  /**
   * Get social timeline
   *
   * Returns local public posts + posts from followed remote users.
   *
   * @param userId - User ID requesting the timeline (optional for unauthenticated users)
   * @param options - Pagination options
   * @returns List of Note records
   *
   * @example
   * ```typescript
   * const notes = await noteService.getSocialTimeline('user456', {
   *   limit: 20,
   * });
   * ```
   */
  async getSocialTimeline(userId: string | null, options: TimelineOptions = {}): Promise<Note[]> {
    const limit = this.normalizeLimit(options.limit);

    let remoteUserIds: string[] = [];

    // ログインユーザーの場合、フォロー中のリモートユーザーIDを取得
    if (userId) {
      const followings = await this.followRepository.findByFollowerId(userId);
      // host が null でないユーザー（リモートユーザー）のみ
      remoteUserIds = followings
        .filter((f: any) => f.followee?.host != null)
        .map((f: { followeeId: string }) => f.followeeId);
    }

    const notes = await this.noteRepository.getSocialTimeline({
      userIds: remoteUserIds,
      limit,
      sinceId: options.sinceId,
      untilId: options.untilId,
    });

    // Hydrate renote and file information
    const hydratedNotes = await this.hydrateRenotes(notes);
    return await this.hydrateFiles(hydratedNotes);
  }

  /**
   * Get global timeline
   *
   * Returns all public posts from local and remote users.
   *
   * @param options - Pagination options
   * @returns List of Note records
   *
   * @example
   * ```typescript
   * const notes = await noteService.getGlobalTimeline({
   *   limit: 20,
   * });
   * ```
   */
  async getGlobalTimeline(options: TimelineOptions = {}): Promise<Note[]> {
    const limit = this.normalizeLimit(options.limit);

    // Cache only the first page (no cursor) for performance
    const isFirstPage = !options.sinceId && !options.untilId;
    const cacheKey = `${CachePrefix.TIMELINE_GLOBAL}:${limit}`;

    // Try cache for first page
    if (isFirstPage && this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<Note[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const notes = await this.noteRepository.getGlobalTimeline({
      limit,
      sinceId: options.sinceId,
      untilId: options.untilId,
    });

    // Hydrate renote and file information
    const hydratedNotes = await this.hydrateRenotes(notes);
    const notesWithFiles = await this.hydrateFiles(hydratedNotes);

    // Cache first page results
    if (isFirstPage && this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, notesWithFiles, { ttl: CacheTTL.SHORT });
    }

    return notesWithFiles;
  }

  /**
   * Get user timeline
   *
   * Returns posts from a specific user.
   *
   * @param userId - Target user ID
   * @param options - Pagination options
   * @returns List of Note records
   *
   * @example
   * ```typescript
   * const notes = await noteService.getUserTimeline('user456', {
   *   limit: 20,
   * });
   * ```
   */
  async getUserTimeline(userId: string, options: TimelineOptions = {}): Promise<Note[]> {
    const limit = this.normalizeLimit(options.limit);

    const notes = await this.noteRepository.findByUserId(userId, {
      limit,
      sinceId: options.sinceId,
      untilId: options.untilId,
    });

    // Hydrate renote and file information
    const hydratedNotes = await this.hydrateRenotes(notes);
    return await this.hydrateFiles(hydratedNotes);
  }


  /**
   * Get replies to a note
   *
   * Returns all replies to the specified note with hydrated user and renote data.
   *
   * @param noteId - Parent note ID
   * @param options - Timeline options (limit, sinceId, untilId)
   * @returns List of reply notes with hydrated data
   *
   * @example
   * ```ts
   * const replies = await noteService.getReplies(noteId, {
   *   limit: 20,
   * });
   * ```
   */
  async getReplies(noteId: string, options: TimelineOptions = {}): Promise<Note[]> {
    const limit = this.normalizeLimit(options.limit);

    const replies = await this.noteRepository.findReplies(noteId, {
      limit,
      sinceId: options.sinceId,
      untilId: options.untilId,
    });

    // Hydrate renote and file information
    const hydratedNotes = await this.hydrateRenotes(replies);
    return await this.hydrateFiles(hydratedNotes);
  }

  /**
   * Verify file ownership
   *
   * Ensures all files belong to the user.
   *
   * @param fileIds - File IDs to verify
   * @param userId - User ID
   * @throws Error if any file is not owned by the user
   *
   * @private
   */
  private async verifyFileOwnership(fileIds: string[], userId: string): Promise<void> {
    if (fileIds.length === 0) return;

    // Batch fetch all files in one query instead of N+1 pattern
    const files = await this.driveFileRepository.findByIds(fileIds);

    // Create a map for quick lookup
    const fileMap = new Map(files.map((f) => [f.id, f]));

    for (const fileId of fileIds) {
      const file = fileMap.get(fileId);

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      if (file.userId !== userId) {
        throw new Error(`File access denied: ${fileId}`);
      }
    }
  }

  /**
   * Extract mentions from text
   *
   * Finds @username patterns in text.
   *
   * @param text - Note text
   * @returns Array of mentioned usernames
   *
   * @private
   * @remarks Simple implementation, will be enhanced in Phase 1.1
   */
  private extractMentions(text: string): string[] {
    const mentionPattern = /@([a-zA-Z0-9_]+)/g;
    const matches = text.matchAll(mentionPattern);
    return Array.from(matches, (m) => m[1]).filter((m): m is string => m !== undefined);
  }

  /**
   * Extract hashtags from text
   *
   * Finds #tag patterns in text.
   *
   * @param text - Note text
   * @returns Array of hashtags (without #)
   *
   * @private
   * @remarks Simple implementation, will be enhanced in Phase 1.1
   */
  private extractHashtags(text: string): string[] {
    const hashtagPattern = /#([a-zA-Z0-9_]+)/g;
    const matches = text.matchAll(hashtagPattern);
    return Array.from(matches, (m) => m[1]).filter((m): m is string => m !== undefined);
  }

  /**
   * Extract custom emojis from text
   *
   * Finds :emoji: patterns in text.
   *
   * @param text - Note text
   * @returns Array of emoji names (without colons)
   *
   * @private
   * @remarks Simple implementation, will be enhanced in Phase 1.1
   */
  private extractEmojis(text: string): string[] {
    const emojiPattern = /:([a-zA-Z0-9_]+):/g;
    const matches = text.matchAll(emojiPattern);
    return Array.from(matches, (m) => m[1]).filter((m): m is string => m !== undefined);
  }

  /**
   * Normalize timeline limit
   *
   * Ensures limit is within valid range.
   *
   * @param limit - Requested limit
   * @returns Normalized limit
   *
   * @private
   */
  private normalizeLimit(limit?: number): number {
    if (!limit) {
      return this.defaultTimelineLimit;
    }

    if (limit < 1) {
      return this.defaultTimelineLimit;
    }

    if (limit > this.maxTimelineLimit) {
      return this.maxTimelineLimit;
    }

    return limit;
  }

  /**
   * Create notifications for a note
   *
   * Sends notifications for mentions, replies, renotes, and quotes.
   *
   * @param note - Created note
   * @param authorId - Note author ID
   * @param mentions - Mentioned usernames
   * @param replyId - Reply target note ID
   * @param renoteId - Renote target note ID
   * @param renoteTarget - Renote target note (if available)
   *
   * @private
   */
  private async createNotifications(
    note: Note,
    authorId: string,
    mentions: string[],
    replyId: string | null | undefined,
    renoteId: string | null | undefined,
    renoteTarget: Note | null,
  ): Promise<void> {
    if (!this.notificationService) return;

    // Fetch reply target once if needed (avoid N+1 in mentions loop)
    let replyTarget: Note | null = null;
    let replyTargetUser: User | null = null;
    if (replyId) {
      replyTarget = await this.noteRepository.findById(replyId);
      if (replyTarget && replyTarget.userId !== authorId) {
        replyTargetUser = await this.userRepository.findById(replyTarget.userId);
      }
    }

    // Reply notification
    if (replyTarget && replyTargetUser && !replyTargetUser.host) {
      await this.notificationService.createReplyNotification(
        replyTarget.userId,
        authorId,
        note.id,
      );
    }

    // Renote notification (pure renote without text)
    if (renoteId && renoteTarget && !note.text) {
      if (renoteTarget.userId !== authorId) {
        const targetUser = await this.userRepository.findById(renoteTarget.userId);
        if (targetUser && !targetUser.host) {
          await this.notificationService.createRenoteNotification(
            renoteTarget.userId,
            authorId,
            note.id,
          );
        }
      }
    }

    // Quote notification (renote with text)
    if (renoteId && renoteTarget && note.text) {
      if (renoteTarget.userId !== authorId) {
        const targetUser = await this.userRepository.findById(renoteTarget.userId);
        if (targetUser && !targetUser.host) {
          await this.notificationService.createQuoteNotification(
            renoteTarget.userId,
            authorId,
            note.id,
          );
        }
      }
    }

    // Mention notifications
    if (mentions.length > 0) {
      // Resolve usernames to user IDs
      for (const username of mentions) {
        const mentionedUser = await this.userRepository.findByUsername(username);
        if (mentionedUser && !mentionedUser.host && mentionedUser.id !== authorId) {
          // Skip if this is also a reply target (to avoid duplicate notification)
          // Using cached replyTarget instead of re-fetching
          if (replyTarget && replyTarget.userId === mentionedUser.id) {
            continue;
          }
          await this.notificationService.createMentionNotification(
            mentionedUser.id,
            authorId,
            note.id,
          );
        }
      }
    }
  }

  /**
   * Push note to timeline streams
   *
   * Sends real-time updates to connected clients via SSE.
   *
   * @param note - Created note
   * @param authorId - Note author ID
   * @param visibility - Note visibility
   * @param localOnly - Whether note is local-only
   *
   * @private
   */
  private async pushToTimelineStreams(
    note: Note,
    authorId: string,
    visibility: Visibility,
    _localOnly: boolean,
  ): Promise<void> {
    const streamService = getTimelineStreamService();

    // Get author info to check if local user
    const author = await this.userRepository.findById(authorId);
    if (!author) return;

    // Only push public notes from local users
    if (visibility !== "public" || author.host) return;

    // Hydrate file information for the main note
    const [noteWithFiles] = await this.hydrateFiles([note]);

    // Create note with user data for WebSocket push (frontend expects note.user)
    // Include both 'name' and 'displayName' for frontend compatibility
    const noteWithUser: Record<string, unknown> = {
      ...noteWithFiles,
      user: {
        id: author.id,
        username: author.username,
        name: author.displayName || author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        host: author.host,
        profileEmojis: author.profileEmojis,
      },
    };

    // Hydrate reply information if this is a reply
    if (note.replyId) {
      const replyNote = await this.noteRepository.findById(note.replyId);
      if (replyNote) {
        const [replyNoteWithFiles] = await this.hydrateFiles([replyNote]);
        const replyUser = await this.userRepository.findById(replyNote.userId);
        if (replyUser) {
          noteWithUser.reply = {
            ...replyNoteWithFiles,
            user: {
              id: replyUser.id,
              username: replyUser.username,
              name: replyUser.displayName || replyUser.username,
              displayName: replyUser.displayName,
              avatarUrl: replyUser.avatarUrl,
              host: replyUser.host,
              profileEmojis: replyUser.profileEmojis,
            },
          };
        }
      }
    }

    // Hydrate renote information if this is a renote/quote
    if (note.renoteId) {
      const renoteNote = await this.noteRepository.findById(note.renoteId);
      if (renoteNote) {
        const [renoteNoteWithFiles] = await this.hydrateFiles([renoteNote]);
        const renoteUser = await this.userRepository.findById(renoteNote.userId);
        if (renoteUser) {
          noteWithUser.renote = {
            ...renoteNoteWithFiles,
            user: {
              id: renoteUser.id,
              username: renoteUser.username,
              name: renoteUser.displayName || renoteUser.username,
              displayName: renoteUser.displayName,
              avatarUrl: renoteUser.avatarUrl,
              host: renoteUser.host,
              profileEmojis: renoteUser.profileEmojis,
            },
          };
        }
      }
    }

    // Push to local timeline (all local public notes)
    streamService.pushToLocalTimeline(noteWithUser);

    // Get followers to push to home/social timelines
    // findByFolloweeId returns follows where authorId is the followee (i.e., their followers)
    const followers = await this.followRepository.findByFolloweeId(authorId, 10000);
    const followerIds = followers.map((f) => f.followerId);

    // Push to home timeline of the author themselves and their followers
    // The author should see their own notes in their home timeline
    const homeTimelineUserIds = [authorId, ...followerIds];
    streamService.pushToHomeTimelines(homeTimelineUserIds, noteWithUser);

    // Push to social timelines (author + followers)
    // Social timeline = home timeline + local timeline for local users
    streamService.pushToSocialTimelines(homeTimelineUserIds, noteWithUser);
  }

  /**
   * Create list notifications for list owners
   *
   * When a user posts a note, notify list owners who have enabled notifications
   * for lists containing that user.
   *
   * @param note - Created note
   * @param authorId - Note author ID
   * @param isReply - Whether this note is a reply
   * @param isRenote - Whether this note is a renote (without text)
   *
   * @private
   */
  private async createListNotifications(
    note: Note,
    authorId: string,
    isReply: boolean,
    isRenote: boolean,
  ): Promise<void> {
    if (!this.notificationService || !this.listRepository) return;

    // Find all lists with notifications enabled that contain the author
    const lists = await this.listRepository.findListsWithNotificationsForMember(authorId);

    for (const list of lists) {
      // Skip if list owner is the author (don't notify yourself)
      if (list.userId === authorId) continue;

      // Check notify level
      if (list.notifyLevel === "original") {
        // Skip replies and renotes for "original" level
        if (isReply || isRenote) continue;
      }
      // "all" level notifies on everything

      // Check if list owner is a local user
      const listOwner = await this.userRepository.findById(list.userId);
      if (!listOwner || listOwner.host) continue;

      await this.notificationService.createListNoteNotification(
        list.userId,
        authorId,
        note.id,
        list.id,
      );
    }
  }
}
