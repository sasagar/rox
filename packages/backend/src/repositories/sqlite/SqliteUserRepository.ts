/**
 * SQLite User Repository
 *
 * SQLite/D1 implementation of the IUserRepository interface.
 *
 * @module repositories/sqlite/SqliteUserRepository
 */

import { eq, and, isNull, isNotNull, sql, desc, or } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { users, type User } from "../../db/schema/sqlite.js";
import type * as sqliteSchema from "../../db/schema/sqlite.js";
import type {
  IUserRepository,
  ListUsersOptions,
  SearchUsersOptions,
} from "../../interfaces/repositories/IUserRepository.js";

type SqliteDatabase = BetterSQLite3Database<typeof sqliteSchema>;

export class SqliteUserRepository implements IUserRepository {
  constructor(private db: SqliteDatabase) {}

  async create(user: Omit<User, "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date();
    this.db.insert(users).values({
      ...user,
      createdAt: now,
      updatedAt: now,
    }).run();

    // SQLite with better-sqlite3 is synchronous, fetch the inserted record
    const [result] = this.db.select().from(users).where(eq(users.id, user.id)).limit(1).all();

    if (!result) {
      throw new Error("Failed to create user");
    }

    return result as User;
  }

  async findById(id: string): Promise<User | null> {
    const [result] = this.db.select().from(users).where(eq(users.id, id)).limit(1).all();

    return (result as User) ?? null;
  }

  async findByUsername(username: string, host: string | null = null): Promise<User | null> {
    const [result] = this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.username, username),
          host === null ? isNull(users.host) : eq(users.host, host),
        ),
      )
      .limit(1)
      .all();

    return (result as User) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [result] = this.db.select().from(users).where(eq(users.email, email)).limit(1).all();

    return (result as User) ?? null;
  }

  async findByUri(uri: string): Promise<User | null> {
    const [result] = this.db.select().from(users).where(eq(users.uri, uri)).limit(1).all();

    return (result as User) ?? null;
  }

  async update(id: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User> {
    this.db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .run();

    // Fetch the updated record
    const [result] = this.db.select().from(users).where(eq(users.id, id)).limit(1).all();

    if (!result) {
      throw new Error("User not found");
    }

    return result as User;
  }

  async delete(id: string): Promise<void> {
    this.db.delete(users).where(eq(users.id, id)).run();
  }

  async count(localOnly = false): Promise<number> {
    const [result] = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(localOnly ? isNull(users.host) : undefined)
      .all();

    return result?.count ?? 0;
  }

  async countRemote(): Promise<number> {
    const [result] = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(isNotNull(users.host))
      .all();

    return result?.count ?? 0;
  }

  async countActiveLocal(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

    // SQLite stores timestamps as integers, so we need to convert
    const result = this.db.all<{ count: number }>(sql`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      INNER JOIN notes n ON n.user_id = u.id
      WHERE u.host IS NULL
        AND u.is_deleted = 0
        AND n.created_at >= ${cutoffTimestamp}
    `);

    return result[0]?.count ?? 0;
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

    const results = this.db
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return results as User[];
  }

  async search(options: SearchUsersOptions): Promise<User[]> {
    const { query, limit = 20, offset = 0, localOnly } = options;

    // Escape special characters for LIKE pattern
    const escapedQuery = query.replace(/[%_\\]/g, "\\$&");
    const searchPattern = `%${escapedQuery}%`;

    // SQLite uses LIKE with LOWER() for case-insensitive search
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

    const results = this.db
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
      .offset(offset)
      .all();

    return results as User[];
  }

  async findWithFetchErrors(options: { limit?: number; offset?: number } = {}): Promise<User[]> {
    const { limit = 100, offset = 0 } = options;

    const results = this.db
      .select()
      .from(users)
      .where(isNotNull(users.goneDetectedAt))
      .orderBy(desc(users.goneDetectedAt))
      .limit(limit)
      .offset(offset)
      .all();

    return results as User[];
  }

  async countWithFetchErrors(): Promise<number> {
    const [result] = this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(isNotNull(users.goneDetectedAt))
      .all();

    return result?.count ?? 0;
  }

  async recordFetchFailure(userId: string, errorMessage: string): Promise<void> {
    const now = new Date();

    // SQLite: Use COALESCE to conditionally set goneDetectedAt only if it's null
    this.db.run(sql`
      UPDATE users
      SET
        gone_detected_at = COALESCE(gone_detected_at, ${now.getTime()}),
        fetch_failure_count = fetch_failure_count + 1,
        last_fetch_attempt_at = ${now.getTime()},
        last_fetch_error = ${errorMessage},
        updated_at = ${now.getTime()}
      WHERE id = ${userId}
    `);
  }

  async clearFetchFailure(userId: string): Promise<void> {
    this.db
      .update(users)
      .set({
        goneDetectedAt: null,
        fetchFailureCount: 0,
        lastFetchAttemptAt: new Date(),
        lastFetchError: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .run();
  }

  async findFirstLocalAdmin(): Promise<User | null> {
    const [result] = this.db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.host),
          eq(users.isAdmin, true),
          isNotNull(users.privateKey),
        ),
      )
      .limit(1)
      .all();

    return (result as User) ?? null;
  }
}
