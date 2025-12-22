/**
 * Plugin Manager
 *
 * Manages plugin installation, uninstallation, and listing.
 * Handles Git-based plugin installation and local plugin management.
 */

import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type {
  PluginManifest,
  InstalledPlugin,
  PluginSource,
  PluginInstallOptions,
  PluginInstallResult,
  PluginListEntry,
} from "shared";
import { isValidPluginId } from "shared";
import { parseManifest } from "./ManifestValidator.js";

/**
 * Installed plugins registry file
 */
const REGISTRY_FILE = "plugins.json";

/**
 * Plugin Manager for handling plugin lifecycle
 */
export class PluginManager {
  private pluginDir: string;
  private registryPath: string;
  private installedPlugins: Map<string, InstalledPlugin>;

  constructor(pluginDirectory: string = "./plugins") {
    this.pluginDir = resolve(pluginDirectory);
    this.registryPath = join(this.pluginDir, REGISTRY_FILE);
    this.installedPlugins = new Map();
    this.loadRegistry();
  }

  /**
   * Load installed plugins registry from disk
   */
  private loadRegistry(): void {
    try {
      if (existsSync(this.registryPath)) {
        const data = readFileSync(this.registryPath, "utf-8");
        const plugins = JSON.parse(data) as InstalledPlugin[];
        for (const plugin of plugins) {
          // Validate plugin ID to prevent loading corrupted registry entries
          if (!isValidPluginId(plugin.id)) {
            console.error(`Skipping plugin with invalid id in registry: ${plugin.id}`);
            continue;
          }
          this.installedPlugins.set(plugin.id, plugin);
        }
      }
    } catch (error) {
      console.error("Failed to load plugin registry:", error);
    }
  }

  /**
   * Save installed plugins registry to disk
   *
   * @returns true if save was successful, false otherwise
   */
  private saveRegistry(): boolean {
    try {
      const plugins = Array.from(this.installedPlugins.values());
      writeFileSync(this.registryPath, JSON.stringify(plugins, null, 2));
      return true;
    } catch (error) {
      console.error("Failed to save plugin registry:", error);
      return false;
    }
  }

