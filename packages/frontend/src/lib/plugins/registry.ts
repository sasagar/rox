/**
 * Frontend Plugin Registry
 *
 * This module provides the central registry for frontend plugins.
 * It manages plugin registration, slot component lookup, and state.
 *
 * The registry uses Jotai atoms for reactive state management,
 * allowing components to re-render when plugins are added/removed.
 */

import { atom, useAtomValue, useSetAtom } from "jotai";
import type { ComponentType } from "react";
import type { PluginSlotName, SlotProps } from "./types.js";
import type {
  FrontendPlugin,
  LoadedFrontendPlugin,
  PluginLoadResult,
} from "./types.js";

/**
 * Internal storage for registered plugins
 */
const pluginsAtom = atom<Map<string, LoadedFrontendPlugin>>(new Map());

/**
 * Derived atom for plugin list
 */
export const pluginListAtom = atom((get) => {
  return Array.from(get(pluginsAtom).values());
});

/**
 * Derived atom for enabled plugins only
 */
export const enabledPluginsAtom = atom((get) => {
  return Array.from(get(pluginsAtom).values()).filter((p) => p.enabled);
});

/**
 * Slot component entry
 */
interface SlotComponentEntry<T extends PluginSlotName = PluginSlotName> {
  pluginId: string;
  component: ComponentType<SlotProps[T]>;
}

/**
 * Atom for slot components lookup
 * Maps slot names to arrays of registered components
 */
const slotComponentsAtom = atom((get) => {
  const plugins = get(enabledPluginsAtom);
  const slotMap = new Map<PluginSlotName, SlotComponentEntry[]>();

  for (const plugin of plugins) {
    if (!plugin.slots) continue;

    for (const [slotName, component] of Object.entries(plugin.slots)) {
      if (!component) continue;

      const slot = slotName as PluginSlotName;
      const existing = slotMap.get(slot) || [];
      existing.push({
        pluginId: plugin.id,
        component: component as ComponentType<SlotProps[typeof slot]>,
      });
      slotMap.set(slot, existing);
    }
  }

  return slotMap;
});

/**
 * Hook to get components registered for a specific slot
 */
export function usePluginSlotComponents<T extends PluginSlotName>(
  slot: T
): SlotComponentEntry<T>[] {
  const slotComponents = useAtomValue(slotComponentsAtom);
  return (slotComponents.get(slot) || []) as SlotComponentEntry<T>[];
}

/**
 * Hook to get all registered plugins
 */
export function usePlugins(): LoadedFrontendPlugin[] {
  return useAtomValue(pluginListAtom);
}

/**
 * Hook to get enabled plugins only
 */
export function useEnabledPlugins(): LoadedFrontendPlugin[] {
  return useAtomValue(enabledPluginsAtom);
}

/**
 * Hook to check if any plugins are registered for a slot
 */
export function useHasSlotPlugins(slot: PluginSlotName): boolean {
  const components = usePluginSlotComponents(slot);
  return components.length > 0;
}

/**
 * Plugin Registry class for managing frontend plugins
 */
class FrontendPluginRegistry {
  private plugins: Map<string, LoadedFrontendPlugin> = new Map();
  private updateCallback: ((plugins: Map<string, LoadedFrontendPlugin>) => void) | null = null;

  /**
   * Set the callback to update Jotai atom state
   */
  setUpdateCallback(callback: (plugins: Map<string, LoadedFrontendPlugin>) => void) {
    this.updateCallback = callback;
    // Sync current state
    callback(new Map(this.plugins));
  }

  /**
   * Register a frontend plugin
   */
  async register(plugin: FrontendPlugin): Promise<PluginLoadResult> {
    try {
      // Check for duplicate
      if (this.plugins.has(plugin.id)) {
        return {
          id: plugin.id,
          success: false,
          error: `Plugin ${plugin.id} is already registered`,
        };
      }

      // Call onLoad if defined
      if (plugin.onLoad) {
        await plugin.onLoad();
      }

      // Store as loaded plugin
      const loadedPlugin: LoadedFrontendPlugin = {
        ...plugin,
        enabled: true,
      };

      this.plugins.set(plugin.id, loadedPlugin);
      this.notifyUpdate();

      return { id: plugin.id, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        id: plugin.id,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Unregister a frontend plugin
   */
  async unregister(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    try {
      // Call onUnload if defined
      if (plugin.onUnload) {
        await plugin.onUnload();
      }
    } catch {
      // Log but continue with unregistration
      console.error(`Error unloading plugin ${pluginId}`);
    }

    this.plugins.delete(pluginId);
    this.notifyUpdate();
    return true;
  }

  /**
   * Enable a plugin
   */
  enable(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    plugin.enabled = true;
    this.plugins.set(pluginId, plugin);
    this.notifyUpdate();
    return true;
  }

  /**
   * Disable a plugin
   */
  disable(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    plugin.enabled = false;
    this.plugins.set(pluginId, plugin);
    this.notifyUpdate();
    return true;
  }

  /**
   * Get a specific plugin by ID
   */
  getPlugin(pluginId: string): LoadedFrontendPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): LoadedFrontendPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get enabled plugins only
   */
  getEnabledPlugins(): LoadedFrontendPlugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.enabled);
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Clear all plugins (mainly for testing)
   */
  clear() {
    this.plugins.clear();
    this.notifyUpdate();
  }

  private notifyUpdate() {
    if (this.updateCallback) {
      this.updateCallback(new Map(this.plugins));
    }
  }
}

/**
 * Singleton registry instance
 */
export const pluginRegistry = new FrontendPluginRegistry();

/**
 * Hook to get registry mutation functions
 */
export function usePluginRegistry() {
  const setPlugins = useSetAtom(pluginsAtom);

  // Connect registry to atom on first use
  if (!pluginRegistry["updateCallback"]) {
    pluginRegistry.setUpdateCallback(setPlugins);
  }

  return {
    register: (plugin: FrontendPlugin) => pluginRegistry.register(plugin),
    unregister: (pluginId: string) => pluginRegistry.unregister(pluginId),
    enable: (pluginId: string) => pluginRegistry.enable(pluginId),
    disable: (pluginId: string) => pluginRegistry.disable(pluginId),
    getPlugin: (pluginId: string) => pluginRegistry.getPlugin(pluginId),
  };
}
