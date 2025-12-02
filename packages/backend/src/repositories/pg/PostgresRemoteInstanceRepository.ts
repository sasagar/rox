import { eq, lt, inArray, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { remoteInstances } from "../../db/schema/pg.js";
import type { IRemoteInstanceRepository } from "../../interfaces/repositories/IRemoteInstanceRepository.js";
import type { RemoteInstance } from "shared";

export class PostgresRemoteInstanceRepository implements IRemoteInstanceRepository {
  constructor(private db: Database) {}

  async findByHost(host: string): Promise<RemoteInstance | null> {
    const [result] = await this.db
      .select()
      .from(remoteInstances)
      .where(eq(remoteInstances.host, host))
      .limit(1);

    return (result as RemoteInstance) ?? null;
  }

  async findByHosts(hosts: string[]): Promise<RemoteInstance[]> {
    if (hosts.length === 0) return [];

    const results = await this.db
      .select()
      .from(remoteInstances)
      .where(inArray(remoteInstances.host, hosts));

    return results as RemoteInstance[];
  }

  async upsert(instance: Partial<RemoteInstance> & { host: string }): Promise<RemoteInstance> {
    const now = new Date();

    const [result] = await this.db
      .insert(remoteInstances)
      .values({
        ...instance,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: remoteInstances.host,
        set: {
          ...instance,
          updatedAt: now,
        },
      })
      .returning();

    if (!result) {
      throw new Error("Failed to upsert remote instance");
    }

    return result as RemoteInstance;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<RemoteInstance[]> {
    const results = await this.db
      .select()
      .from(remoteInstances)
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);

    return results as RemoteInstance[];
  }

  async findStale(olderThan: Date, limit = 100): Promise<RemoteInstance[]> {
    const results = await this.db
      .select()
      .from(remoteInstances)
      .where(lt(remoteInstances.lastFetchedAt, olderThan))
      .limit(limit);

    return results as RemoteInstance[];
  }

  async incrementErrorCount(host: string): Promise<void> {
    await this.db
      .update(remoteInstances)
      .set({
        fetchErrorCount: sql`${remoteInstances.fetchErrorCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(remoteInstances.host, host));
  }

  async resetErrorCount(host: string): Promise<void> {
    await this.db
      .update(remoteInstances)
      .set({
        fetchErrorCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(remoteInstances.host, host));
  }

  async delete(host: string): Promise<void> {
    await this.db.delete(remoteInstances).where(eq(remoteInstances.host, host));
  }
}
