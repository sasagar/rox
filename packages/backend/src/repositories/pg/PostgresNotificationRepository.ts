import { eq, and, desc, lt, gt, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { notifications, type Notification, type NotificationType } from "../../db/schema/pg.js";
import type { INotificationRepository } from "../../interfaces/repositories/INotificationRepository.js";
import { generateId } from "shared";

/**
 * PostgreSQL implementation of notification repository
 */
export class PostgresNotificationRepository implements INotificationRepository {
  constructor(private db: PostgresJsDatabase) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    notifierId?: string;
    noteId?: string;
    reaction?: string;
    warningId?: string;
  }): Promise<Notification> {
    const [notification] = await this.db
      .insert(notifications)
      .values({
        id: generateId(),
        userId: data.userId,
        type: data.type,
        notifierId: data.notifierId ?? null,
        noteId: data.noteId ?? null,
        reaction: data.reaction ?? null,
        warningId: data.warningId ?? null,
        isRead: false,
      })
      .returning();

    return notification as Notification;
  }

  async findById(id: string): Promise<Notification | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    return (notification as Notification) ?? null;
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      sinceId?: string;
      untilId?: string;
      types?: NotificationType[];
      unreadOnly?: boolean;
    },
  ): Promise<Notification[]> {
    const { limit = 40, sinceId, untilId, types, unreadOnly } = options ?? {};

    const conditions = [eq(notifications.userId, userId)];

    if (sinceId) {
      // Get notifications after (newer than) sinceId
      const sinceNotification = await this.findById(sinceId);
      if (sinceNotification) {
        conditions.push(gt(notifications.createdAt, sinceNotification.createdAt));
      }
    }

    if (untilId) {
      // Get notifications before (older than) untilId
      const untilNotification = await this.findById(untilId);
      if (untilNotification) {
        conditions.push(lt(notifications.createdAt, untilNotification.createdAt));
      }
    }

    if (types && types.length > 0) {
      conditions.push(inArray(notifications.type, types));
    }

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const results = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return results as Notification[];
  }

  async findUnreadByUserId(userId: string, limit: number = 40): Promise<Notification[]> {
    const results = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return results as Notification[];
  }

  async markAsRead(id: string): Promise<Notification | null> {
    const [notification] = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();

    return (notification as Notification) ?? null;
  }

  async markAllAsReadByUserId(userId: string): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning();

    return result.length;
  }

  async markAsReadUntil(userId: string, untilId: string): Promise<number> {
    const untilNotification = await this.findById(untilId);
    if (!untilNotification) {
      return 0;
    }

    const result = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          // Mark as read all notifications created at or before the untilId notification
          sql`${notifications.createdAt} <= ${untilNotification.createdAt}`,
        ),
      )
      .returning();

    return result.length;
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return result?.count ?? 0;
  }

  async countByUserId(
    userId: string,
    options?: { types?: NotificationType[]; unreadOnly?: boolean },
  ): Promise<number> {
    const { types, unreadOnly } = options ?? {};

    const conditions = [eq(notifications.userId, userId)];

    if (types && types.length > 0) {
      conditions.push(inArray(notifications.type, types));
    }

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions));

    return result?.count ?? 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(notifications).where(eq(notifications.id, id)).returning();

    return result.length > 0;
  }

  async deleteAllByUserId(userId: string): Promise<number> {
    const result = await this.db
      .delete(notifications)
      .where(eq(notifications.userId, userId))
      .returning();

    return result.length;
  }

  async deleteOlderThan(userId: string, before: Date): Promise<number> {
    const result = await this.db
      .delete(notifications)
      .where(and(eq(notifications.userId, userId), lt(notifications.createdAt, before)))
      .returning();

    return result.length;
  }

  async exists(
    userId: string,
    type: NotificationType,
    notifierId?: string,
    noteId?: string,
  ): Promise<boolean> {
    const conditions = [eq(notifications.userId, userId), eq(notifications.type, type)];

    if (notifierId) {
      conditions.push(eq(notifications.notifierId, notifierId));
    }

    if (noteId) {
      conditions.push(eq(notifications.noteId, noteId));
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions))
      .limit(1);

    return (result?.count ?? 0) > 0;
  }
}
