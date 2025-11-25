import { eq, and, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { users } from '../../db/schema/pg.js';
import type { IUserRepository } from '../../interfaces/repositories/IUserRepository.js';
import type { User } from 'shared';

export class PostgresUserRepository implements IUserRepository {
  constructor(private db: Database) {}

  async create(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
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
      throw new Error('Failed to create user');
    }

    return result as User;
  }

  async findById(id: string): Promise<User | null> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return (result as User) ?? null;
  }

  async findByUsername(
    username: string,
    host: string | null = null
  ): Promise<User | null> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.username, username),
          host === null ? isNull(users.host) : eq(users.host, host)
        )
      )
      .limit(1);

    return (result as User) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return (result as User) ?? null;
  }

  async findByUri(uri: string): Promise<User | null> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(eq(users.uri, uri))
      .limit(1);

    return (result as User) ?? null;
  }

  async update(
    id: string,
    data: Partial<Omit<User, 'id' | 'createdAt'>>
  ): Promise<User> {
    const [result] = await this.db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!result) {
      throw new Error('User not found');
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
}
