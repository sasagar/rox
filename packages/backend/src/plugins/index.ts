/**
 * Rox Plugin System
 *
 * This module provides the EventBus for plugin lifecycle hooks.
 *
 * @example
 * ```ts
 * import { EventBus } from "./plugins";
 * import type { IEventBus } from "./interfaces/IEventBus";
 *
 * const eventBus: IEventBus = new EventBus();
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
 * ```
 */

export { EventBus } from "./EventBus";
export * from "./types";
