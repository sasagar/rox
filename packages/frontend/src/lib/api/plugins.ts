/**
 * Plugin Management API Client
 *
 * Provides methods for managing plugins via the admin API.
 *
 * @module lib/api/plugins
 */

import { apiClient } from "./client";
import type { PluginListEntry, InstalledPlugin } from "shared";

/**
 * Response from listing plugins
 */
export interface PluginListResponse {
  plugins: PluginListEntry[];
  total: number;
}

/**
 * Response from plugin actions (enable, disable, install, uninstall)
 */
export interface PluginActionResponse {
  success: boolean;
  message?: string;
  requiresRestart?: boolean;
  pluginId?: string;
  version?: string;
  warnings?: string[];
  error?: string;
}

/**
 * Request body for installing a plugin
 */
export interface InstallPluginRequest {
  source: string;
  force?: boolean;
}

/**
 * Plugin configuration object
 */
export type PluginConfig = Record<string, unknown>;

/**
 * Plugin API client for admin operations
 */
export const pluginApi = {
  /**
   * List all installed plugins
   *
   * @returns List of plugins with metadata
   */
  async list(): Promise<PluginListResponse> {
    return apiClient.get<PluginListResponse>("/api/admin/plugins");
  },

  /**
   * Get details of a specific plugin
   *
   * @param id - Plugin ID
   * @returns Plugin details
   */
  async get(id: string): Promise<InstalledPlugin> {
    return apiClient.get<InstalledPlugin>(`/api/admin/plugins/${encodeURIComponent(id)}`);
  },

  /**
   * Enable a plugin
   *
   * @param id - Plugin ID
   * @returns Action result
   */
  async enable(id: string): Promise<PluginActionResponse> {
    return apiClient.post<PluginActionResponse>(
      `/api/admin/plugins/${encodeURIComponent(id)}/enable`
    );
  },

  /**
   * Disable a plugin
   *
   * @param id - Plugin ID
   * @returns Action result
   */
  async disable(id: string): Promise<PluginActionResponse> {
    return apiClient.post<PluginActionResponse>(
      `/api/admin/plugins/${encodeURIComponent(id)}/disable`
    );
  },

  /**
   * Install a plugin from a source (Git URL or local path)
   *
   * @param source - Plugin source (Git URL or local path)
   * @param force - Force installation even if already installed
   * @returns Action result with plugin info
   */
  async install(source: string, force?: boolean): Promise<PluginActionResponse> {
    return apiClient.post<PluginActionResponse>("/api/admin/plugins/install", {
      source,
      force,
    });
  },

  /**
   * Uninstall a plugin
   *
   * @param id - Plugin ID
   * @param keepFiles - Keep plugin files on disk
   * @returns Action result
   */
  async uninstall(id: string, keepFiles?: boolean): Promise<PluginActionResponse> {
    const query = keepFiles ? "?keepFiles=true" : "";
    return apiClient.delete<PluginActionResponse>(
      `/api/admin/plugins/${encodeURIComponent(id)}${query}`
    );
  },

  /**
   * Get plugin configuration
   *
   * @param id - Plugin ID
   * @returns Plugin configuration object
   */
  async getConfig(id: string): Promise<PluginConfig> {
    return apiClient.get<PluginConfig>(
      `/api/admin/plugins/${encodeURIComponent(id)}/config`
    );
  },

  /**
   * Update plugin configuration
   *
   * @param id - Plugin ID
   * @param config - New configuration
   * @returns Action result with updated config
   */
  async setConfig(
    id: string,
    config: PluginConfig
  ): Promise<PluginActionResponse & { config?: PluginConfig }> {
    return apiClient.put<PluginActionResponse & { config?: PluginConfig }>(
      `/api/admin/plugins/${encodeURIComponent(id)}/config`,
      config
    );
  },
};
