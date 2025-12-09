/**
 * PostgreSQL Contact Repository Implementation
 *
 * Handles contact threads and messages for user support.
 */

import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  contactThreads,
  contactMessages,
  type ContactThread,
  type ContactMessage,
  type ContactThreadStatus,
} from "../../db/schema/pg.js";
import type {
  IContactRepository,
  ListContactThreadsOptions,
  CreateThreadInput,
  CreateMessageInput,
  ContactThreadWithPreview,
} from "../../interfaces/repositories/IContactRepository.js";

export class PostgresContactRepository implements IContactRepository {
  constructor(private db: PostgresJsDatabase) {}

  // ============================================
  // Thread operations
  // ============================================

  async createThread(input: CreateThreadInput): Promise<ContactThread> {
    const [thread] = await this.db
      .insert(contactThreads)
      .values({
        id: input.id,
        userId: input.userId || null,
        subject: input.subject,
        category: input.category || "general",
        email: input.email || null,
      })
      .returning();

    if (!thread) {
      throw new Error("Failed to create contact thread");
    }

    return thread;
  }

  async findThreadById(id: string): Promise<ContactThread | null> {
    const [thread] = await this.db
      .select()
      .from(contactThreads)
      .where(eq(contactThreads.id, id))
      .limit(1);

    return thread || null;
  }

