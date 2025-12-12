/**
 * PostgreSQL List Repository
 *
 * PostgreSQL implementation of the IListRepository interface.
 * Handles user-created lists (Twitter/X-like lists).
 *
 * @module repositories/pg/PostgresListRepository
 */

import { eq, and, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { userLists, userListMembers, users } from "../../db/schema/pg.js";
import type { IListRepository } from "../../interfaces/repositories/IListRepository.js";
import type { List, ListMember, ListWithMemberCount, ListMembership } from "shared";

export class PostgresListRepository implements IListRepository {
  constructor(private db: Database) {}

  async create(list: Omit<List, "createdAt" | "updatedAt">): Promise<List> {
    const now = new Date();
    const [result] = await this.db
      .insert(userLists)
      .values({
        ...list,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create list");
    }

    return result as List;
  }

  async findById(id: string): Promise<List | null> {
    const [result] = await this.db.select().from(userLists).where(eq(userLists.id, id)).limit(1);

    return (result as List) ?? null;
  }

  async findByUserId(userId: string): Promise<ListWithMemberCount[]> {
    const results = await this.db
      .select({
        list: userLists,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${userListMembers}
          WHERE ${userListMembers.listId} = ${userLists.id}
        )`,
      })
      .from(userLists)
      .where(eq(userLists.userId, userId))
      .orderBy(userLists.createdAt);

    return results.map((r) => ({
      ...r.list,
      memberCount: r.memberCount,
    })) as ListWithMemberCount[];
  }

  async findPublicByUserId(userId: string): Promise<ListWithMemberCount[]> {
    const results = await this.db
      .select({
        list: userLists,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${userListMembers}
          WHERE ${userListMembers.listId} = ${userLists.id}
        )`,
      })
      .from(userLists)
      .where(and(eq(userLists.userId, userId), eq(userLists.isPublic, true)))
      .orderBy(userLists.createdAt);

    return results.map((r) => ({
      ...r.list,
      memberCount: r.memberCount,
    })) as ListWithMemberCount[];
  }

  async existsByUserIdAndName(userId: string, name: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: userLists.id })
      .from(userLists)
      .where(and(eq(userLists.userId, userId), eq(userLists.name, name)))
      .limit(1);

    return result !== undefined;
  }

  async update(id: string, data: Partial<Pick<List, "name" | "isPublic">>): Promise<List> {
    const [result] = await this.db
      .update(userLists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userLists.id, id))
      .returning();

    if (!result) {
      throw new Error("Failed to update list");
    }

    return result as List;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(userLists).where(eq(userLists.id, id));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(userLists).where(eq(userLists.userId, userId));
  }

  async addMember(member: Omit<ListMember, "createdAt">): Promise<ListMember> {
    const [result] = await this.db
      .insert(userListMembers)
      .values({
        ...member,
        createdAt: new Date(),
      })
      .returning();

    if (!result) {
      throw new Error("Failed to add member");
    }

    return result as ListMember;
  }

  async removeMember(listId: string, userId: string): Promise<void> {
    await this.db
      .delete(userListMembers)
      .where(and(eq(userListMembers.listId, listId), eq(userListMembers.userId, userId)));
  }

  async isMember(listId: string, userId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: userListMembers.id })
      .from(userListMembers)
      .where(and(eq(userListMembers.listId, listId), eq(userListMembers.userId, userId)))
      .limit(1);

    return result !== undefined;
  }

  async getMembers(listId: string, limit = 100, offset = 0): Promise<ListMembership[]> {
    const results = await this.db
      .select({
        member: userListMembers,
        user: users,
      })
      .from(userListMembers)
      .leftJoin(users, eq(userListMembers.userId, users.id))
      .where(eq(userListMembers.listId, listId))
      .limit(limit)
      .offset(offset);

    return results.map((r) => ({
      ...r.member,
      user: r.user
        ? {
            id: r.user.id,
            username: r.user.username,
            displayName: r.user.displayName,
            avatarUrl: r.user.avatarUrl,
            host: r.user.host,
          }
        : undefined,
    })) as ListMembership[];
  }

  async getMemberUserIds(listId: string): Promise<string[]> {
    const results = await this.db
      .select({ userId: userListMembers.userId })
      .from(userListMembers)
      .where(eq(userListMembers.listId, listId));

    return results.map((r) => r.userId);
  }

  async countMembers(listId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userListMembers)
      .where(eq(userListMembers.listId, listId));

    return result?.count ?? 0;
  }

  async updateMember(
    listId: string,
    userId: string,
    data: Partial<Pick<ListMember, "withReplies">>,
  ): Promise<ListMember> {
    const [result] = await this.db
      .update(userListMembers)
      .set(data)
      .where(and(eq(userListMembers.listId, listId), eq(userListMembers.userId, userId)))
      .returning();

    if (!result) {
      throw new Error("Failed to update member");
    }

    return result as ListMember;
  }

  async findListsContainingUser(userId: string, ownerId: string): Promise<List[]> {
    const results = await this.db
      .select({ list: userLists })
      .from(userLists)
      .innerJoin(userListMembers, eq(userLists.id, userListMembers.listId))
      .where(and(eq(userListMembers.userId, userId), eq(userLists.userId, ownerId)));

    return results.map((r) => r.list) as List[];
  }
}
