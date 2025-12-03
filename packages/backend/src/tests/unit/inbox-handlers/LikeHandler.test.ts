/**
 * LikeHandler Unit Tests
 *
 * Tests the Like activity handler including:
 * - Standard emoji reactions
 * - Misskey custom emoji reactions
 * - Duplicate reaction handling
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { LikeHandler } from "../../../services/ap/inbox/handlers/LikeHandler";
import type { Activity, HandlerContext } from "../../../services/ap/inbox/types";
import type { Context } from "hono";

describe("LikeHandler", () => {
  let handler: LikeHandler;
  let mockContext: HandlerContext;
  let mockNoteRepository: any;
  let mockReactionRepository: any;
  let mockRemoteActorService: any;

  const createMockHonoContext = (): Partial<Context> => {
    const contextMap = new Map<string, any>();

    mockNoteRepository = {
      findByUri: mock(() =>
        Promise.resolve({
          id: "note-123",
          uri: "http://localhost:3000/notes/note-123",
          text: "Test note",
        }),
      ),
    };

    mockReactionRepository = {
      findByUserNoteAndReaction: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({ id: "reaction-123" })),
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
    contextMap.set("reactionRepository", mockReactionRepository);
    contextMap.set("remoteActorService", mockRemoteActorService);

    return {
      get: (key: string) => contextMap.get(key),
    };
  };

  beforeEach(() => {
    handler = new LikeHandler();
    const honoContext = createMockHonoContext() as Context;

    mockContext = {
      c: honoContext,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };
  });

  test("should have correct activity type", () => {
    expect(handler.activityType).toBe("Like");
  });

  test("should create reaction for valid Like activity", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Like",
      id: "https://remote.example.com/activities/like-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/notes/note-123",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Reaction created");
    expect(mockReactionRepository.create).toHaveBeenCalled();
  });

  test("should use heart emoji for standard Like", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Like",
      id: "https://remote.example.com/activities/like-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/notes/note-123",
    };

    await handler.handle(activity, mockContext);

    const createCall = mockReactionRepository.create.mock.calls[0];
    expect(createCall[0].reaction).toBe("❤️");
  });

  test("should extract Misskey custom emoji reaction", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Like",
      id: "https://remote.example.com/activities/like-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/notes/note-123",
      _misskey_reaction: ":awesome:",
      tag: [
        {
          type: "Emoji",
          name: ":awesome:",
          icon: {
            url: "https://remote.example.com/emoji/awesome.png",
          },
        },
      ],
    };

    await handler.handle(activity, mockContext);

    const createCall = mockReactionRepository.create.mock.calls[0];
    expect(createCall[0].reaction).toBe(":awesome:");
    expect(createCall[0].customEmojiUrl).toBe("https://remote.example.com/emoji/awesome.png");
  });

  test("should use content field for emoji if present", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Like",
      id: "https://remote.example.com/activities/like-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/notes/note-123",
      content: "👍",
    };

    await handler.handle(activity, mockContext);

    const createCall = mockReactionRepository.create.mock.calls[0];
    expect(createCall[0].reaction).toBe("👍");
  });

  test("should skip if reaction already exists", async () => {
    mockReactionRepository.findByUserNoteAndReaction = mock(() =>
      Promise.resolve({ id: "existing-reaction" }),
    );

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Like",
      id: "https://remote.example.com/activities/like-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/notes/note-123",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Reaction already exists");
    expect(mockReactionRepository.create).not.toHaveBeenCalled();
  });

  test("should reject activity with missing object", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Like",
      id: "https://remote.example.com/activities/like-1",
      actor: "https://remote.example.com/users/remoteuser",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing object");
  });

  test("should reject if note not found", async () => {
    mockNoteRepository.findByUri = mock(() => Promise.resolve(null));

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Like",
      id: "https://remote.example.com/activities/like-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/notes/nonexistent",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Note not found");
  });

  test("should handle object as nested object with id", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Like",
      id: "https://remote.example.com/activities/like-1",
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
});