  /**
   * Install a plugin from a source
   */
  async install(
    source: PluginSource,
    options: PluginInstallOptions = {}
  ): Promise<PluginInstallResult> {
    const warnings: string[] = [];

    try {
      let manifest: PluginManifest;

      switch (source.type) {
        case "git": {
          const gitResult = await this.installFromGit(source.url, source.ref, options);
          if (!gitResult.success) {
            return gitResult;
          }
          manifest = gitResult.manifest!;
          break;
        }

        case "local": {
          const localResult = await this.installFromLocal(source.path, options);
          if (!localResult.success) {
            return localResult;
          }
          manifest = localResult.manifest!;
          break;
        }

        case "registry":
          // Registry installation will be implemented when the official registry is available
          return {
            success: false,
            error: "Registry installation is not yet available. Please use Git URL or local path.",
          };

        default:
          return {
            success: false,
            error: "Unknown source type",
          };
      }

      // Validate plugin ID format
      if (!isValidPluginId(manifest.id)) {
        return {
          success: false,
          error: `Invalid plugin id: ${manifest.id}`,
        };
      }

      // Check if already installed
      if (this.installedPlugins.has(manifest.id) && !options.force) {
        return {
          success: false,
          error: `Plugin ${manifest.id} is already installed. Use --force to reinstall.`,
        };
      }

      // Check dependencies
      if (!options.skipDependencies && manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          if (!this.installedPlugins.has(dep)) {
            warnings.push(`Missing dependency: ${dep}`);
          }
        }
      }

      // Determine source string for storage
      // At this point, source.type is either "git" or "local" (registry returns early)
      const sourceString = source.type === "git" ? source.url : source.path;

      // Register the plugin
      const installedPlugin: InstalledPlugin = {
        ...manifest,
        installedAt: new Date().toISOString(),
        source: sourceString,
        enabled: options.enable ?? true,
      };

      this.installedPlugins.set(manifest.id, installedPlugin);

      if (!this.saveRegistry()) {
        // Rollback in-memory state if save failed
        this.installedPlugins.delete(manifest.id);
        return {
          success: false,
          error: "Failed to persist plugin registry to disk",
        };
      }

      return {
        success: true,
        pluginId: manifest.id,
        version: manifest.version,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Install plugin from Git repository
   */
  private async installFromGit(
    url: string,
    ref?: string,
    options: PluginInstallOptions = {}
  ): Promise<{ success: boolean; error?: string; path?: string; manifest?: PluginManifest }> {
    // Extract repo name from URL
    const repoName = this.extractRepoName(url);
    if (!repoName) {
      return { success: false, error: "Invalid Git URL" };
    }

    const targetDir = join(options.directory || this.pluginDir, repoName);

    // Check if directory exists
    if (existsSync(targetDir)) {
      if (options.force) {
        rmSync(targetDir, { recursive: true, force: true });
      } else {
        return {
          success: false,
          error: `Directory ${targetDir} already exists. Use --force to overwrite.`,
        };
      }
    }

    try {
      // Clone the repository using execFileSync to prevent command injection
      // Arguments are passed as an array, avoiding shell interpretation
      const args = ["clone", "--depth", "1"];
      if (ref) {
        args.push("--branch", ref);
      }
      args.push(url, targetDir);

      execFileSync("git", args, { stdio: "pipe" });

      // Read and validate manifest
      const manifestPath = join(targetDir, "plugin.json");
      if (!existsSync(manifestPath)) {
        rmSync(targetDir, { recursive: true, force: true });
        return { success: false, error: "plugin.json not found in repository" };
      }

      const manifestContent = readFileSync(manifestPath, "utf-8");
      const { manifest, validation } = parseManifest(manifestContent);

      if (!validation.valid) {
        rmSync(targetDir, { recursive: true, force: true });
        const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join("; ");
        return { success: false, error: `Invalid manifest: ${errorMessages}` };
      }

      // Remove .git directory to save space
      const gitDir = join(targetDir, ".git");
      if (existsSync(gitDir)) {
        rmSync(gitDir, { recursive: true, force: true });
      }

      return { success: true, path: targetDir, manifest: manifest! };
    } catch (error) {
      // Cleanup on failure
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
      }
      return {
        success: false,
        error: `Git clone failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Install plugin from local path
   */
  private async installFromLocal(
    sourcePath: string,
    _options: PluginInstallOptions = {}
  ): Promise<{ success: boolean; error?: string; path?: string; manifest?: PluginManifest }> {
    const resolvedPath = resolve(sourcePath);

    if (!existsSync(resolvedPath)) {
      return { success: false, error: `Path not found: ${sourcePath}` };
    }

    // Read and validate manifest
    const manifestPath = join(resolvedPath, "plugin.json");
    if (!existsSync(manifestPath)) {
      return { success: false, error: "plugin.json not found" };
    }

    const manifestContent = readFileSync(manifestPath, "utf-8");
    const { manifest, validation } = parseManifest(manifestContent);

    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join("; ");
      return { success: false, error: `Invalid manifest: ${errorMessages}` };
    }

    return { success: true, path: resolvedPath, manifest: manifest! };
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(pluginId: string, options: { keepFiles?: boolean } = {}): Promise<boolean> {
    if (!isValidPluginId(pluginId)) {
      console.error(`Invalid plugin ID: ${pluginId}`);
      return false;
    }

    const plugin = this.installedPlugins.get(pluginId);
    if (!plugin) {
      console.error(`Plugin not found: ${pluginId}`);
      return false;
    }

    // Remove files if requested
    if (!options.keepFiles) {
      const pluginPath = join(this.pluginDir, pluginId);
      if (existsSync(pluginPath)) {
        try {
          rmSync(pluginPath, { recursive: true, force: true });
        } catch (error) {
          console.error(`Failed to remove plugin files: ${error}`);
        }
      }
    }

    // Remove from registry
    const previousPlugin = this.installedPlugins.get(pluginId);
    this.installedPlugins.delete(pluginId);

    if (!this.saveRegistry()) {
      // Rollback if save failed
      if (previousPlugin) {
        this.installedPlugins.set(pluginId, previousPlugin);
      }
      console.error("Failed to persist plugin registry after uninstall");
      return false;
    }

    return true;
  }

  /**
   * Enable a plugin
   */
  enable(pluginId: string): boolean {
    const plugin = this.installedPlugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    const wasEnabled = plugin.enabled;
    plugin.enabled = true;
    this.installedPlugins.set(pluginId, plugin);

    if (!this.saveRegistry()) {
      // Rollback if save failed
      plugin.enabled = wasEnabled;
      this.installedPlugins.set(pluginId, plugin);
      return false;
    }

    return true;
  }

  /**
   * Disable a plugin
   */
  disable(pluginId: string): boolean {
    const plugin = this.installedPlugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    const wasEnabled = plugin.enabled;
    plugin.enabled = false;
    this.installedPlugins.set(pluginId, plugin);

    if (!this.saveRegistry()) {
      // Rollback if save failed
      plugin.enabled = wasEnabled;
      this.installedPlugins.set(pluginId, plugin);
      return false;
    }

    return true;
  }

  /**
   * List all installed plugins
   */
  list(): PluginListEntry[] {
    return Array.from(this.installedPlugins.values()).map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      enabled: plugin.enabled,
      hasBackend: !!plugin.backend,
      hasFrontend: !!plugin.frontend,
      source: plugin.source,
    }));
  }

  /**
   * Get a specific installed plugin
   */
  getPlugin(pluginId: string): InstalledPlugin | undefined {
    return this.installedPlugins.get(pluginId);
  }

  /**
   * Check if a plugin is installed
   */
  isInstalled(pluginId: string): boolean {
    return this.installedPlugins.has(pluginId);
  }

  /**
   * Get the plugin directory path
   */
  getPluginPath(pluginId: string): string | undefined {
    if (!this.installedPlugins.has(pluginId)) {
      return undefined;
    }
    return join(this.pluginDir, pluginId);
  }

  /**
   * Get plugin configuration
   */
  getPluginConfig(pluginId: string): Record<string, unknown> {
    // Validate plugin ID to prevent path traversal attacks
    if (!isValidPluginId(pluginId)) {
      console.error(`Invalid plugin ID: ${pluginId}`);
      return {};
    }

    const configPath = join(this.pluginDir, pluginId, "config.json");
    try {
      if (existsSync(configPath)) {
        const data = readFileSync(configPath, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Failed to read plugin config for ${pluginId}:`, error);
    }
    return {};
  }

  /**
   * Set plugin configuration
   */
  setPluginConfig(pluginId: string, config: Record<string, unknown>): boolean {
    // Validate plugin ID to prevent path traversal attacks
    if (!isValidPluginId(pluginId)) {
      console.error(`Invalid plugin ID: ${pluginId}`);
      return false;
    }

    const pluginPath = join(this.pluginDir, pluginId);
    if (!existsSync(pluginPath)) {
      return false;
    }

    const configPath = join(pluginPath, "config.json");
    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error(`Failed to write plugin config for ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Extract repository name from Git URL
   */
  private extractRepoName(url: string): string | null {
    // Handle various Git URL formats:
    // https://github.com/user/repo.git
    // https://github.com/user/repo
    // git@github.com:user/repo.git
    const match = url.match(/\/([^/]+?)(\.git)?$/);
    return match?.[1] ?? null;
  }

  /**
   * Initialize plugin directory
   */
  static initPluginDirectory(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }
}
