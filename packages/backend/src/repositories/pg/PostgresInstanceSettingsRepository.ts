/**
 * PostgreSQL Instance Settings Repository
 *
 * Implements IInstanceSettingsRepository for PostgreSQL database.
 *
 * @module repositories/pg/PostgresInstanceSettingsRepository
 */

import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { instanceSettings, type InstanceSetting } from '../../db/schema/pg.js';
import type {
  IInstanceSettingsRepository,
  InstanceSettingKey,
} from '../../interfaces/repositories/IInstanceSettingsRepository.js';

/**
 * PostgreSQL implementation of Instance Settings Repository
 */
export class PostgresInstanceSettingsRepository implements IInstanceSettingsRepository {
  constructor(private db: Database) {}

  async get<T>(key: InstanceSettingKey): Promise<T | null> {
    const [result] = await this.db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.key, key))
      .limit(1);

    if (!result) {
      return null;
    }

    return result.value as T;
  }

  async set<T>(key: InstanceSettingKey, value: T, updatedById?: string): Promise<InstanceSetting> {
    const [result] = await this.db
      .insert(instanceSettings)
      .values({
        key,
        value: value as unknown as Record<string, unknown>,
        updatedAt: new Date(),
        updatedById: updatedById ?? null,
      })
      .onConflictDoUpdate({
        target: instanceSettings.key,
        set: {
          value: value as unknown as Record<string, unknown>,
          updatedAt: new Date(),
          updatedById: updatedById ?? null,
        },
      })
      .returning();

    if (!result) {
      throw new Error('Failed to set instance setting');
    }

    return result;
  }

  async getMany(keys: InstanceSettingKey[]): Promise<Map<InstanceSettingKey, unknown>> {
    const results = await this.db
      .select()
      .from(instanceSettings)
      .where(inArray(instanceSettings.key, keys));

    const map = new Map<InstanceSettingKey, unknown>();
    for (const result of results) {
      map.set(result.key as InstanceSettingKey, result.value);
    }

    return map;
  }

  async getAll(): Promise<InstanceSetting[]> {
    return this.db.select().from(instanceSettings);
  }

  async getAllAsObject(): Promise<Record<string, unknown>> {
    const results = await this.db.select().from(instanceSettings);

    const obj: Record<string, unknown> = {};
    for (const result of results) {
      obj[result.key] = result.value;
    }

    return obj;
  }

  async delete(key: InstanceSettingKey): Promise<boolean> {
    const result = await this.db
      .delete(instanceSettings)
      .where(eq(instanceSettings.key, key))
      .returning({ key: instanceSettings.key });

    return result.length > 0;
  }

  async exists(key: InstanceSettingKey): Promise<boolean> {
    const [result] = await this.db
      .select({ key: instanceSettings.key })
      .from(instanceSettings)
      .where(eq(instanceSettings.key, key))
      .limit(1);

    return result !== undefined;
  }
}
