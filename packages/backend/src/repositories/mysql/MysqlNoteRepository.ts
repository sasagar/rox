/**
 * MySQL Note Repository
 *
 * MySQL implementation of the INoteRepository interface.
 *
 * @module repositories/mysql/MysqlNoteRepository
 */

import { eq, and, or, isNull, inArray, desc, gt, lt, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { notes, users } from "../../db/schema/mysql.js";
import type * as mysqlSchema from "../../db/schema/mysql.js";
import type {
  INoteRepository,
  NoteCreateInput,
  TimelineOptions,
} from "../../interfaces/repositories/INoteRepository.js";
import type { Note } from "shared";

type MysqlDatabase = MySql2Database<typeof mysqlSchema>;

export class MysqlNoteRepository implements INoteRepository {
  constructor(private db: MysqlDatabase) {}

  async create(note: NoteCreateInput): Promise<Note> {
    const now = new Date();
    await this.db.insert(notes).values({
      ...note,
      createdAt: now,
      updatedAt: now,
    });

    // MySQL doesn't support RETURNING, fetch the inserted record
    const [result] = await this.db.select().from(notes).where(eq(notes.id, note.id)).limit(1);

    if (!result) {
      throw new Error("Failed to create note");
    }

    return result as Note;
  }

  async findById(id: string): Promise<Note | null> {
    const [result] = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.id, id))
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      ...result.notes,
      user: {
        id: result.users.id,
        username: result.users.username,
        name: result.users.displayName || result.users.username,
        displayName: result.users.displayName,
        avatarUrl: result.users.avatarUrl,
        host: result.users.host,
      },
    } as Note;
  }

  async findByUri(uri: string): Promise<Note | null> {
    const [result] = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.uri, uri))
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      ...result.notes,
      user: {
        id: result.users.id,
        username: result.users.username,
        name: result.users.displayName || result.users.username,
        displayName: result.users.displayName,
        avatarUrl: result.users.avatarUrl,
        host: result.users.host,
      },
    } as Note;
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

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
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

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
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

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
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

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
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

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
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

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
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

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async update(id: string, data: Partial<Omit<Note, "id" | "createdAt">>): Promise<Note> {
    await this.db
      .update(notes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id));

    // MySQL doesn't support RETURNING, fetch the updated record
    const [result] = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);

    if (!result) {
      throw new Error("Note not found");
    }

    return result as Note;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(notes).where(eq(notes.id, id));
  }

  async count(localOnly = false): Promise<number> {
    if (localOnly) {
      const [result] = await this.db
        .select({ count: sql<number>`CAST(COUNT(*) AS SIGNED)` })
        .from(notes)
        .innerJoin(users, eq(notes.userId, users.id))
        .where(and(isNull(users.host), eq(notes.isDeleted, false)));

      return result?.count ?? 0;
    }

    const [result] = await this.db
      .select({ count: sql<number>`CAST(COUNT(*) AS SIGNED)` })
      .from(notes)
      .where(eq(notes.isDeleted, false));

    return result?.count ?? 0;
  }

  async countByUserId(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`CAST(COUNT(*) AS SIGNED)` })
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.isDeleted, false)));

    return result?.count ?? 0;
  }

  async incrementRepliesCount(noteId: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ repliesCount: sql`${notes.repliesCount} + 1` })
      .where(eq(notes.id, noteId));
  }

  async decrementRepliesCount(noteId: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ repliesCount: sql`GREATEST(${notes.repliesCount} - 1, 0)` })
      .where(eq(notes.id, noteId));
  }

  async incrementRenoteCount(noteId: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ renoteCount: sql`${notes.renoteCount} + 1` })
      .where(eq(notes.id, noteId));
  }

  async decrementRenoteCount(noteId: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ renoteCount: sql`GREATEST(${notes.renoteCount} - 1, 0)` })
      .where(eq(notes.id, noteId));
  }

  async softDelete(id: string, deletedById: string, reason?: string): Promise<Note | null> {
    await this.db
      .update(notes)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
        deletionReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id));

    // MySQL doesn't support RETURNING, fetch the updated record
    const [result] = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);

    return (result as Note) ?? null;
  }

  async restore(id: string): Promise<Note | null> {
    await this.db
      .update(notes)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id));

    // MySQL doesn't support RETURNING, fetch the updated record
    const [result] = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);

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

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.deletedAt))
      .limit(limit)
      .offset(offset);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
          },
        }) as Note,
    );
  }

  async findMentionsAndReplies(_userId: string, _options: TimelineOptions): Promise<Note[]> {
    // TODO: Implement MySQL-specific query for mentions and replies
    throw new Error("Not implemented for MySQL");
  }

  async findDirectMessages(_userId: string, _options: TimelineOptions): Promise<Note[]> {
    // TODO: Implement MySQL-specific query for direct messages
    throw new Error("Not implemented for MySQL");
  }

  async findDirectMessageThread(
    _userId: string,
    _partnerId: string,
    _options: TimelineOptions,
  ): Promise<Note[]> {
    // TODO: Implement MySQL-specific query for DM thread
    throw new Error("Not implemented for MySQL");
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
    // TODO: Implement MySQL-specific query for conversation partners
    throw new Error("Not implemented for MySQL");
  }
}
