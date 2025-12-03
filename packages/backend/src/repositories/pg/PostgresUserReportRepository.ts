import { eq, sql, desc, and } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { userReports, type UserReport } from "../../db/schema/pg.js";
import type {
  IUserReportRepository,
  ReportStatus,
} from "../../interfaces/repositories/IUserReportRepository.js";
import { generateId } from "shared";

/**
 * PostgreSQL implementation of User Report Repository
 */
export class PostgresUserReportRepository implements IUserReportRepository {
  constructor(private db: Database) {}

  async create(data: {
    reporterId: string;
    targetUserId?: string;
    targetNoteId?: string;
    reason: string;
    comment?: string;
  }): Promise<UserReport> {
    const [result] = await this.db
      .insert(userReports)
      .values({
        id: generateId(),
        reporterId: data.reporterId,
        targetUserId: data.targetUserId ?? null,
        targetNoteId: data.targetNoteId ?? null,
        reason: data.reason,
        comment: data.comment ?? null,
        status: "pending",
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create user report");
    }

    return result;
  }

  async findById(id: string): Promise<UserReport | null> {
    const [result] = await this.db
      .select()
      .from(userReports)
      .where(eq(userReports.id, id))
      .limit(1);

    return result ?? null;
  }

  async findAll(options?: {
    status?: ReportStatus;
    targetUserId?: string;
    reporterId?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserReport[]> {
    const conditions = [];

    if (options?.status) {
      conditions.push(eq(userReports.status, options.status));
    }
    if (options?.targetUserId) {
      conditions.push(eq(userReports.targetUserId, options.targetUserId));
    }
    if (options?.reporterId) {
      conditions.push(eq(userReports.reporterId, options.reporterId));
    }

    const query = this.db
      .select()
      .from(userReports)
      .orderBy(desc(userReports.createdAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  async count(options?: {
    status?: ReportStatus;
    targetUserId?: string;
    reporterId?: string;
  }): Promise<number> {
    const conditions = [];

    if (options?.status) {
      conditions.push(eq(userReports.status, options.status));
    }
    if (options?.targetUserId) {
      conditions.push(eq(userReports.targetUserId, options.targetUserId));
    }
    if (options?.reporterId) {
      conditions.push(eq(userReports.reporterId, options.reporterId));
    }

    const query = this.db.select({ count: sql<number>`count(*)::int` }).from(userReports);

    if (conditions.length > 0) {
      const [result] = await query.where(and(...conditions));
      return result?.count ?? 0;
    }

    const [result] = await query;
    return result?.count ?? 0;
  }

  async resolve(
    id: string,
    resolvedById: string,
    resolution: string,
    status: "resolved" | "rejected",
  ): Promise<UserReport | null> {
    const [updated] = await this.db
      .update(userReports)
      .set({
        status,
        resolvedById,
        resolution,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userReports.id, id))
      .returning();

    return updated ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(userReports)
      .where(eq(userReports.id, id))
      .returning({ id: userReports.id });

    return result.length > 0;
  }

  async hasReported(
    reporterId: string,
    targetUserId?: string,
    targetNoteId?: string,
  ): Promise<boolean> {
    const conditions = [eq(userReports.reporterId, reporterId)];

    if (targetUserId) {
      conditions.push(eq(userReports.targetUserId, targetUserId));
    }
    if (targetNoteId) {
      conditions.push(eq(userReports.targetNoteId, targetNoteId));
    }

    // Must have at least one target
    if (!targetUserId && !targetNoteId) {
      return false;
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userReports)
      .where(and(...conditions));

    return (result?.count ?? 0) > 0;
  }
}
