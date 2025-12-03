import { eq, and, desc, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  scheduledNotes,
  type ScheduledNote,
  type NewScheduledNote,
  type ScheduledNoteStatus,
} from "../../db/schema/pg.js";
import type { IScheduledNoteRepository } from "../../interfaces/repositories/IScheduledNoteRepository.js";

/**
 * PostgreSQL implementation of scheduled note repository
 */
export class PostgresScheduledNoteRepository implements IScheduledNoteRepository {
  constructor(private db: PostgresJsDatabase) {}

  async create(input: NewScheduledNote): Promise<ScheduledNote> {
    const [scheduledNote] = await this.db
      .insert(scheduledNotes)
      .values(input)
      .returning();

    return scheduledNote as ScheduledNote;
  }

  async findById(id: string): Promise<ScheduledNote | null> {
    const [scheduledNote] = await this.db
      .select()
      .from(scheduledNotes)
      .where(eq(scheduledNotes.id, id))
      .limit(1);

    return (scheduledNote as ScheduledNote) ?? null;
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: ScheduledNoteStatus;
    },
  ): Promise<ScheduledNote[]> {
    const { limit = 20, offset = 0, status } = options ?? {};

    const conditions = [eq(scheduledNotes.userId, userId)];

    if (status) {
      conditions.push(eq(scheduledNotes.status, status));
    }

    const results = await this.db
      .select()
      .from(scheduledNotes)
      .where(and(...conditions))
      .orderBy(desc(scheduledNotes.scheduledAt))
      .limit(limit)
      .offset(offset);

    return results as ScheduledNote[];
  }

  async countPendingByUserId(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(scheduledNotes)
      .where(
        and(eq(scheduledNotes.userId, userId), eq(scheduledNotes.status, "pending")),
      );

    return result?.count ?? 0;
  }

  async findPendingToPublish(before: Date, limit: number): Promise<ScheduledNote[]> {
    const results = await this.db
      .select()
      .from(scheduledNotes)
      .where(
        and(
          eq(scheduledNotes.status, "pending"),
          lt(scheduledNotes.scheduledAt, before),
        ),
      )
      .orderBy(scheduledNotes.scheduledAt)
      .limit(limit);

    return results as ScheduledNote[];
  }

  async update(
    id: string,
    input: Partial<Omit<ScheduledNote, "id" | "userId" | "createdAt">>,
  ): Promise<ScheduledNote | null> {
    const [scheduledNote] = await this.db
      .update(scheduledNotes)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(scheduledNotes.id, id))
      .returning();

    return (scheduledNote as ScheduledNote) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(scheduledNotes)
      .where(eq(scheduledNotes.id, id))
      .returning();

    return result.length > 0;
  }
}
