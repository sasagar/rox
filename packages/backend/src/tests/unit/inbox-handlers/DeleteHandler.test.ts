/**
 * DeleteHandler Unit Tests
 *
 * Tests the Delete activity handler including:
 * - Note deletion
 * - Authorization checks
 * - Non-existent object handling
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { DeleteHandler } from "../../../services/ap/inbox/handlers/DeleteHandler";
import type { Activity, HandlerContext } from "../../../services/ap/inbox/types";
import type { Context } from "hono";

describe("DeleteHandler", () => {
  let handler: DeleteHandler;
  let mockContext: HandlerContext;
  let mockNoteRepository: any;
  let mockUserRepository: any;
  let mockRemoteActorService: any;

  const createMockHonoContext = (): Partial<Context> => {
    const contextMap = new Map<string, any>();

    mockNoteRepository = {
      findByUri: mock(() =>
        Promise.resolve({
          id: "note-123",
          userId: "remote-user-456",
          uri: "https://remote.example.com/notes/1",
          text: "Test note",
        }),
      ),
      delete: mock(() => Promise.resolve()),
    };

    mockUserRepository = {
      findByUri: mock(() => Promise.resolve(null)),
    };

    mockRemoteActorService = {
      resolveActor: mock(() =>
        Promise.resolve({
          id: "remote-user-456",
          username: "remoteuser",
          host: "remote.example.com",
        }),
      ),
    };

    contextMap.set("noteRepository", mockNoteRepository);
    contextMap.set("userRepository", mockUserRepository);
    contextMap.set("remoteActorService", mockRemoteActorService);

    return {
      get: (key: string) => contextMap.get(key),
    };
  };

  beforeEach(() => {
    handler = new DeleteHandler();
    const honoContext = createMockHonoContext() as Context;

    mockContext = {
      c: honoContext,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };
  });

  test("should have correct activity type", () => {
    expect(handler.activityType).toBe("Delete");
  });

  test("should delete note owned by actor", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Delete",
      id: "https://remote.example.com/activities/delete-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "https://remote.example.com/notes/1",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Note deleted");
    expect(mockNoteRepository.delete).toHaveBeenCalledWith("note-123");
  });

  test("should reject deletion of note owned by different user", async () => {
    mockNoteRepository.findByUri = mock(() =>
      Promise.resolve({
        id: "note-123",
        userId: "different-user-789",
        uri: "https://remote.example.com/notes/1",
        text: "Test note",
      }),
    );

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Delete",
      id: "https://remote.example.com/activities/delete-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "https://remote.example.com/notes/1",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Cannot delete note owned by another user");
    expect(mockNoteRepository.delete).not.toHaveBeenCalled();
  });

  test("should handle non-existent note gracefully", async () => {
    mockNoteRepository.findByUri = mock(() => Promise.resolve(null));
    mockUserRepository.findByUri = mock(() => Promise.resolve(null));

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Delete",
      id: "https://remote.example.com/activities/delete-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "https://remote.example.com/notes/nonexistent",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Delete target not found");
    expect(mockNoteRepository.delete).not.toHaveBeenCalled();
  });

  test("should reject activity with missing object", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Delete",
      id: "https://remote.example.com/activities/delete-1",
      actor: "https://remote.example.com/users/remoteuser",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing object URI");
  });

  test("should handle object as Tombstone", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Delete",
      id: "https://remote.example.com/activities/delete-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Tombstone",
        id: "https://remote.example.com/notes/1",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(mockNoteRepository.findByUri).toHaveBeenCalledWith("https://remote.example.com/notes/1");
  });

  test("should handle actor resolution failure", async () => {
    mockRemoteActorService.resolveActor = mock(() =>
      Promise.reject(new Error("Actor resolution failed")),
    );

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Delete",
      id: "https://remote.example.com/activities/delete-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "https://remote.example.com/notes/1",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Failed to handle Delete activity");
  });
});
