import { eq, sql, desc, and } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { moderationAuditLogs, type ModerationAuditLog } from '../../db/schema/pg.js';
import type {
  IModerationAuditLogRepository,
  ModerationAction,
  ModerationTargetType,
} from '../../interfaces/repositories/IModerationAuditLogRepository.js';
import { generateId } from 'shared';

/**
 * PostgreSQL implementation of Moderation Audit Log Repository
 */
export class PostgresModerationAuditLogRepository implements IModerationAuditLogRepository {
  constructor(private db: Database) {}

  async create(data: {
    moderatorId: string;
    action: ModerationAction;
    targetType: ModerationTargetType;
    targetId: string;
    reason?: string;
    details?: Record<string, unknown>;
  }): Promise<ModerationAuditLog> {
    const [result] = await this.db
      .insert(moderationAuditLogs)
      .values({
        id: generateId(),
        moderatorId: data.moderatorId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason ?? null,
        details: data.details ?? null,
      })
      .returning();

    if (!result) {
      throw new Error('Failed to create moderation audit log');
    }

    return result;
  }

  async findById(id: string): Promise<ModerationAuditLog | null> {
    const [result] = await this.db
      .select()
      .from(moderationAuditLogs)
      .where(eq(moderationAuditLogs.id, id))
      .limit(1);

    return result ?? null;
  }

  async findAll(options?: {
    moderatorId?: string;
    action?: ModerationAction;
    targetType?: ModerationTargetType;
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationAuditLog[]> {
    const conditions = [];

    if (options?.moderatorId) {
      conditions.push(eq(moderationAuditLogs.moderatorId, options.moderatorId));
    }
    if (options?.action) {
      conditions.push(eq(moderationAuditLogs.action, options.action));
    }
    if (options?.targetType) {
      conditions.push(eq(moderationAuditLogs.targetType, options.targetType));
    }
    if (options?.targetId) {
      conditions.push(eq(moderationAuditLogs.targetId, options.targetId));
    }

    const query = this.db
      .select()
      .from(moderationAuditLogs)
      .orderBy(desc(moderationAuditLogs.createdAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  async count(options?: {
    moderatorId?: string;
    action?: ModerationAction;
    targetType?: ModerationTargetType;
    targetId?: string;
  }): Promise<number> {
    const conditions = [];

    if (options?.moderatorId) {
      conditions.push(eq(moderationAuditLogs.moderatorId, options.moderatorId));
    }
    if (options?.action) {
      conditions.push(eq(moderationAuditLogs.action, options.action));
    }
    if (options?.targetType) {
      conditions.push(eq(moderationAuditLogs.targetType, options.targetType));
    }
    if (options?.targetId) {
      conditions.push(eq(moderationAuditLogs.targetId, options.targetId));
    }

    const query = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(moderationAuditLogs);

    if (conditions.length > 0) {
      const [result] = await query.where(and(...conditions));
      return result?.count ?? 0;
    }

    const [result] = await query;
    return result?.count ?? 0;
  }

  async findByTarget(
    targetType: ModerationTargetType,
    targetId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ModerationAuditLog[]> {
    return this.db
      .select()
      .from(moderationAuditLogs)
      .where(
        and(
          eq(moderationAuditLogs.targetType, targetType),
          eq(moderationAuditLogs.targetId, targetId)
        )
      )
      .orderBy(desc(moderationAuditLogs.createdAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);
  }

  async findByModerator(
    moderatorId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ModerationAuditLog[]> {
    return this.db
      .select()
      .from(moderationAuditLogs)
      .where(eq(moderationAuditLogs.moderatorId, moderatorId))
      .orderBy(desc(moderationAuditLogs.createdAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);
  }
}
