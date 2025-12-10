/**
 * SQLite Note Repository
 *
 * SQLite/D1 implementation of the INoteRepository interface.
 *
 * @module repositories/sqlite/SqliteNoteRepository
 */

import { eq, and, desc, lt, gt, inArray, isNull, sql, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { notes, users } from "../../db/schema/sqlite.js";
import type * as sqliteSchema from "../../db/schema/sqlite.js";
import type {
  INoteRepository,
  NoteCreateInput,
  TimelineOptions,
} from "../../interfaces/repositories/INoteRepository.js";
import type { Note } from "shared";

type SqliteDatabase = BetterSQLite3Database<typeof sqliteSchema>;

/**
 * SQLite implementation of note repository
 */
export class SqliteNoteRepository implements INoteRepository {
  constructor(private db: SqliteDatabase) {}

  /**
   * Maps a joined note+user result to a Note object with embedded user
   */
  private mapNoteWithUser(result: {
    notes: typeof notes.$inferSelect;
    users: typeof users.$inferSelect;
  }): Note {
    return {
      ...result.notes,
      user: {
        id: result.users.id,
        username: result.users.username,
        name: result.users.displayName || result.users.username,
        displayName: result.users.displayName,
        avatarUrl: result.users.avatarUrl,
        host: result.users.host,
        profileEmojis: result.users.profileEmojis,
      },
    } as Note;
  }

  async create(note: NoteCreateInput): Promise<Note> {
    const now = new Date();
    this.db.insert(notes).values({
      ...note,
      createdAt: now,
      updatedAt: now,
    }).run();

    // SQLite doesn't support RETURNING, fetch the inserted record
    const [result] = this.db.select().from(notes).where(eq(notes.id, note.id)).limit(1).all();

    if (!result) {
      throw new Error("Failed to create note");
    }

    return result as Note;
  }

  async findById(id: string): Promise<Note | null> {
    const [result] = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.id, id))
      .limit(1)
      .all();

    return result ? this.mapNoteWithUser(result) : null;
  }

  async findByUri(uri: string): Promise<Note | null> {
    const [result] = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.uri, uri))
      .limit(1)
      .all();

    return result ? this.mapNoteWithUser(result) : null;
  }

  async getLocalTimeline(options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      isNull(users.host),
      eq(notes.visibility, "public"),
      eq(notes.localOnly, false),
      eq(notes.isDeleted, false),
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .all();

    return results.map((r) => this.mapNoteWithUser(r));
  }

  async getTimeline(options: TimelineOptions & { userIds: string[] }): Promise<Note[]> {
    const { limit = 20, sinceId, untilId, userIds } = options;

    if (userIds.length === 0) {
      return [];
    }

    const conditions = [inArray(notes.userId, userIds), eq(notes.isDeleted, false)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .all();

    return results.map((r) => this.mapNoteWithUser(r));
  }

  async getSocialTimeline(options: TimelineOptions & { userIds?: string[] }): Promise<Note[]> {
    const { limit = 20, sinceId, untilId, userIds = [] } = options;

    const conditions = [eq(notes.isDeleted, false)];

    const localConditions = [isNull(users.host), eq(notes.visibility, "public"), eq(notes.localOnly, false)];

    if (userIds.length > 0) {
      conditions.push(or(and(...localConditions), inArray(notes.userId, userIds))!);
    } else {
      conditions.push(...localConditions);
    }

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .all();

    return results.map((r) => this.mapNoteWithUser(r));
  }

  async getGlobalTimeline(options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [eq(notes.visibility, "public"), eq(notes.localOnly, false), eq(notes.isDeleted, false)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .all();

    return results.map((r) => this.mapNoteWithUser(r));
  }

  async findByUserId(userId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [eq(notes.userId, userId), eq(notes.isDeleted, false)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .all();

    return results.map((r) => this.mapNoteWithUser(r));
  }

  async findReplies(noteId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [eq(notes.replyId, noteId), eq(notes.isDeleted, false)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .all();

    return results.map((r) => this.mapNoteWithUser(r));
  }

  async findRenotes(noteId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [eq(notes.renoteId, noteId), eq(notes.isDeleted, false)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit)
      .all();

    return results.map((r) => this.mapNoteWithUser(r));
  }

  async update(id: string, data: Partial<Omit<Note, "id" | "createdAt">>): Promise<Note> {
    this.db
      .update(notes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .run();

    // Fetch the updated record
    const [result] = this.db.select().from(notes).where(eq(notes.id, id)).limit(1).all();

    if (!result) {
      throw new Error("Note not found");
    }

    return result as Note;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(notes).where(eq(notes.id, id)).run();
  }

  async count(localOnly = false): Promise<number> {
    if (localOnly) {
      const [result] = this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notes)
        .innerJoin(users, eq(notes.userId, users.id))
        .where(and(isNull(users.host), eq(notes.isDeleted, false)))
        .all();

      return result?.count ?? 0;
    }

    const [result] = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notes)
      .where(eq(notes.isDeleted, false))
      .all();

    return result?.count ?? 0;
  }

  async countByUserId(userId: string): Promise<number> {
    const [result] = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.isDeleted, false)))
      .all();

    return result?.count ?? 0;
  }

  async incrementRepliesCount(noteId: string): Promise<void> {
    this.db
      .update(notes)
      .set({ repliesCount: sql`${notes.repliesCount} + 1` })
      .where(eq(notes.id, noteId))
      .run();
  }

  async decrementRepliesCount(noteId: string): Promise<void> {
    this.db
      .update(notes)
      .set({ repliesCount: sql`MAX(${notes.repliesCount} - 1, 0)` })
      .where(eq(notes.id, noteId))
      .run();
  }

  async incrementRenoteCount(noteId: string): Promise<void> {
    this.db
      .update(notes)
      .set({ renoteCount: sql`${notes.renoteCount} + 1` })
      .where(eq(notes.id, noteId))
      .run();
  }

  async decrementRenoteCount(noteId: string): Promise<void> {
    this.db
      .update(notes)
      .set({ renoteCount: sql`MAX(${notes.renoteCount} - 1, 0)` })
      .where(eq(notes.id, noteId))
      .run();
  }

  async softDelete(id: string, deletedById: string, reason?: string): Promise<Note | null> {
    this.db
      .update(notes)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
        deletionReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .run();

    // Fetch the updated record
    const [result] = this.db.select().from(notes).where(eq(notes.id, id)).limit(1).all();

    return (result as Note) ?? null;
  }

  async restore(id: string): Promise<Note | null> {
    this.db
      .update(notes)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .run();

    // Fetch the updated record
    const [result] = this.db.select().from(notes).where(eq(notes.id, id)).limit(1).all();

    return (result as Note) ?? null;
  }

  async findDeletedNotes(options?: {
    limit?: number;
    offset?: number;
    deletedById?: string;
  }): Promise<Note[]> {
    const { limit = 100, offset = 0, deletedById } = options ?? {};

    const conditions = [eq(notes.isDeleted, true)];

    if (deletedById) {
      conditions.push(eq(notes.deletedById, deletedById));
    }

    const results = this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.deletedAt))
      .limit(limit)
      .offset(offset)
      .all();

    return results.map((r) => this.mapNoteWithUser(r));
  }

  async findMentionsAndReplies(_userId: string, _options: TimelineOptions): Promise<Note[]> {
    // TODO: Implement SQLite-specific query for mentions and replies
    throw new Error("Not implemented for SQLite");
  }

  async findDirectMessages(_userId: string, _options: TimelineOptions): Promise<Note[]> {
    // TODO: Implement SQLite-specific query for direct messages
    throw new Error("Not implemented for SQLite");
  }

  async findDirectMessageThread(
    _userId: string,
    _partnerId: string,
    _options: TimelineOptions,
  ): Promise<Note[]> {
    // TODO: Implement SQLite-specific query for DM thread
    throw new Error("Not implemented for SQLite");
  }

  async getConversationPartners(
    _userId: string,
    _limit: number,
  ): Promise<
    Array<{
      partnerId: string;
      partnerUsername: string;
      partnerDisplayName: string | null;
      partnerAvatarUrl: string | null;
      partnerHost: string | null;
      partnerProfileEmojis: Array<{ name: string; url: string }> | null;
      lastNoteId: string;
      lastNoteText: string | null;
      lastNoteCreatedAt: Date;
    }>
  > {
    // TODO: Implement SQLite-specific query for conversation partners
    throw new Error("Not implemented for SQLite");
  }
}
