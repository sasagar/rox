/**
 * Plugin Slot Definitions
 *
 * This file defines the available slots where plugins can inject React components.
 * Each slot has a unique key and a description of its location in the UI.
 *
 * @example
 * // Plugin registering a component in a slot
 * const myPlugin: FrontendPlugin = {
 *   id: 'my-plugin',
 *   slots: {
 *     'note:footer': MyNoteFooterComponent,
 *   },
 * };
 */

/**
 * Available plugin slots in the Rox frontend.
 * Keys represent the slot identifier, values describe the location.
 */
export const PLUGIN_SLOTS = {
  // Note display
  "note:header": "Before note header content",
  "note:footer": "After note content, before reactions",
  "note:actions": "Additional note action buttons",

  // Compose
  "compose:toolbar": "Additional compose toolbar items",
  "compose:footer": "Below compose textarea",

  // User profile
  "profile:header": "Additional profile header content",
  "profile:tabs": "Additional profile tabs",

  // Settings
  "settings:tabs": "Additional settings tabs",

  // Admin
  "admin:sidebar": "Additional admin sidebar items",
  "admin:dashboard": "Additional dashboard widgets",

  // Navigation
  "sidebar:bottom": "Before sidebar footer",
} as const;

/**
 * Type representing all available slot names
 */
export type PluginSlotName = keyof typeof PLUGIN_SLOTS;

/**
 * Array of all slot names for iteration
 */
export const SLOT_NAMES = Object.keys(PLUGIN_SLOTS) as PluginSlotName[];