  async listThreads(options: ListContactThreadsOptions = {}): Promise<ContactThreadWithPreview[]> {
    const {
      status,
      category,
      assignedToId,
      userId,
      limit = 20,
      offset = 0,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = options;

    // Build conditions
    const conditions = [];
    if (status) conditions.push(eq(contactThreads.status, status));
    if (category) conditions.push(eq(contactThreads.category, category));
    if (assignedToId) conditions.push(eq(contactThreads.assignedToId, assignedToId));
    if (userId) conditions.push(eq(contactThreads.userId, userId));

    // Determine sort column and direction
    const sortColumn =
      sortBy === "createdAt"
        ? contactThreads.createdAt
        : sortBy === "priority"
          ? contactThreads.priority
          : contactThreads.updatedAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    // Get threads
    const threads = await this.db
      .select()
      .from(contactThreads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get preview info for each thread
    const threadsWithPreview: ContactThreadWithPreview[] = await Promise.all(
      threads.map(async (thread) => {
        // Get latest message
        const [latestMessage] = await this.db
          .select()
          .from(contactMessages)
          .where(eq(contactMessages.threadId, thread.id))
          .orderBy(desc(contactMessages.createdAt))
          .limit(1);

        // Get message count
        const messageCountResult = await this.db
          .select({ value: count() })
          .from(contactMessages)
          .where(eq(contactMessages.threadId, thread.id));
        const messageCount = messageCountResult[0]?.value ?? 0;

        // Get unread count (for staff view, count unread user messages)
        const unreadCountResult = await this.db
          .select({ value: count() })
          .from(contactMessages)
          .where(
            and(
              eq(contactMessages.threadId, thread.id),
              eq(contactMessages.isRead, false),
              eq(contactMessages.senderType, "user"),
            ),
          );
        const unreadCount = unreadCountResult[0]?.value ?? 0;

        return {
          ...thread,
          lastMessagePreview: latestMessage?.content?.substring(0, 100),
          lastMessageAt: latestMessage?.createdAt,
          messageCount: Number(messageCount),
          unreadCount: Number(unreadCount),
        };
      }),
    );

    return threadsWithPreview;
  }

  async countThreads(
    options: Omit<ListContactThreadsOptions, "limit" | "offset" | "sortBy" | "sortOrder"> = {},
  ): Promise<number> {
    const { status, category, assignedToId, userId } = options;

    const conditions = [];
    if (status) conditions.push(eq(contactThreads.status, status));
    if (category) conditions.push(eq(contactThreads.category, category));
    if (assignedToId) conditions.push(eq(contactThreads.assignedToId, assignedToId));
    if (userId) conditions.push(eq(contactThreads.userId, userId));

    const result = await this.db
      .select({ value: count() })
      .from(contactThreads)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Number(result[0]?.value ?? 0);
  }

  async updateThreadStatus(id: string, status: ContactThreadStatus): Promise<ContactThread | null> {
    const updates: Partial<ContactThread> = {
      status,
      updatedAt: new Date(),
    };

    if (status === "resolved" || status === "closed") {
      updates.closedAt = new Date();
    }

    const [thread] = await this.db
      .update(contactThreads)
      .set(updates)
      .where(eq(contactThreads.id, id))
      .returning();

    return thread || null;
  }

  async assignThread(id: string, assignedToId: string | null): Promise<ContactThread | null> {
    const [thread] = await this.db
      .update(contactThreads)
      .set({
        assignedToId,
        updatedAt: new Date(),
      })
      .where(eq(contactThreads.id, id))
      .returning();

    return thread || null;
  }

  async updateThreadPriority(id: string, priority: number): Promise<ContactThread | null> {
    const [thread] = await this.db
      .update(contactThreads)
      .set({
        priority,
        updatedAt: new Date(),
      })
      .where(eq(contactThreads.id, id))
      .returning();

    return thread || null;
  }

  async updateInternalNotes(id: string, notes: string): Promise<ContactThread | null> {
    const [thread] = await this.db
      .update(contactThreads)
      .set({
        internalNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(contactThreads.id, id))
      .returning();

    return thread || null;
  }

  async closeThread(id: string): Promise<ContactThread | null> {
    const [thread] = await this.db
      .update(contactThreads)
      .set({
        status: "closed",
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contactThreads.id, id))
      .returning();

    return thread || null;
  }

  // ============================================
  // Message operations
  // ============================================

  async createMessage(input: CreateMessageInput): Promise<ContactMessage> {
    const [message] = await this.db
      .insert(contactMessages)
      .values({
        id: input.id,
        threadId: input.threadId,
        senderId: input.senderId || null,
        senderType: input.senderType,
        content: input.content,
        attachmentIds: input.attachmentIds || [],
      })
      .returning();

    if (!message) {
      throw new Error("Failed to create contact message");
    }

    // Update thread's updatedAt
    await this.db
      .update(contactThreads)
      .set({ updatedAt: new Date() })
      .where(eq(contactThreads.id, input.threadId));

    return message;
  }

  async getMessages(
    threadId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<ContactMessage[]> {
    const { limit = 100, offset = 0 } = options;

    return this.db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.threadId, threadId))
      .orderBy(asc(contactMessages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async markMessagesAsRead(threadId: string, forStaff: boolean): Promise<number> {
    // If staff is viewing, mark user messages as read
    // If user is viewing, mark staff messages as read
    const result = await this.db
      .update(contactMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(contactMessages.threadId, threadId),
          eq(contactMessages.isRead, false),
          forStaff
            ? eq(contactMessages.senderType, "user")
            : sql`${contactMessages.senderType} IN ('admin', 'moderator')`,
        ),
      );

    return result.count ?? 0;
  }

  async countUnreadForUser(userId: string): Promise<number> {
    // Count unread staff messages across all user's threads
    const result = await this.db
      .select({ value: count() })
      .from(contactMessages)
      .innerJoin(contactThreads, eq(contactMessages.threadId, contactThreads.id))
      .where(
        and(
          eq(contactThreads.userId, userId),
          eq(contactMessages.isRead, false),
          sql`${contactMessages.senderType} IN ('admin', 'moderator')`,
        ),
      );

    return Number(result[0]?.value ?? 0);
  }

  async countUnreadForStaff(): Promise<number> {
    // Count unread user messages across all threads
    const result = await this.db
      .select({ value: count() })
      .from(contactMessages)
      .where(and(eq(contactMessages.isRead, false), eq(contactMessages.senderType, "user")));

    return Number(result[0]?.value ?? 0);
  }

  async deleteThread(id: string): Promise<boolean> {
    // Messages are deleted via CASCADE
    const result = await this.db.delete(contactThreads).where(eq(contactThreads.id, id));

    return (result.count ?? 0) > 0;
  }
}
