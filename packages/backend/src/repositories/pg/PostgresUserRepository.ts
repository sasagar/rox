import { eq, and, isNull, isNotNull, sql, desc, or, ilike } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { users, type User } from "../../db/schema/pg.js";
import type {
  IUserRepository,
  ListUsersOptions,
  SearchUsersOptions,
} from "../../interfaces/repositories/IUserRepository.js";

export class PostgresUserRepository implements IUserRepository {
  constructor(private db: Database) {}

  async create(user: Omit<User, "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date();
    const [result] = await this.db
      .insert(users)
      .values({
        ...user,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

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
    const [result] = await this.db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

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
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(localOnly ? isNull(users.host) : undefined);

    return result?.count ?? 0;
  }

  async countRemote(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(isNotNull(users.host));

    return result?.count ?? 0;
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

    const conditions = [
      // Match username or displayName (case-insensitive)
      or(ilike(users.username, searchPattern), ilike(users.displayName, searchPattern)),
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
}
