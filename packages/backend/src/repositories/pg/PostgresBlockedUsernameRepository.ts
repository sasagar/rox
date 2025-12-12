/**
 * PostgreSQL implementation of Blocked Username Repository
 *
 * Provides data access for admin-configurable username restrictions.
 *
 * @module repositories/pg/PostgresBlockedUsernameRepository
 */

import { eq, desc } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { blockedUsernames, type BlockedUsername } from "../../db/schema/pg.js";
import type {
  IBlockedUsernameRepository,
  CreateBlockedUsernameInput,
} from "../../interfaces/repositories/IBlockedUsernameRepository.js";
import { generateId } from "shared";

/**
 * PostgreSQL implementation of Blocked Username Repository
 */
export class PostgresBlockedUsernameRepository implements IBlockedUsernameRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<BlockedUsername[]> {
    const results = await this.db
      .select()
      .from(blockedUsernames)
      .orderBy(desc(blockedUsernames.createdAt));

    return results;
  }

  async findById(id: string): Promise<BlockedUsername | null> {
    const [result] = await this.db
      .select()
      .from(blockedUsernames)
      .where(eq(blockedUsernames.id, id))
      .limit(1);

    return result ?? null;
  }

  async findByPattern(pattern: string): Promise<BlockedUsername | null> {
    const [result] = await this.db
      .select()
      .from(blockedUsernames)
      .where(eq(blockedUsernames.pattern, pattern))
      .limit(1);

    return result ?? null;
  }

  async create(input: CreateBlockedUsernameInput): Promise<BlockedUsername> {
    const id = generateId();
    const now = new Date();

    const [result] = await this.db
      .insert(blockedUsernames)
      .values({
        id,
        pattern: input.pattern,
        isRegex: input.isRegex ?? false,
        reason: input.reason ?? null,
        createdById: input.createdById ?? null,
        createdAt: now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create blocked username");
    }

    return result;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(blockedUsernames)
      .where(eq(blockedUsernames.id, id))
      .returning();

    return result.length > 0;
  }

  async findMatchingPattern(username: string): Promise<BlockedUsername | null> {
    const lowerUsername = username.toLowerCase();
    const patterns = await this.findAll();

    for (const pattern of patterns) {
      if (pattern.isRegex) {
        // Regex pattern matching
        try {
          const regex = new RegExp(pattern.pattern, "i");
          if (regex.test(lowerUsername)) {
            return pattern;
          }
        } catch {
          // Invalid regex, skip
          continue;
        }
      } else {
        // Exact match (case-insensitive)
        if (pattern.pattern.toLowerCase() === lowerUsername) {
          return pattern;
        }
      }
    }

    return null;
  }
}
