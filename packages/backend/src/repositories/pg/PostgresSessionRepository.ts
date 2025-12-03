import { eq, lt } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { sessions } from "../../db/schema/pg.js";
import type { ISessionRepository } from "../../interfaces/repositories/ISessionRepository.js";
import type { Session } from "shared";

export class PostgresSessionRepository implements ISessionRepository {
  constructor(private db: Database) {}

  async create(session: Omit<Session, "createdAt" | "updatedAt">): Promise<Session> {
    const now = new Date();
    const [result] = await this.db
      .insert(sessions)
      .values({
        ...session,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create session");
    }

    return result as Session;
  }

  async findById(id: string): Promise<Session | null> {
    const [result] = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);

    return (result as Session) ?? null;
  }

  async findByToken(token: string): Promise<Session | null> {
    const [result] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);

    return (result as Session) ?? null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    const results = await this.db.select().from(sessions).where(eq(sessions.userId, userId));

    return results as Session[];
  }

  async updateExpiresAt(id: string, expiresAt: Date): Promise<Session> {
    const [result] = await this.db
      .update(sessions)
      .set({
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();

    if (!result) {
      throw new Error("Session not found");
    }

    return result as Session;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteByToken(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.token, token));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()))
      .returning({ id: sessions.id });

    return result.length;
  }
}
