/**
 * Frontend Plugin Types
 *
 * This file defines the types for frontend plugins in Rox.
 * Plugins can inject components into slots, add custom pages,
 * manage state with Jotai atoms, and provide i18n messages.
 */

import type { ComponentType } from "react";
import type { Atom, WritableAtom } from "jotai";
import type { PluginSlotName } from "./slots.js";

// Re-export PluginSlotName for convenience
export type { PluginSlotName } from "./slots.js";

/**
 * Props passed to slot components.
 * Different slots may receive different contextual props.
 */
export interface SlotProps {
  // Note slots receive note data
  "note:header": NoteSlotProps;
  "note:footer": NoteSlotProps;
  "note:actions": NoteSlotProps;

  // Compose slots receive composer context
  "compose:toolbar": ComposeSlotProps;
  "compose:footer": ComposeSlotProps;

  // Profile slots receive user data
  "profile:header": ProfileSlotProps;
  "profile:tabs": ProfileSlotProps;

  // Settings slots receive minimal props
  "settings:tabs": SettingsSlotProps;

  // Admin slots receive admin context
  "admin:sidebar": AdminSlotProps;
  "admin:dashboard": AdminSlotProps;

  // Navigation slots
  "sidebar:bottom": SidebarSlotProps;
}

/**
 * Base props for all slot components
 */
export interface BaseSlotProps {
  /** The plugin ID that registered this component */
  pluginId: string;
}

/**
 * Props for note-related slots
 */
export interface NoteSlotProps extends BaseSlotProps {
  noteId: string;
  userId: string;
  visibility?: string;
}

/**
 * Props for compose-related slots
 */
export interface ComposeSlotProps extends BaseSlotProps {
  /** Current text in the composer */
  text: string;
  /** Callback to insert text at cursor */
  insertText?: (text: string) => void;
  /** Reply target note ID, if any */
  replyToId?: string;
}

/**
 * Props for profile-related slots
 */
export interface ProfileSlotProps extends BaseSlotProps {
  userId: string;
  username: string;
  isOwnProfile: boolean;
}

/**
 * Props for settings-related slots
 */
export interface SettingsSlotProps extends BaseSlotProps {
  /** Current user ID */
  userId: string;
}

/**
 * Props for admin-related slots
 */
export interface AdminSlotProps extends BaseSlotProps {
  /** Whether the user has full admin privileges */
  isAdmin: boolean;
}

/**
 * Props for sidebar-related slots
 */
export interface SidebarSlotProps extends BaseSlotProps {
  /** Whether the sidebar is collapsed */
  isCollapsed: boolean;
}

/**
 * Custom page definition for plugins
 */
export interface PluginPage {
  /** URL path for the page (e.g., "/x/my-plugin/settings") */
  path: string;
  /** Page component */
  component: ComponentType;
  /** Page title for navigation/SEO */
  title?: string;
  /** Whether authentication is required */
  requiresAuth?: boolean;
}

/**
 * I18n messages definition
 * Keys are language codes, values are message dictionaries
 */
export type PluginMessages = Record<string, Record<string, string>>;

/**
 * Frontend Plugin Definition
 *
 * Plugins can extend the Rox frontend in several ways:
 * - Inject components into predefined slots
 * - Add custom pages/routes
 * - Manage state with Jotai atoms
 * - Provide i18n messages
 */
export interface FrontendPlugin {
  /** Unique plugin identifier (must match backend plugin ID) */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Plugin version */
  version: string;

  /** Plugin description */
  description?: string;

  /**
   * Components to inject into slots
   * Keys are slot names, values are React components
   */
  slots?: {
    [K in PluginSlotName]?: ComponentType<SlotProps[K]>;
  };

  /**
   * Custom pages/routes added by the plugin
   * Routes will be mounted under /x/{pluginId}/
   */
  pages?: PluginPage[];

  /**
   * Jotai atoms for plugin state management
   * Atoms are accessible via the plugin registry
   */
  atoms?: Record<string, Atom<unknown> | WritableAtom<unknown, unknown[], unknown>>;

  /**
   * I18n messages for the plugin
   * Will be merged with the main message catalog
   */
  messages?: PluginMessages;

  /**
   * Initialization function called when plugin loads
   * Can be used to set up side effects, subscriptions, etc.
   */
  onLoad?: () => void | Promise<void>;

  /**
   * Cleanup function called when plugin unloads
   */
  onUnload?: () => void | Promise<void>;
}

/**
 * Loaded plugin with additional runtime state
 */
export interface LoadedFrontendPlugin extends FrontendPlugin {
  /** Whether the plugin is currently enabled */
  enabled: boolean;
  /** Loading error, if any */
  error?: string;
}

/**
 * Result of loading a frontend plugin
 */
export interface PluginLoadResult {
  /** Plugin ID */
  id: string;
  /** Whether loading succeeded */
  success: boolean;
  /** Error message if loading failed */
  error?: string;
}
