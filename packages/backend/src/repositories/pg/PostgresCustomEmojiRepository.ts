/**
 * PostgreSQL Custom Emoji Repository
 *
 * Implements ICustomEmojiRepository for PostgreSQL database.
 *
 * @module repositories/pg/PostgresCustomEmojiRepository
 */

import { eq, and, isNull, like, inArray, count } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { customEmojis, type CustomEmoji, type NewCustomEmoji } from "../../db/schema/pg.js";
import type {
  ICustomEmojiRepository,
  ListCustomEmojisOptions,
} from "../../interfaces/repositories/ICustomEmojiRepository.js";

/**
 * PostgreSQL implementation of Custom Emoji Repository
 */
export class PostgresCustomEmojiRepository implements ICustomEmojiRepository {
  constructor(private db: Database) {}

  async create(emoji: NewCustomEmoji): Promise<CustomEmoji> {
    const [result] = await this.db.insert(customEmojis).values(emoji).returning();

    if (!result) {
      throw new Error("Failed to create custom emoji");
    }

    return result;
  }

  async findById(id: string): Promise<CustomEmoji | null> {
    const [result] = await this.db
      .select()
      .from(customEmojis)
      .where(eq(customEmojis.id, id))
      .limit(1);

    return result ?? null;
  }

  async findByName(name: string, host?: string | null): Promise<CustomEmoji | null> {
    const conditions =
      host === null || host === undefined
        ? and(eq(customEmojis.name, name), isNull(customEmojis.host))
        : and(eq(customEmojis.name, name), eq(customEmojis.host, host));

    const [result] = await this.db.select().from(customEmojis).where(conditions).limit(1);

    return result ?? null;
  }

  async findByNameAnyHost(name: string): Promise<CustomEmoji | null> {
    // Find emoji by name from any host (remote emojis)
    // Returns the first matching emoji if multiple hosts have the same name
    const [result] = await this.db
      .select()
      .from(customEmojis)
      .where(eq(customEmojis.name, name))
      .limit(1);

    return result ?? null;
  }

  async findManyByNames(names: string[], host?: string | null): Promise<Map<string, CustomEmoji>> {
    if (names.length === 0) {
      return new Map();
    }

    const hostCondition =
      host === null || host === undefined ? isNull(customEmojis.host) : eq(customEmojis.host, host);

    const results = await this.db
      .select()
      .from(customEmojis)
      .where(and(inArray(customEmojis.name, names), hostCondition));

    const map = new Map<string, CustomEmoji>();
    for (const emoji of results) {
      map.set(emoji.name, emoji);
    }

    return map;
  }

  async list(options: ListCustomEmojisOptions = {}): Promise<CustomEmoji[]> {
    const { host, category, search, limit = 100, offset = 0, includeSensitive = false } = options;

    const conditions = [];

    // Host filter
    if (host === null) {
      conditions.push(isNull(customEmojis.host));
    } else if (host !== undefined) {
      conditions.push(eq(customEmojis.host, host));
    }

    // Category filter
    if (category) {
      conditions.push(eq(customEmojis.category, category));
    }

    // Search filter
    if (search) {
      conditions.push(like(customEmojis.name, `%${search}%`));
    }

    // Sensitive filter
    if (!includeSensitive) {
      conditions.push(eq(customEmojis.isSensitive, false));
    }

    const query = this.db
      .select()
      .from(customEmojis)
      .limit(limit)
      .offset(offset)
      .orderBy(customEmojis.category, customEmojis.name);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  async listLocal(): Promise<CustomEmoji[]> {
    return this.db
      .select()
      .from(customEmojis)
      .where(isNull(customEmojis.host))
      .orderBy(customEmojis.category, customEmojis.name);
  }

  async listCategories(): Promise<string[]> {
    const results = await this.db
      .selectDistinct({ category: customEmojis.category })
      .from(customEmojis)
      .where(isNull(customEmojis.host))
      .orderBy(customEmojis.category);

    return results.map((r) => r.category).filter((c): c is string => c !== null);
  }

  async update(id: string, updates: Partial<NewCustomEmoji>): Promise<CustomEmoji | null> {
    const [result] = await this.db
      .update(customEmojis)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(customEmojis.id, id))
      .returning();

    return result ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(customEmojis)
      .where(eq(customEmojis.id, id))
      .returning({ id: customEmojis.id });

    return result.length > 0;
  }

  async exists(name: string, host?: string | null): Promise<boolean> {
    const conditions =
      host === null || host === undefined
        ? and(eq(customEmojis.name, name), isNull(customEmojis.host))
        : and(eq(customEmojis.name, name), eq(customEmojis.host, host));

    const [result] = await this.db
      .select({ id: customEmojis.id })
      .from(customEmojis)
      .where(conditions)
      .limit(1);

    return result !== undefined;
  }

  async count(options: ListCustomEmojisOptions = {}): Promise<number> {
    const { host, category, search, includeSensitive = false } = options;

    const conditions = [];

    if (host === null) {
      conditions.push(isNull(customEmojis.host));
    } else if (host !== undefined) {
      conditions.push(eq(customEmojis.host, host));
    }

    if (category) {
      conditions.push(eq(customEmojis.category, category));
    }

    if (search) {
      conditions.push(like(customEmojis.name, `%${search}%`));
    }

    if (!includeSensitive) {
      conditions.push(eq(customEmojis.isSensitive, false));
    }

    const query = this.db.select({ count: count() }).from(customEmojis);

    const [result] = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

    return result?.count ?? 0;
  }
}
