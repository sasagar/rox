/**
 * AnnounceHandler Unit Tests
 *
 * Tests the Announce activity handler including:
 * - Renote creation
 * - Remote note fetching
 * - Error handling
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { AnnounceHandler } from "../../../services/ap/inbox/handlers/AnnounceHandler";
import type { Activity, HandlerContext } from "../../../services/ap/inbox/types";
import type { Context } from "hono";

// Mock the RemoteFetchService
mock.module("../../../services/ap/RemoteFetchService", () => ({
  RemoteFetchService: class {
    fetchActivityPubObject = mock(() =>
      Promise.resolve({
        success: true,
        data: {
          type: "Note",
          id: "https://remote.example.com/notes/1",
          content: "<p>Test note</p>",
          attributedTo: "https://remote.example.com/users/remoteuser",
        },
      }),
    );
  },
}));

describe("AnnounceHandler", () => {
  let handler: AnnounceHandler;
  let mockContext: HandlerContext;
  let mockNoteRepository: any;
  let mockRemoteNoteService: any;
  let mockRemoteActorService: any;

  const createMockHonoContext = (): Partial<Context> => {
    const contextMap = new Map<string, any>();

    mockNoteRepository = {
      findByUri: mock(() =>
        Promise.resolve({
          id: "note-123",
          uri: "http://localhost:3000/notes/note-123",
          text: "Original note",
        }),
      ),
      create: mock(() => Promise.resolve({ id: "renote-456" })),
      incrementRenoteCount: mock(() => Promise.resolve()),
    };

    mockRemoteNoteService = {
      processNote: mock(() =>
        Promise.resolve({
          id: "remote-note-789",
          uri: "https://remote.example.com/notes/1",
          text: "Remote note",
        }),
      ),
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
    contextMap.set("remoteNoteService", mockRemoteNoteService);
    contextMap.set("remoteActorService", mockRemoteActorService);

    return {
      get: (key: string) => contextMap.get(key),
    };
  };

  beforeEach(() => {
    handler = new AnnounceHandler();
    const honoContext = createMockHonoContext() as Context;

    mockContext = {
      c: honoContext,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };
  });

  test("should have correct activity type", () => {
    expect(handler.activityType).toBe("Announce");
  });

  test("should create renote for valid Announce activity", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Announce",
      id: "https://remote.example.com/activities/announce-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/notes/note-123",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Renote created");
    expect(mockNoteRepository.create).toHaveBeenCalled();

    const createCall = mockNoteRepository.create.mock.calls[0];
    expect(createCall[0].userId).toBe("remote-user-456");
    expect(createCall[0].renoteId).toBe("note-123");
    expect(createCall[0].text).toBe(null); // Pure boost
    expect(createCall[0].uri).toBe("https://remote.example.com/activities/announce-1");
  });

  test("should fetch remote note if not in local database", async () => {
    mockNoteRepository.findByUri = mock(() => Promise.resolve(null));

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Announce",
      id: "https://remote.example.com/activities/announce-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "https://another.example.com/notes/1",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(mockRemoteNoteService.processNote).toHaveBeenCalled();
  });

  test("should reject activity with missing object", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Announce",
      id: "https://remote.example.com/activities/announce-1",
      actor: "https://remote.example.com/users/remoteuser",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing object");
  });

  test("should handle object as nested object with id", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Announce",
      id: "https://remote.example.com/activities/announce-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        id: "http://localhost:3000/notes/note-123",
        type: "Note",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(mockNoteRepository.findByUri).toHaveBeenCalledWith(
      "http://localhost:3000/notes/note-123",
    );
  });

  test("should handle actor resolution failure", async () => {
    // Create new context with failing mock
    const contextMap = new Map<string, any>();
    const failingRemoteActorService = {
      resolveActor: mock(async () => {
        throw new Error("Actor resolution failed");
      }),
    };
    contextMap.set("noteRepository", mockNoteRepository);
    contextMap.set("remoteNoteService", mockRemoteNoteService);
    contextMap.set("remoteActorService", failingRemoteActorService);

    const failingContext: HandlerContext = {
      c: { get: (key: string) => contextMap.get(key) } as Context,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Announce",
      id: "https://remote.example.com/activities/announce-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/notes/note-123",
    };

    const result = await handler.handle(activity, failingContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Failed to handle Announce activity");
  });
});
