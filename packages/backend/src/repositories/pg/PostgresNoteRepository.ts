import { eq, and, or, isNull, inArray, desc, gt, lt, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { notes, users } from "../../db/schema/pg.js";
import type {
  INoteRepository,
  TimelineOptions,
} from "../../interfaces/repositories/INoteRepository.js";
import type { Note } from "shared";

export class PostgresNoteRepository implements INoteRepository {
  constructor(private db: Database) {}

  async create(note: Omit<Note, "createdAt" | "updatedAt">): Promise<Note> {
    const now = new Date();
    const [result] = await this.db
      .insert(notes)
      .values({
        ...note,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create note");
    }

    return result as Note;
  }

  async findById(id: string): Promise<Note | null> {
    const [result] = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);

    return (result as Note) ?? null;
  }

  async findByUri(uri: string): Promise<Note | null> {
    const [result] = await this.db.select().from(notes).where(eq(notes.uri, uri)).limit(1);

    return (result as Note) ?? null;
  }

  async getLocalTimeline(options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    // 条件を配列に集める
    const conditions = [
      isNull(users.host), // ローカルユーザーのみ
      eq(notes.visibility, "public"), // 公開投稿のみ
      eq(notes.localOnly, false), // localOnlyでない投稿
      eq(notes.isDeleted, false), // ソフトデリートされていない
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
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
          },
        }) as Note,
    );
  }

  async getTimeline(options: TimelineOptions & { userIds: string[] }): Promise<Note[]> {
    const { limit = 20, sinceId, untilId, userIds } = options;

    if (userIds.length === 0) {
      return [];
    }

    const conditions = [
      inArray(notes.userId, userIds),
      eq(notes.isDeleted, false), // ソフトデリートされていない
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
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
          },
        }) as Note,
    );
  }

  async getSocialTimeline(options: TimelineOptions & { userIds?: string[] }): Promise<Note[]> {
    const { limit = 20, sinceId, untilId, userIds = [] } = options;

    // ソーシャルタイムライン = ローカルの公開投稿 OR フォロー中のリモートユーザーの投稿
    const conditions = [
      eq(notes.isDeleted, false), // ソフトデリートされていない
    ];

    // ローカル公開投稿の条件（localOnlyではない、publicのみ）
    const localConditions = [
      isNull(users.host),
      eq(notes.visibility, "public"),
      eq(notes.localOnly, false),
    ];

    // リモートユーザーの投稿の条件（userIdsに含まれる）
    if (userIds.length > 0) {
      // (ローカル公開投稿) OR (フォロー中のリモートユーザー)
      conditions.push(or(and(...localConditions), inArray(notes.userId, userIds))!);
    } else {
      // フォローなしの場合はローカル公開投稿のみ
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

    return results.map((r) => r.notes as Note);
  }

  async findByUserId(userId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      eq(notes.userId, userId),
      eq(notes.isDeleted, false), // ソフトデリートされていない
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
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
          },
        }) as Note,
    );
  }

  async findReplies(noteId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      eq(notes.replyId, noteId),
      eq(notes.isDeleted, false), // ソフトデリートされていない
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
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
          },
        }) as Note,
    );
  }

  async findRenotes(noteId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      eq(notes.renoteId, noteId),
      eq(notes.isDeleted, false), // ソフトデリートされていない
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
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
          },
        }) as Note,
    );
  }

  async update(id: string, data: Partial<Omit<Note, "id" | "createdAt">>): Promise<Note> {
    const [result] = await this.db
      .update(notes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

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
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .innerJoin(users, eq(notes.userId, users.id))
        .where(and(isNull(users.host), eq(notes.isDeleted, false)));

      return result?.count ?? 0;
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(eq(notes.isDeleted, false));

    return result?.count ?? 0;
  }

  async countByUserId(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.isDeleted, false)));

    return result?.count ?? 0;
  }

  async softDelete(id: string, deletedById: string, reason?: string): Promise<Note | null> {
    const [result] = await this.db
      .update(notes)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
        deletionReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    return (result as Note) ?? null;
  }

  async restore(id: string): Promise<Note | null> {
    const [result] = await this.db
      .update(notes)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

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
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
          },
        }) as Note,
    );
  }
}
