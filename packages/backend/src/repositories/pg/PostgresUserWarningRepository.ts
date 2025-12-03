import { eq, and, desc, isNull, lte, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { userWarnings, type UserWarning } from "../../db/schema/pg.js";
import type { IUserWarningRepository } from "../../interfaces/repositories/IUserWarningRepository.js";
import { generateId } from "shared";

/**
 * PostgreSQL implementation of user warning repository
 */
export class PostgresUserWarningRepository implements IUserWarningRepository {
  constructor(private db: PostgresJsDatabase) {}

  async create(data: {
    userId: string;
    moderatorId: string;
    reason: string;
    expiresAt?: Date;
  }): Promise<UserWarning> {
    const [warning] = await this.db
      .insert(userWarnings)
      .values({
        id: generateId(),
        userId: data.userId,
        moderatorId: data.moderatorId,
        reason: data.reason,
        expiresAt: data.expiresAt ?? null,
        isRead: false,
      })
      .returning();

    return warning as UserWarning;
  }

  async findById(id: string): Promise<UserWarning | null> {
    const [warning] = await this.db
      .select()
      .from(userWarnings)
      .where(eq(userWarnings.id, id))
      .limit(1);

    return (warning as UserWarning) ?? null;
  }

  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; includeExpired?: boolean },
  ): Promise<UserWarning[]> {
    const { limit = 100, offset = 0, includeExpired = false } = options ?? {};

    const conditions = [eq(userWarnings.userId, userId)];

    if (!includeExpired) {
      // Only include non-expired warnings (null expiresAt or expiresAt > now)
      conditions.push(or(isNull(userWarnings.expiresAt), lte(sql`NOW()`, userWarnings.expiresAt))!);
    }

    const results = await this.db
      .select()
      .from(userWarnings)
      .where(and(...conditions))
      .orderBy(desc(userWarnings.createdAt))
      .limit(limit)
      .offset(offset);

    return results as UserWarning[];
  }

  async findByModeratorId(
    moderatorId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<UserWarning[]> {
    const { limit = 100, offset = 0 } = options ?? {};

    const results = await this.db
      .select()
      .from(userWarnings)
      .where(eq(userWarnings.moderatorId, moderatorId))
      .orderBy(desc(userWarnings.createdAt))
      .limit(limit)
      .offset(offset);

    return results as UserWarning[];
  }

  async findUnreadByUserId(userId: string): Promise<UserWarning[]> {
    const results = await this.db
      .select()
      .from(userWarnings)
      .where(
        and(
          eq(userWarnings.userId, userId),
          eq(userWarnings.isRead, false),
          or(isNull(userWarnings.expiresAt), lte(sql`NOW()`, userWarnings.expiresAt)),
        ),
      )
      .orderBy(desc(userWarnings.createdAt));

    return results as UserWarning[];
  }

  async markAsRead(id: string): Promise<UserWarning | null> {
    const [warning] = await this.db
      .update(userWarnings)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(userWarnings.id, id))
      .returning();

    return (warning as UserWarning) ?? null;
  }

  async markAllAsReadByUserId(userId: string): Promise<number> {
    const result = await this.db
      .update(userWarnings)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(eq(userWarnings.userId, userId), eq(userWarnings.isRead, false)))
      .returning();

    return result.length;
  }

  async countByUserId(
    userId: string,
    options?: { includeExpired?: boolean; unreadOnly?: boolean },
  ): Promise<number> {
    const { includeExpired = false, unreadOnly = false } = options ?? {};

    const conditions = [eq(userWarnings.userId, userId)];

    if (!includeExpired) {
      conditions.push(or(isNull(userWarnings.expiresAt), lte(sql`NOW()`, userWarnings.expiresAt))!);
    }

    if (unreadOnly) {
      conditions.push(eq(userWarnings.isRead, false));
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userWarnings)
      .where(and(...conditions));

    return result?.count ?? 0;
  }

  async count(): Promise<number> {
    const [result] = await this.db.select({ count: sql<number>`count(*)::int` }).from(userWarnings);

    return result?.count ?? 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(userWarnings).where(eq(userWarnings.id, id)).returning();

    return result.length > 0;
  }

  async findAll(options?: {
    userId?: string;
    moderatorId?: string;
    limit?: number;
    offset?: number;
    includeExpired?: boolean;
  }): Promise<UserWarning[]> {
    const { userId, moderatorId, limit = 100, offset = 0, includeExpired = false } = options ?? {};

    const conditions = [];

    if (userId) {
      conditions.push(eq(userWarnings.userId, userId));
    }

    if (moderatorId) {
      conditions.push(eq(userWarnings.moderatorId, moderatorId));
    }

    if (!includeExpired) {
      conditions.push(or(isNull(userWarnings.expiresAt), lte(sql`NOW()`, userWarnings.expiresAt))!);
    }

    const query = this.db
      .select()
      .from(userWarnings)
      .orderBy(desc(userWarnings.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      return (await query.where(and(...conditions))) as UserWarning[];
    }

    return (await query) as UserWarning[];
  }
}
