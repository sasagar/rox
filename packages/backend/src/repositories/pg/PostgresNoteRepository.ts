import { eq, and, isNull, inArray, desc, gt, lt, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { notes, users } from '../../db/schema/pg.js';
import type {
  INoteRepository,
  TimelineOptions,
} from '../../interfaces/repositories/INoteRepository.js';
import type { Note } from 'shared';

export class PostgresNoteRepository implements INoteRepository {
  constructor(private db: Database) {}

  async create(note: Omit<Note, 'createdAt' | 'updatedAt'>): Promise<Note> {
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
      throw new Error('Failed to create note');
    }

    return result as Note;
  }

  async findById(id: string): Promise<Note | null> {
    const [result] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1);

    return (result as Note) ?? null;
  }

  async findByUri(uri: string): Promise<Note | null> {
    const [result] = await this.db
      .select()
      .from(notes)
      .where(eq(notes.uri, uri))
      .limit(1);

    return (result as Note) ?? null;
  }

  async getLocalTimeline(options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    // 条件を配列に集める
    const conditions = [
      isNull(users.host), // ローカルユーザーのみ
      eq(notes.visibility, 'public'), // 公開投稿のみ
      eq(notes.localOnly, false), // localOnlyでない投稿
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

    return results.map((r) => r.notes as Note);
  }

  async getTimeline(
    options: TimelineOptions & { userIds: string[] }
  ): Promise<Note[]> {
    const { limit = 20, sinceId, untilId, userIds } = options;

    if (userIds.length === 0) {
      return [];
    }

    let conditions = [inArray(notes.userId, userIds)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results as Note[];
  }

  async findByUserId(
    userId: string,
    options: TimelineOptions
  ): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    let conditions = [eq(notes.userId, userId)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results as Note[];
  }

  async findReplies(
    noteId: string,
    options: TimelineOptions
  ): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    let conditions = [eq(notes.replyId, noteId)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results as Note[];
  }

  async findRenotes(
    noteId: string,
    options: TimelineOptions
  ): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    let conditions = [eq(notes.renoteId, noteId)];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results as Note[];
  }

  async update(
    id: string,
    data: Partial<Omit<Note, 'id' | 'createdAt'>>
  ): Promise<Note> {
    const [result] = await this.db
      .update(notes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    if (!result) {
      throw new Error('Note not found');
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
        .where(isNull(users.host));

      return result?.count ?? 0;
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes);

    return result?.count ?? 0;
  }
}
