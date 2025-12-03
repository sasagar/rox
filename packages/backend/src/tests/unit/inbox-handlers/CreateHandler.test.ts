/**
 * CreateHandler Unit Tests
 *
 * Tests the Create activity handler including:
 * - Note creation from remote servers
 * - Invalid object handling
 * - Unsupported object types
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { CreateHandler } from "../../../services/ap/inbox/handlers/CreateHandler";
import type { Activity, HandlerContext } from "../../../services/ap/inbox/types";
import type { Context } from "hono";

describe("CreateHandler", () => {
  let handler: CreateHandler;
  let mockContext: HandlerContext;
  let mockRemoteNoteService: any;

  const createMockHonoContext = (): Partial<Context> => {
    const contextMap = new Map<string, any>();

    mockRemoteNoteService = {
      processNote: mock(() =>
        Promise.resolve({
          id: "note-123",
          uri: "https://remote.example.com/notes/1",
          text: "Hello from remote!",
        }),
      ),
    };

    contextMap.set("remoteNoteService", mockRemoteNoteService);

    return {
      get: (key: string) => contextMap.get(key),
    };
  };

  beforeEach(() => {
    handler = new CreateHandler();
    const honoContext = createMockHonoContext() as Context;

    mockContext = {
      c: honoContext,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };
  });

  test("should have correct activity type", () => {
    expect(handler.activityType).toBe("Create");
  });

  test("should create note from valid Create Note activity", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Create",
      id: "https://remote.example.com/activities/create-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Note",
        id: "https://remote.example.com/notes/1",
        content: "<p>Hello from remote!</p>",
        attributedTo: "https://remote.example.com/users/remoteuser",
        published: "2025-01-01T00:00:00Z",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Note created");
    expect(mockRemoteNoteService.processNote).toHaveBeenCalled();
  });

  test("should create note from valid Create Article activity", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Create",
      id: "https://remote.example.com/activities/create-2",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Article",
        id: "https://remote.example.com/articles/1",
        name: "My Article",
        content: "<p>Article content</p>",
        attributedTo: "https://remote.example.com/users/remoteuser",
        published: "2025-01-01T00:00:00Z",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(mockRemoteNoteService.processNote).toHaveBeenCalled();
  });

  test("should reject activity with missing object", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Create",
      id: "https://remote.example.com/activities/create-1",
      actor: "https://remote.example.com/users/remoteuser",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing or invalid object");
  });

  test("should reject activity with non-object object field", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Create",
      id: "https://remote.example.com/activities/create-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "https://remote.example.com/notes/1",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing or invalid object");
  });

  test("should skip unsupported object types", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Create",
      id: "https://remote.example.com/activities/create-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Image",
        id: "https://remote.example.com/images/1",
        url: "https://remote.example.com/images/1.jpg",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Unsupported object type: Image");
    expect(mockRemoteNoteService.processNote).not.toHaveBeenCalled();
  });

  test("should handle note processing failure", async () => {
    mockRemoteNoteService.processNote = mock(() =>
      Promise.reject(new Error("Failed to process note")),
    );

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Create",
      id: "https://remote.example.com/activities/create-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Note",
        id: "https://remote.example.com/notes/1",
        content: "<p>Hello</p>",
        attributedTo: "https://remote.example.com/users/remoteuser",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Failed to handle Create activity");
  });
});
