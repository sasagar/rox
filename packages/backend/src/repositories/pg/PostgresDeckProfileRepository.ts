/**
 * PostgreSQL Deck Profile Repository
 *
 * PostgreSQL implementation of the IDeckProfileRepository interface.
 * Handles user deck layouts for the multi-column view.
 *
 * @module repositories/pg/PostgresDeckProfileRepository
 */

import { eq, and, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { deckProfiles } from "../../db/schema/pg.js";
import type { IDeckProfileRepository } from "../../interfaces/repositories/IDeckProfileRepository.js";
import type { DeckProfile, DeckColumn } from "shared";

export class PostgresDeckProfileRepository implements IDeckProfileRepository {
  constructor(private db: Database) {}

  async create(profile: Omit<DeckProfile, "createdAt" | "updatedAt">): Promise<DeckProfile> {
    const now = new Date();

    // Use transaction to atomically clear defaults and insert new profile
    return await this.db.transaction(async (tx) => {
      // If setting as default, clear other defaults first
      if (profile.isDefault) {
        await tx
          .update(deckProfiles)
          .set({ isDefault: false })
          .where(eq(deckProfiles.userId, profile.userId));
      }

      const [result] = await tx
        .insert(deckProfiles)
        .values({
          ...profile,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!result) {
        throw new Error("Failed to create deck profile");
      }

      return this.toSharedProfile(result);
    });
  }

  async findById(id: string): Promise<DeckProfile | null> {
    const [result] = await this.db
      .select()
      .from(deckProfiles)
      .where(eq(deckProfiles.id, id))
      .limit(1);

    return result ? this.toSharedProfile(result) : null;
  }

  async findByUserId(userId: string): Promise<DeckProfile[]> {
    const results = await this.db
      .select()
      .from(deckProfiles)
      .where(eq(deckProfiles.userId, userId))
      .orderBy(deckProfiles.createdAt);

    return results.map((r) => this.toSharedProfile(r));
  }

  async findDefaultByUserId(userId: string): Promise<DeckProfile | null> {
    const [result] = await this.db
      .select()
      .from(deckProfiles)
      .where(and(eq(deckProfiles.userId, userId), eq(deckProfiles.isDefault, true)))
      .limit(1);

    return result ? this.toSharedProfile(result) : null;
  }

  async existsByUserIdAndName(userId: string, name: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: deckProfiles.id })
      .from(deckProfiles)
      .where(and(eq(deckProfiles.userId, userId), eq(deckProfiles.name, name)))
      .limit(1);

    return result !== undefined;
  }

  async update(
    id: string,
    data: Partial<Pick<DeckProfile, "name" | "columns" | "isDefault">>,
  ): Promise<DeckProfile> {
    // Use transaction to atomically clear defaults and update profile
    return await this.db.transaction(async (tx) => {
      // If setting as default, get the profile's userId first and clear other defaults
      if (data.isDefault) {
        const [profile] = await tx
          .select({ userId: deckProfiles.userId })
          .from(deckProfiles)
          .where(eq(deckProfiles.id, id))
          .limit(1);

        if (profile) {
          await tx
            .update(deckProfiles)
            .set({ isDefault: false })
            .where(eq(deckProfiles.userId, profile.userId));
        }
      }

      const [result] = await tx
        .update(deckProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(deckProfiles.id, id))
        .returning();

      if (!result) {
        throw new Error("Failed to update deck profile");
      }

      return this.toSharedProfile(result);
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(deckProfiles).where(eq(deckProfiles.id, id));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(deckProfiles).where(eq(deckProfiles.userId, userId));
  }

  async clearDefaultForUser(userId: string): Promise<void> {
    await this.db
      .update(deckProfiles)
      .set({ isDefault: false })
      .where(eq(deckProfiles.userId, userId));
  }

  async countByUserId(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(deckProfiles)
      .where(eq(deckProfiles.userId, userId));

    return result?.count ?? 0;
  }

  /**
   * Convert database row to shared DeckProfile type
   */
  private toSharedProfile(row: typeof deckProfiles.$inferSelect): DeckProfile {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      columns: Array.isArray(row.columns) ? (row.columns as DeckColumn[]) : [],
      isDefault: row.isDefault,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
