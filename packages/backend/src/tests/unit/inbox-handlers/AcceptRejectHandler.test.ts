/**
 * Accept/Reject Handler Unit Tests
 *
 * Tests the Accept and Reject activity handlers including:
 * - Follow acceptance
 * - Follow rejection
 * - Invalid activity handling
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { AcceptHandler } from "../../../services/ap/inbox/handlers/AcceptHandler";
import { RejectHandler } from "../../../services/ap/inbox/handlers/RejectHandler";
import type { Activity, HandlerContext } from "../../../services/ap/inbox/types";
import type { Context } from "hono";

const createMockHonoContext = (mockRemoteActorService: any): Partial<Context> => {
  const contextMap = new Map<string, any>();
  contextMap.set("remoteActorService", mockRemoteActorService);

  return {
    get: (key: string) => contextMap.get(key),
  };
};

describe("AcceptHandler", () => {
  let handler: AcceptHandler;
  let mockContext: HandlerContext;
  let mockRemoteActorService: any;

  beforeEach(() => {
    handler = new AcceptHandler();

    mockRemoteActorService = {
      resolveActor: mock(() =>
        Promise.resolve({
          id: "remote-user-456",
          username: "remoteuser",
          host: "remote.example.com",
        }),
      ),
    };

    const honoContext = createMockHonoContext(mockRemoteActorService) as Context;

    mockContext = {
      c: honoContext,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };
  });

  test("should have correct activity type", () => {
    expect(handler.activityType).toBe("Accept");
  });

  test("should handle Accept Follow activity", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Accept",
      id: "https://remote.example.com/activities/accept-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Follow",
        id: "http://localhost:3000/activities/follow-1",
        actor: "http://localhost:3000/users/localuser",
        object: "https://remote.example.com/users/remoteuser",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Follow confirmed");
  });

  test("should skip unsupported Accept object types", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Accept",
      id: "https://remote.example.com/activities/accept-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Invite",
        id: "http://localhost:3000/activities/invite-1",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Unsupported Accept object type: Invite");
  });

  test("should reject activity with missing object", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Accept",
      id: "https://remote.example.com/activities/accept-1",
      actor: "https://remote.example.com/users/remoteuser",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing or invalid object");
  });

  test("should reject activity with non-object object field", async () => {
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Accept",
      id: "https://remote.example.com/activities/accept-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: "http://localhost:3000/activities/follow-1",
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("missing or invalid object");
  });

  test("should handle actor resolution failure", async () => {
    // Create new context with failing mock
    const failingRemoteActorService = {
      resolveActor: mock(async () => {
        throw new Error("Actor resolution failed");
      }),
    };

    const failingContext: HandlerContext = {
      c: createMockHonoContext(failingRemoteActorService) as Context,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };

    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Accept",
      id: "https://remote.example.com/activities/accept-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Follow",
        id: "http://localhost:3000/activities/follow-1",
      },
    };

    const result = await handler.handle(activity, failingContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Failed to handle Accept activity");
  });
});

describe("RejectHandler", () => {
  let handler: RejectHandler;
  let mockContext: HandlerContext;

  beforeEach(() => {
    handler = new RejectHandler();

    const contextMap = new Map<string, any>();
    const honoContext = {
      get: (key: string) => contextMap.get(key),
    } as unknown as Context;

    mockContext = {
      c: honoContext,
      recipientId: "local-user-123",
      baseUrl: "http://localhost:3000",
    };
  });

  test("should have correct activity type", () => {
    expect(handler.activityType).toBe("Reject");
  });

  test("should return success (stub implementation)", async () => {
    // Note: RejectHandler is currently a stub implementation
    const activity: Activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Reject",
      id: "https://remote.example.com/activities/reject-1",
      actor: "https://remote.example.com/users/remoteuser",
      object: {
        type: "Follow",
        id: "http://localhost:3000/activities/follow-1",
        actor: "http://localhost:3000/users/localuser",
        object: "https://remote.example.com/users/remoteuser",
      },
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toContain("not yet implemented");
  });
});
