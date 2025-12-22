/**
 * EventBus Implementation for Rox Plugin System
 *
 * Provides a pub/sub mechanism for plugins to hook into
 * application lifecycle events.
 */

import type {
  AfterEventHandler,
  BeforeEventEmitResult,
  BeforeEventHandler,
  IEventBus,
  Unsubscribe,
} from "../interfaces/IEventBus";
import type {
  AfterEventType,
  BeforeEventResult,
  BeforeEventType,
  EventDataMap,
} from "./types/events";

// Internal handler type that allows any event data
type AnyAfterEventHandler = (data: unknown) => void | Promise<void>;
type AnyBeforeEventHandler = (data: unknown) => BeforeEventResult<unknown> | Promise<BeforeEventResult<unknown>>;

/**
 * EventBus implementation using Map-based handler storage
 *
 * Features:
 * - Type-safe event handling with full TypeScript support
 * - "before" events execute sequentially (allows cancellation/modification)
 * - "after" events execute in parallel (fire-and-forget)
 * - Automatic cleanup via returned unsubscribe functions
 */
export class EventBus implements IEventBus {
  /** Storage for "after" event handlers */
  private afterHandlers = new Map<string, Set<AnyAfterEventHandler>>();

  /** Storage for "before" event handlers */
  private beforeHandlers = new Map<string, Set<AnyBeforeEventHandler>>();

  /**
   * Subscribe to an "after" event
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function
   * @returns Unsubscribe function
   */
  on<T extends AfterEventType>(eventType: T, handler: AfterEventHandler<T>): Unsubscribe {
    if (!this.afterHandlers.has(eventType)) {
      this.afterHandlers.set(eventType, new Set());
    }

    const handlers = this.afterHandlers.get(eventType)!;
    const wrappedHandler = handler as AnyAfterEventHandler;
    handlers.add(wrappedHandler);

    return () => {
      handlers.delete(wrappedHandler);
      if (handlers.size === 0) {
        this.afterHandlers.delete(eventType);
      }
    };
  }

  /**
   * Subscribe to a "before" event
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function
   * @returns Unsubscribe function
   */
  onBefore<T extends BeforeEventType>(
    eventType: T,
    handler: BeforeEventHandler<T>,
  ): Unsubscribe {
    if (!this.beforeHandlers.has(eventType)) {
      this.beforeHandlers.set(eventType, new Set());
    }

    const handlers = this.beforeHandlers.get(eventType)!;
    const wrappedHandler = handler as AnyBeforeEventHandler;
    handlers.add(wrappedHandler);

    return () => {
      handlers.delete(wrappedHandler);
      if (handlers.size === 0) {
        this.beforeHandlers.delete(eventType);
      }
    };
  }

  /**
   * Emit an "after" event
   * All handlers are called in parallel; errors are logged but don't throw
   *
   * @param eventType - The event type to emit
   * @param data - The event data
   */
  async emit<T extends AfterEventType>(eventType: T, data: EventDataMap[T]): Promise<void> {
    const handlers = this.afterHandlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(data);
      } catch (error) {
        // Log error but don't throw - after events are fire-and-forget
        console.error(`[EventBus] Error in handler for ${eventType}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Emit a "before" event
   * Handlers are called sequentially; stops on first cancellation
   *
   * @param eventType - The event type to emit
   * @param data - The event data (may be modified by handlers)
   * @returns Result indicating if cancelled and the final data
   */
  async emitBefore<T extends BeforeEventType>(
    eventType: T,
    data: EventDataMap[T],
  ): Promise<BeforeEventEmitResult<T>> {
    const handlers = this.beforeHandlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      return { cancelled: false, data };
    }

    let currentData: EventDataMap[T] = data;

    for (const handler of handlers) {
      try {
        const result = await handler(currentData);

        // Check if cancelled
        if ("cancel" in result && result.cancel === true) {
          return { cancelled: true, reason: (result as { reason?: string }).reason };
        }

        // Check if modified
        if ("modified" in result && result.modified !== undefined) {
          currentData = result.modified as EventDataMap[T];
        }
      } catch (error) {
        // Handler errors in "before" events should propagate
        console.error(`[EventBus] Error in before handler for ${eventType}:`, error);
        throw error;
      }
    }

    return { cancelled: false, data: currentData };
  }

  /**
   * Remove all event listeners
   * Useful for testing and cleanup
   */
  removeAllListeners(): void {
    this.afterHandlers.clear();
    this.beforeHandlers.clear();
  }
}
