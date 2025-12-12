/**
 * MySQL User Repository
 *
 * MySQL implementation of the IUserRepository interface.
 *
 * @module repositories/mysql/MysqlUserRepository
 */

import { eq, and, isNull, isNotNull, sql, desc, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { users, type User } from "../../db/schema/mysql.js";
import type * as mysqlSchema from "../../db/schema/mysql.js";
import type {
  IUserRepository,
  ListUsersOptions,
  SearchUsersOptions,
} from "../../interfaces/repositories/IUserRepository.js";

type MysqlDatabase = MySql2Database<typeof mysqlSchema>;

export class MysqlUserRepository implements IUserRepository {
  constructor(private db: MysqlDatabase) {}

  async create(user: Omit<User, "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date();
    await this.db.insert(users).values({
      ...user,
      createdAt: now,
      updatedAt: now,
    });

    // MySQL doesn't support RETURNING, so we need to fetch the inserted record
    const [result] = await this.db.select().from(users).where(eq(users.id, user.id)).limit(1);

    if (!result) {
      throw new Error("Failed to create user");
    }

    return result as User;
  }

  async findById(id: string): Promise<User | null> {
    const [result] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);

    return (result as User) ?? null;
  }

  async findByUsername(username: string, host: string | null = null): Promise<User | null> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.username, username),
          host === null ? isNull(users.host) : eq(users.host, host),
        ),
      )
      .limit(1);

    return (result as User) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [result] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    return (result as User) ?? null;
  }

  async findByUri(uri: string): Promise<User | null> {
    const [result] = await this.db.select().from(users).where(eq(users.uri, uri)).limit(1);

    return (result as User) ?? null;
  }

  async update(id: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User> {
    await this.db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    // MySQL doesn't support RETURNING, so we need to fetch the updated record
    const [result] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!result) {
      throw new Error("User not found");
    }

    return result as User;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  async count(localOnly = false): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`CAST(COUNT(*) AS SIGNED)` })
      .from(users)
      .where(localOnly ? isNull(users.host) : undefined);

    return result?.count ?? 0;
  }

  async countRemote(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`CAST(COUNT(*) AS SIGNED)` })
      .from(users)
      .where(isNotNull(users.host));

    return result?.count ?? 0;
  }

  async countActiveLocal(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Count distinct local users who have posted at least one note in the given period
    const result = await this.db.execute(sql`
      SELECT CAST(COUNT(DISTINCT u.id) AS SIGNED) as count
      FROM users u
      INNER JOIN notes n ON n.user_id = u.id
      WHERE u.host IS NULL
        AND u.is_deleted = false
        AND n.created_at >= ${cutoffDate}
    `);

    // MySQL execute returns [rows, fields], we need the first row
    const rows = result[0] as unknown as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  }

  async findAll(options: ListUsersOptions = {}): Promise<User[]> {
    const { limit = 100, offset = 0, localOnly, remoteOnly, isAdmin, isSuspended } = options;

    const conditions = [];

    if (localOnly === true) {
      conditions.push(isNull(users.host));
    } else if (remoteOnly === true) {
      conditions.push(isNotNull(users.host));
    }

    if (isAdmin !== undefined) {
      conditions.push(eq(users.isAdmin, isAdmin));
    }

    if (isSuspended !== undefined) {
      conditions.push(eq(users.isSuspended, isSuspended));
    }

    const results = await this.db
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return results as User[];
  }

  async search(options: SearchUsersOptions): Promise<User[]> {
    const { query, limit = 20, offset = 0, localOnly } = options;

    // Escape special characters for LIKE pattern
    const escapedQuery = query.replace(/[%_\\]/g, "\\$&");
    const searchPattern = `%${escapedQuery}%`;

    // MySQL uses LIKE with LOWER() for case-insensitive search
    const conditions = [
      or(
        sql`LOWER(${users.username}) LIKE LOWER(${searchPattern})`,
        sql`LOWER(${users.displayName}) LIKE LOWER(${searchPattern})`,
      ),
    ];

    if (localOnly === true) {
      conditions.push(isNull(users.host));
    }

    // Exclude suspended users from search results
    conditions.push(eq(users.isSuspended, false));

    const results = await this.db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(
        // Prioritize exact username matches, then prefix matches
        sql`CASE
          WHEN LOWER(${users.username}) = LOWER(${query}) THEN 0
          WHEN LOWER(${users.username}) LIKE LOWER(${query + "%"}) THEN 1
          ELSE 2
        END`,
        desc(users.createdAt),
      )
      .limit(limit)
      .offset(offset);

    return results as User[];
  }

  async findWithFetchErrors(options: { limit?: number; offset?: number } = {}): Promise<User[]> {
    const { limit = 100, offset = 0 } = options;

    const results = await this.db
      .select()
      .from(users)
      .where(isNotNull(users.goneDetectedAt))
      .orderBy(desc(users.goneDetectedAt))
      .limit(limit)
      .offset(offset);

    return results as User[];
  }

  async countWithFetchErrors(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(isNotNull(users.goneDetectedAt));

    return result?.count ?? 0;
  }

  async recordFetchFailure(userId: string, errorMessage: string): Promise<void> {
    const now = new Date();

    // MySQL: Use COALESCE to conditionally set goneDetectedAt only if it's null
    await this.db.execute(sql`
      UPDATE users
      SET
        gone_detected_at = COALESCE(gone_detected_at, ${now}),
        fetch_failure_count = fetch_failure_count + 1,
        last_fetch_attempt_at = ${now},
        last_fetch_error = ${errorMessage},
        updated_at = ${now}
      WHERE id = ${userId}
    `);
  }

  async clearFetchFailure(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        goneDetectedAt: null,
        fetchFailureCount: 0,
        lastFetchAttemptAt: new Date(),
        lastFetchError: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async findFirstLocalAdmin(): Promise<User | null> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.host),
          eq(users.isAdmin, true),
          isNotNull(users.privateKey),
        ),
      )
      .limit(1);

    return (result as User) ?? null;
  }

  /**
   * Find the system user account
   *
   * Returns the local user with isSystemUser=true.
   * Used for server-level operations requiring HTTP signatures.
   */
  async findSystemUser(): Promise<User | null> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.host), // Local user
          eq(users.isSystemUser, true),
        ),
      )
      .limit(1);

    return (result as User) ?? null;
  }

  /**
   * Count user registrations within a time period
   * Used for Mastodon API instance activity statistics
   */
  async countRegistrationsInPeriod(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`CAST(COUNT(*) AS SIGNED)` })
      .from(users)
      .where(
        and(
          isNull(users.host), // Local users only
          sql`${users.createdAt} >= ${startDate}`,
          sql`${users.createdAt} < ${endDate}`,
        ),
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Increment followers count for a user
   */
  async incrementFollowersCount(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        followersCount: sql`${users.followersCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Decrement followers count for a user
   */
  async decrementFollowersCount(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        followersCount: sql`GREATEST(${users.followersCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Increment following count for a user
   */
  async incrementFollowingCount(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        followingCount: sql`${users.followingCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Decrement following count for a user
   */
  async decrementFollowingCount(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        followingCount: sql`GREATEST(${users.followingCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}
