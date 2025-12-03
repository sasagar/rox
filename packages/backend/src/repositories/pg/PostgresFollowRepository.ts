import { eq, and, or, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { follows, users } from "../../db/schema/pg.js";
import type { IFollowRepository } from "../../interfaces/repositories/IFollowRepository.js";
import type { Follow } from "shared";

export class PostgresFollowRepository implements IFollowRepository {
  constructor(private db: Database) {}

  async create(follow: Omit<Follow, "createdAt" | "updatedAt">): Promise<Follow> {
    const now = new Date();
    const [result] = await this.db
      .insert(follows)
      .values({
        ...follow,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create follow");
    }

    return result as Follow;
  }

  async findById(id: string): Promise<Follow | null> {
    const [result] = await this.db.select().from(follows).where(eq(follows.id, id)).limit(1);

    return (result as Follow) ?? null;
  }

  async exists(followerId: string, followeeId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
      .limit(1);

    return result !== undefined;
  }

  async findByFolloweeId(followeeId: string, limit = 100): Promise<Follow[]> {
    const results = await this.db
      .select()
      .from(follows)
      .where(eq(follows.followeeId, followeeId))
      .limit(limit);

    return results as Follow[];
  }

  async findByFollowerId(followerId: string, limit = 100): Promise<Follow[]> {
    const results = await this.db
      .select({
        follow: follows,
        followee: users,
      })
      .from(follows)
      .leftJoin(users, eq(follows.followeeId, users.id))
      .where(eq(follows.followerId, followerId))
      .limit(limit);

    return results.map((r) => ({
      ...r.follow,
      followee: r.followee,
    })) as Follow[];
  }

  async countFollowers(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followeeId, userId));

    return result?.count ?? 0;
  }

  async countFollowing(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, userId));

    return result?.count ?? 0;
  }

  async delete(followerId: string, followeeId: string): Promise<void> {
    await this.db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .delete(follows)
      .where(or(eq(follows.followerId, userId), eq(follows.followeeId, userId)));
  }
}
