/**
 * UndoHandler Unit Tests
 *
 * Tests the Undo activity handler including:
 * - Undo Follow (unfollow)
 * - Undo Like (unlike)
 * - Undo Announce (unrenote)
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { UndoHandler } from "../../../services/ap/inbox/handlers/UndoHandler";
import type { Activity, HandlerContext } from "../../../services/ap/inbox/types";
import type { Context } from "hono";

describe("UndoHandler", () => {
  let handler: UndoHandler;
  let mockContext: HandlerContext;
  let mockFollowRepository: any;
  let mockNoteRepository: any;
  let mockReactionRepository: any;
  let mockRemoteActorService: any;

  const createMockHonoContext = (): Partial<Context> => {
    const contextMap = new Map<string, any>();

    mockFollowRepository = {
      delete: mock(() => Promise.resolve()),
    };

    mockNoteRepository = {
      findByUri: mock(() =>
        Promise.resolve({
          id: "note-123",
          userId: "remote-user-456",
          uri: "http://localhost:3000/notes/note-123",
        }),
      ),
      delete: mock(() => Promise.resolve()),
    };

    mockReactionRepository = {
      deleteByUserNoteAndReaction: mock(() => Promise.resolve()),
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

    contextMap.set("followRepository", mockFollowRepository);
    contextMap.set("noteRepository", mockNoteRepository);
    contextMap.set("reactionRepository", mockReactionRepository);
    contextMap.set("remoteActorService", mockRemoteActorService);

    return {
      get: (key: string) => contextMap.get(key),
    };
  };

  beforeEach(() => {
    handler = new UndoHandler();
    const honoContext = createMockHonoContext() as Context;

    mockContext = {
      c: honoContext,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };
  });

  test("should have correct activity type", () => {
    expect(handler.activityType).toBe("Undo");
  });

  describe("Undo Follow", () => {
    test("should delete follow relationship", async () => {
      const activity: Activity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Undo",
        id: "https://remote.example.com/activities/undo-1",
        actor: "https://remote.example.com/users/remoteuser",
        object: {
          type: "Follow",
          id: "https://remote.example.com/activities/follow-1",
          actor: "https://remote.example.com/users/remoteuser",
          object: "http://localhost:3000/users/localuser",
        },
      };

      const result = await handler.handle(activity, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Follow deleted");
      expect(mockFollowRepository.delete).toHaveBeenCalledWith("remote-user-456", "local-user-123");
    });
  });

  describe("Undo Like", () => {
    test("should delete reaction", async () => {
      const activity: Activity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Undo",
        id: "https://remote.example.com/activities/undo-2",
        actor: "https://remote.example.com/users/remoteuser",
        object: {
          type: "Like",
          id: "https://remote.example.com/activities/like-1",
          actor: "https://remote.example.com/users/remoteuser",
          object: "http://localhost:3000/notes/note-123",
        },
      };

      const result = await handler.handle(activity, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Reaction deleted");
      expect(mockReactionRepository.deleteByUserNoteAndReaction).toHaveBeenCalledWith(
        "remote-user-456",
        "note-123",
        "❤️",
      );
    });

    test("should fail if note not found", async () => {
      mockNoteRepository.findByUri = mock(() => Promise.resolve(null));

      const activity: Activity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Undo",
        id: "https://remote.example.com/activities/undo-2",
        actor: "https://remote.example.com/users/remoteuser",
        object: {
          type: "Like",
          id: "https://remote.example.com/activities/like-1",
          actor: "https://remote.example.com/users/remoteuser",
          object: "http://localhost:3000/notes/nonexistent",
        },
      };

      const result = await handler.handle(activity, mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Note not found");
    });
  });

  describe("Undo Announce", () => {
    test("should delete renote", async () => {
      const activity: Activity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Undo",
        id: "https://remote.example.com/activities/undo-3",
        actor: "https://remote.example.com/users/remoteuser",
        object: {
          type: "Announce",
          id: "https://remote.example.com/activities/announce-1",
          actor: "https://remote.example.com/users/remoteuser",
          object: "http://localhost:3000/notes/original-note",
        },
      };

      // Set up the note to be found by the Announce URI
      mockNoteRepository.findByUri = mock(() =>
        Promise.resolve({
          id: "renote-123",
          userId: "remote-user-456",
          uri: "https://remote.example.com/activities/announce-1",
        }),
      );

      const result = await handler.handle(activity, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Renote deleted");
      expect(mockNoteRepository.delete).toHaveBeenCalledWith("renote-123");
    });

    test("should fail if renote not found", async () => {
      mockNoteRepository.findByUri = mock(() => Promise.resolve(null));

      const activity: Activity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Undo",
        id: "https://remote.example.com/activities/undo-3",
        actor: "https://remote.example.com/users/remoteuser",
        object: {
          type: "Announce",
          id: "https://remote.example.com/activities/announce-1",
          actor: "https://remote.example.com/users/remoteuser",
          object: "http://localhost:3000/notes/original-note",
        },
      };

      const result = await handler.handle(activity, mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Renote not found");
    });

    test("should fail if actor does not own renote", async () => {
      mockNoteRepository.findByUri = mock(() =>
        Promise.resolve({
          id: "renote-123",
          userId: "different-user-789",
          uri: "https://remote.example.com/activities/announce-1",
        }),
      );

      const activity: Activity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Undo",
        id: "https://remote.example.com/activities/undo-3",
        actor: "https://remote.example.com/users/remoteuser",
        object: {
          type: "Announce",
          id: "https://remote.example.com/activities/announce-1",
          actor: "https://remote.example.com/users/remoteuser",
          object: "http://localhost:3000/notes/original-note",
        },
      };

      const result = await handler.handle(activity, mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Cannot delete renote owned by another user");
    });
  });

  describe("Invalid activities", () => {
    test("should reject activity with missing object", async () => {
      const activity: Activity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Undo",
        id: "https://remote.example.com/activities/undo-1",
        actor: "https://remote.example.com/users/remoteuser",
      };

      const result = await handler.handle(activity, mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("missing or invalid object");
    });

    test("should skip unsupported object types", async () => {
      const activity: Activity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Undo",
        id: "https://remote.example.com/activities/undo-1",
        actor: "https://remote.example.com/users/remoteuser",
        object: {
          type: "Block",
          id: "https://remote.example.com/activities/block-1",
          actor: "https://remote.example.com/users/remoteuser",
          object: "http://localhost:3000/users/localuser",
        },
      };

      const result = await handler.handle(activity, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Unsupported Undo object type: Block");
    });
  });
});
