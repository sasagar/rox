/**
 * EventBus Unit Tests
 *
 * Tests the EventBus implementation for the plugin system,
 * covering both "after" (notification) and "before" (cancellable) events.
 */

import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { EventBus } from "../../plugins/EventBus";
import type { IEventBus } from "../../interfaces/IEventBus";
import type { NoteBeforeCreateData } from "../../plugins/types/events";

describe("EventBus", () => {
  let eventBus: IEventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe("after events", () => {
    test("should call handler when event is emitted", async () => {
      const handler = mock(() => {});

      eventBus.on("note:afterCreate", handler);

      await eventBus.emit("note:afterCreate", {
        note: {
          id: "note1",
          userId: "user1",
          text: "Hello",
        } as any,
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("should call multiple handlers in parallel", async () => {
      const callOrder: number[] = [];
      const handler1 = mock(async () => {
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push(1);
      });
      const handler2 = mock(async () => {
        callOrder.push(2);
      });

      eventBus.on("note:afterCreate", handler1);
      eventBus.on("note:afterCreate", handler2);

      await eventBus.emit("note:afterCreate", {
        note: { id: "note1" } as any,
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      // Handler2 should complete before handler1 due to parallel execution
      expect(callOrder[0]).toBe(2);
    });

    test("should not throw when handler throws error", async () => {
      const consoleSpy = spyOn(console, "error").mockImplementation(() => {});
      const handler = mock(() => {
        throw new Error("Handler error");
      });

      eventBus.on("note:afterCreate", handler);

      // Should not throw
      await expect(
        eventBus.emit("note:afterCreate", {
          note: { id: "note1" } as any,
        }),
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should pass correct data to handler", async () => {
      const handler = mock(() => {});
      const noteData = {
        note: {
          id: "note1",
          userId: "user1",
          text: "Test content",
        } as any,
      };

      eventBus.on("note:afterCreate", handler);
      await eventBus.emit("note:afterCreate", noteData);

      expect(handler).toHaveBeenCalledWith(noteData);
    });

    test("should do nothing when no handlers registered", async () => {
      // Should not throw
      await expect(
        eventBus.emit("note:afterCreate", {
          note: { id: "note1" } as any,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("before events", () => {
    test("should call handler and return data unchanged when no modification", async () => {
      const handler = mock(() => ({}));
      const inputData: NoteBeforeCreateData = {
        content: "Hello",
        userId: "user1",
      };

      eventBus.onBefore("note:beforeCreate", handler);

      const result = await eventBus.emitBefore("note:beforeCreate", inputData);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result.cancelled).toBe(false);
      if (!result.cancelled) {
        expect(result.data).toEqual(inputData);
      }
    });

    test("should allow handler to cancel operation", async () => {
      const handler = mock(() => ({
        cancel: true as const,
        reason: "Spam detected",
      }));

      eventBus.onBefore("note:beforeCreate", handler);

      const result = await eventBus.emitBefore("note:beforeCreate", {
        content: "spam content",
        userId: "user1",
      });

      expect(result.cancelled).toBe(true);
      if (result.cancelled) {
        expect(result.reason).toBe("Spam detected");
      }
    });

    test("should allow handler to modify data", async () => {
      const handler = mock((data: NoteBeforeCreateData) => ({
        modified: { ...data, content: "Modified content" },
      }));

      eventBus.onBefore("note:beforeCreate", handler);

      const result = await eventBus.emitBefore("note:beforeCreate", {
        content: "Original content",
        userId: "user1",
      });

      expect(result.cancelled).toBe(false);
      if (!result.cancelled) {
        expect(result.data.content).toBe("Modified content");
      }
    });

    test("should chain modifications through multiple handlers", async () => {
      const handler1 = mock((data: NoteBeforeCreateData) => ({
        modified: { ...data, content: data.content + " [1]" },
      }));
      const handler2 = mock((data: NoteBeforeCreateData) => ({
        modified: { ...data, content: data.content + " [2]" },
      }));

      eventBus.onBefore("note:beforeCreate", handler1);
      eventBus.onBefore("note:beforeCreate", handler2);

      const result = await eventBus.emitBefore("note:beforeCreate", {
        content: "Hello",
        userId: "user1",
      });

      expect(result.cancelled).toBe(false);
      if (!result.cancelled) {
        expect(result.data.content).toBe("Hello [1] [2]");
      }
    });

    test("should stop on first cancellation", async () => {
      const handler1 = mock(() => ({
        cancel: true as const,
        reason: "First cancel",
      }));
      const handler2 = mock(() => ({}));

      eventBus.onBefore("note:beforeCreate", handler1);
      eventBus.onBefore("note:beforeCreate", handler2);

      const result = await eventBus.emitBefore("note:beforeCreate", {
        content: "Hello",
        userId: "user1",
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
      expect(result.cancelled).toBe(true);
    });

    test("should throw when handler throws error", async () => {
      const consoleSpy = spyOn(console, "error").mockImplementation(() => {});
      const handler = mock(() => {
        throw new Error("Handler error");
      });

      eventBus.onBefore("note:beforeCreate", handler);

      await expect(
        eventBus.emitBefore("note:beforeCreate", {
          content: "Hello",
          userId: "user1",
        }),
      ).rejects.toThrow("Handler error");

      consoleSpy.mockRestore();
    });

    test("should return unchanged data when no handlers registered", async () => {
      const inputData: NoteBeforeCreateData = {
        content: "Hello",
        userId: "user1",
      };

      const result = await eventBus.emitBefore("note:beforeCreate", inputData);

      expect(result.cancelled).toBe(false);
      if (!result.cancelled) {
        expect(result.data).toEqual(inputData);
      }
    });
  });

  describe("unsubscribe", () => {
    test("should remove after handler when unsubscribe is called", async () => {
      const handler = mock(() => {});

      const unsubscribe = eventBus.on("note:afterCreate", handler);
      unsubscribe();

      await eventBus.emit("note:afterCreate", {
        note: { id: "note1" } as any,
      });

      expect(handler).not.toHaveBeenCalled();
    });

    test("should remove before handler when unsubscribe is called", async () => {
      const handler = mock(() => ({ cancel: true as const }));

      const unsubscribe = eventBus.onBefore("note:beforeCreate", handler);
      unsubscribe();

      const result = await eventBus.emitBefore("note:beforeCreate", {
        content: "Hello",
        userId: "user1",
      });

      expect(handler).not.toHaveBeenCalled();
      expect(result.cancelled).toBe(false);
    });

    test("should only remove specific handler", async () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      const unsubscribe1 = eventBus.on("note:afterCreate", handler1);
      eventBus.on("note:afterCreate", handler2);

      unsubscribe1();

      await eventBus.emit("note:afterCreate", {
        note: { id: "note1" } as any,
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeAllListeners", () => {
    test("should remove all after handlers", async () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      eventBus.on("note:afterCreate", handler1);
      eventBus.on("note:afterDelete", handler2);

      eventBus.removeAllListeners();

      await eventBus.emit("note:afterCreate", {
        note: { id: "note1" } as any,
      });
      await eventBus.emit("note:afterDelete", {
        noteId: "note1",
        userId: "user1",
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    test("should remove all before handlers", async () => {
      const handler = mock(() => ({ cancel: true as const }));

      eventBus.onBefore("note:beforeCreate", handler);
      eventBus.removeAllListeners();

      const result = await eventBus.emitBefore("note:beforeCreate", {
        content: "Hello",
        userId: "user1",
      });

      expect(handler).not.toHaveBeenCalled();
      expect(result.cancelled).toBe(false);
    });
  });

  describe("user events", () => {
    test("should handle user:beforeRegister event", async () => {
      const handler = mock(() => ({}));

      eventBus.onBefore("user:beforeRegister", handler);

      const result = await eventBus.emitBefore("user:beforeRegister", {
        username: "newuser",
        email: "test@example.com",
      });

      expect(handler).toHaveBeenCalledWith({
        username: "newuser",
        email: "test@example.com",
      });
      expect(result.cancelled).toBe(false);
    });

    test("should handle user:afterRegister event", async () => {
      const handler = mock(() => {});

      eventBus.on("user:afterRegister", handler);

      await eventBus.emit("user:afterRegister", {
        userId: "user1",
        username: "newuser",
      });

      expect(handler).toHaveBeenCalledWith({
        userId: "user1",
        username: "newuser",
      });
    });
  });

  describe("note delete events", () => {
    test("should handle note:beforeDelete event", async () => {
      const handler = mock(() => ({}));

      eventBus.onBefore("note:beforeDelete", handler);

      const result = await eventBus.emitBefore("note:beforeDelete", {
        noteId: "note1",
        userId: "user1",
      });

      expect(handler).toHaveBeenCalledWith({
        noteId: "note1",
        userId: "user1",
      });
      expect(result.cancelled).toBe(false);
    });

    test("should handle note:afterDelete event", async () => {
      const handler = mock(() => {});

      eventBus.on("note:afterDelete", handler);

      await eventBus.emit("note:afterDelete", {
        noteId: "note1",
        userId: "user1",
      });

      expect(handler).toHaveBeenCalledWith({
        noteId: "note1",
        userId: "user1",
      });
    });
  });
});
