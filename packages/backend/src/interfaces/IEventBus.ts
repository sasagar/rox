/**
 * EventBus Interface for Rox Plugin System
 *
 * Provides a pub/sub mechanism for plugins to hook into
 * application lifecycle events.
 */

import type {
  AfterEventType,
  BeforeEventResult,
  BeforeEventType,
  EventDataMap,
} from "../plugins/types/events";

/**
 * Handler function for "after" events (notification only)
 * These handlers cannot cancel or modify the operation.
 *
 * @template T - Event type string
 */
export type AfterEventHandler<T extends AfterEventType> = (
  data: EventDataMap[T],
) => void | Promise<void>;

/**
 * Handler function for "before" events (cancellable/modifiable)
 * These handlers can return a result to cancel or modify the operation.
 *
 * @template T - Event type string
 */
export type BeforeEventHandler<T extends BeforeEventType> = (
  data: EventDataMap[T],
) => BeforeEventResult<EventDataMap[T]> | Promise<BeforeEventResult<EventDataMap[T]>>;

/**
 * Function to unsubscribe from an event
 */
export type Unsubscribe = () => void;

/**
 * EventBus interface for plugin event handling
 *
 * The EventBus provides two categories of events:
 * - "after" events: Notification-only, cannot affect the operation
 * - "before" events: Can cancel or modify the operation
 *
 * @example
 * ```ts
 * // Subscribe to after events (notification)
 * const unsub = eventBus.on("note:afterCreate", async (data) => {
 *   console.log("Note created:", data.note.id);
 * });
 *
 * // Subscribe to before events (can cancel/modify)
 * eventBus.onBefore("note:beforeCreate", async (data) => {
 *   if (containsSpam(data.content)) {
 *     return { cancel: true, reason: "Spam detected" };
 *   }
 *   return {};
 * });
 *
 * // Emit after event (fire-and-forget)
 * await eventBus.emit("note:afterCreate", { note });
 *
 * // Emit before event (check result)
 * const result = await eventBus.emitBefore("note:beforeCreate", noteData);
 * if (result.cancelled) {
 *   throw new Error(result.reason);
 * }
 * const finalData = result.data; // May be modified by handlers
 * ```
 */
export interface IEventBus {
  /**
   * Subscribe to an "after" event
   * Handlers are called after the operation completes (notification only)
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function
   * @returns Unsubscribe function
   */
  on<T extends AfterEventType>(eventType: T, handler: AfterEventHandler<T>): Unsubscribe;

  /**
   * Subscribe to a "before" event
   * Handlers can cancel or modify the operation
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function
   * @returns Unsubscribe function
   */
  onBefore<T extends BeforeEventType>(
    eventType: T,
    handler: BeforeEventHandler<T>,
  ): Unsubscribe;

  /**
   * Emit an "after" event
   * All handlers are called in parallel; errors are logged but don't throw
   *
   * @param eventType - The event type to emit
   * @param data - The event data
   */
  emit<T extends AfterEventType>(eventType: T, data: EventDataMap[T]): Promise<void>;

  /**
   * Emit a "before" event
   * Handlers are called sequentially; stops on first cancellation
   *
   * @param eventType - The event type to emit
   * @param data - The event data (may be modified by handlers)
   * @returns Result indicating if cancelled and the final data
   */
  emitBefore<T extends BeforeEventType>(
    eventType: T,
    data: EventDataMap[T],
  ): Promise<BeforeEventEmitResult<T>>;

  /**
   * Remove all event listeners
   * Useful for testing and cleanup
   */
  removeAllListeners(): void;
}

/**
 * Result of emitting a "before" event
 */
export type BeforeEventEmitResult<T extends BeforeEventType> =
  | { cancelled: true; reason?: string }
  | { cancelled: false; data: EventDataMap[T] };
