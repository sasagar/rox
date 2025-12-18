/**
 * Rox Plugin System
 *
 * This module provides the core plugin infrastructure for extending Rox functionality.
 *
 * ## Components
 *
 * - **EventBus**: Event system for plugin lifecycle hooks
 * - **PluginLoader**: Discovers, loads, and manages plugins
 * - **PluginConfigStorage**: Persistent configuration storage for plugins
 *
 * @example
 * ```ts
 * import { EventBus, PluginLoader } from "./plugins";
 * import type { RoxPlugin } from "./plugins";
 *
 * // Create event bus
 * const eventBus = new EventBus();
 *
 * // Subscribe to events
 * eventBus.on("note:afterCreate", (data) => {
 *   console.log("Note created:", data.note.id);
 * });
 *
 * eventBus.onBefore("note:beforeCreate", (data) => {
 *   if (data.content.includes("spam")) {
 *     return { cancel: true, reason: "Spam detected" };
 *   }
 *   return {};
 * });
 *
 * // Load plugins
 * const loader = new PluginLoader(eventBus, app);
 * await loader.loadFromDirectory();
 * ```
 *
 * @example
 * ```ts
 * // Create a simple plugin
 * const myPlugin: RoxPlugin = {
 *   id: 'my-plugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *
 *   onLoad({ events, logger }) {
 *     events.on('note:afterCreate', ({ note }) => {
 *       logger.info({ noteId: note.id }, 'Note created');
 *     });
 *   }
 * };
 *
 * export default myPlugin;
 * ```
 */

export { EventBus } from "./EventBus.js";
export { PluginLoader } from "./PluginLoader.js";
export {
  FilePluginConfigStorage,
  InMemoryPluginConfigStorage,
} from "./PluginConfigStorage.js";
export * from "./types";
