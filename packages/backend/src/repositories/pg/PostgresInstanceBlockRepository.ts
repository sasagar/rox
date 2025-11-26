import { eq, sql, desc } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { instanceBlocks, type InstanceBlock } from '../../db/schema/pg.js';
import type { IInstanceBlockRepository } from '../../interfaces/repositories/IInstanceBlockRepository.js';
import { generateId } from 'shared';

/**
 * PostgreSQL implementation of Instance Block Repository
 */
export class PostgresInstanceBlockRepository implements IInstanceBlockRepository {
  constructor(private db: Database) {}

  async create(
    block: Omit<InstanceBlock, 'id' | 'createdAt'>
  ): Promise<InstanceBlock> {
    const id = generateId();
    const now = new Date();

    const [result] = await this.db
      .insert(instanceBlocks)
      .values({
        id,
        ...block,
        createdAt: now,
      })
      .returning();

    if (!result) {
      throw new Error('Failed to create instance block');
    }

    return result;
  }

  async findByHost(host: string): Promise<InstanceBlock | null> {
    const [result] = await this.db
      .select()
      .from(instanceBlocks)
      .where(eq(instanceBlocks.host, host.toLowerCase()))
      .limit(1);

    return result ?? null;
  }

  async isBlocked(host: string): Promise<boolean> {
    const result = await this.findByHost(host.toLowerCase());
    return result !== null;
  }

  async findAll(limit = 100, offset = 0): Promise<InstanceBlock[]> {
    const results = await this.db
      .select()
      .from(instanceBlocks)
      .orderBy(desc(instanceBlocks.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  async deleteByHost(host: string): Promise<boolean> {
    const result = await this.db
      .delete(instanceBlocks)
      .where(eq(instanceBlocks.host, host.toLowerCase()))
      .returning();

    return result.length > 0;
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(instanceBlocks);

    return result?.count ?? 0;
  }
}
