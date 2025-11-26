/**
 * Instance Settings Repository Interface
 *
 * Provides methods for managing instance-wide settings.
 *
 * @module interfaces/repositories/IInstanceSettingsRepository
 */

import type { InstanceSetting } from '../../db/schema/pg.js';

/**
 * Known instance setting keys
 */
export type InstanceSettingKey =
  | 'registration.enabled'
  | 'registration.inviteOnly'
  | 'registration.approvalRequired'
  | 'instance.name'
  | 'instance.description'
  | 'instance.maintainerEmail'
  | 'instance.iconUrl'
  | 'instance.bannerUrl'
  | 'instance.tosUrl'
  | 'instance.privacyPolicyUrl';

/**
 * Instance settings repository interface
 */
export interface IInstanceSettingsRepository {
  /**
   * Gets a setting value by key
   * @param key - Setting key
   * @returns Setting value or null if not found
   */
  get<T>(key: InstanceSettingKey): Promise<T | null>;

  /**
   * Sets a setting value
   * @param key - Setting key
   * @param value - Setting value
   * @param updatedById - ID of user who updated the setting
   * @returns Updated setting
   */
  set<T>(key: InstanceSettingKey, value: T, updatedById?: string): Promise<InstanceSetting>;

  /**
   * Gets multiple settings by keys
   * @param keys - Array of setting keys
   * @returns Map of key to value
   */
  getMany(keys: InstanceSettingKey[]): Promise<Map<InstanceSettingKey, unknown>>;

  /**
   * Gets all settings
   * @returns Array of all settings
   */
  getAll(): Promise<InstanceSetting[]>;

  /**
   * Gets all settings as a key-value object
   * @returns Object with setting keys and values
   */
  getAllAsObject(): Promise<Record<string, unknown>>;

  /**
   * Deletes a setting
   * @param key - Setting key
   * @returns True if deleted, false if not found
   */
  delete(key: InstanceSettingKey): Promise<boolean>;

  /**
   * Checks if a setting exists
   * @param key - Setting key
   * @returns True if setting exists
   */
  exists(key: InstanceSettingKey): Promise<boolean>;
}
