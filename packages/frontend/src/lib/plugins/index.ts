/**
 * Frontend Plugin System
 *
 * This module exports the frontend plugin infrastructure for Rox.
 *
 * @example
 * // Registering a plugin
 * import { pluginRegistry } from '@/lib/plugins';
 *
 * const myPlugin: FrontendPlugin = {
 *   id: 'my-plugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *   slots: {
 *     'note:footer': MyFooterComponent,
 *   },
 * };
 *
 * await pluginRegistry.register(myPlugin);
 *
 * @example
 * // Using PluginSlot in a component
 * import { PluginSlot } from '@/lib/plugins';
 *
 * function NoteCard({ note }) {
 *   return (
 *     <div>
 *       <PluginSlot slot="note:header" props={{ noteId: note.id, userId: note.userId }} />
 *       <div>{note.content}</div>
 *       <PluginSlot slot="note:footer" props={{ noteId: note.id, userId: note.userId }} />
 *     </div>
 *   );
 * }
 */

// Slot definitions
export { PLUGIN_SLOTS, SLOT_NAMES, type PluginSlotName } from "./slots.js";

// Type definitions
export type {
  SlotProps,
  BaseSlotProps,
  NoteSlotProps,
  ComposeSlotProps,
  ProfileSlotProps,
  SettingsSlotProps,
  AdminSlotProps,
  SidebarSlotProps,
  PluginPage,
  PluginMessages,
  FrontendPlugin,
  LoadedFrontendPlugin,
  PluginLoadResult,
} from "./types.js";

// Registry and hooks
export {
  pluginRegistry,
  pluginListAtom,
  enabledPluginsAtom,
  usePlugins,
  useEnabledPlugins,
  usePluginSlotComponents,
  useHasSlotPlugins,
  usePluginRegistry,
} from "./registry.js";

// Components
export { PluginSlot } from "./PluginSlot.js";
