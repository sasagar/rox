/**
 * Moderator Middleware Unit Tests
 *
 * Tests the requireModeratorRole middleware including
 * authentication, role checking, and access control
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import { requireModeratorRole } from "../../middleware/auth.js";

// Type for API response bodies
interface ApiResponse {
  success?: boolean;
  user?: { id: string; username: string };
  error?: string;
  route?: string;
  id?: string;
}

describe("requireModeratorRole middleware", () => {
  let app: Hono;

  // Mock data
  const mockUser = {
    id: "user-123",
    username: "testuser",
    email: "test@example.com",
    isAdmin: false,
    isSuspended: false,
    host: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser = {
    ...mockUser,
    id: "admin-123",
    username: "admin",
    isAdmin: true,
  };

  const mockSuspendedUser = {
    ...mockUser,
    id: "suspended-123",
    username: "suspended",
    isSuspended: true,
  };

  const mockSession = {
    id: "session-123",
    userId: "user-123",
    token: "valid-token",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock repositories and services
  let mockUserRepository: any;
  let mockSessionRepository: any;
  let mockRoleService: any;

  beforeEach(() => {
    mockUserRepository = {
      findById: mock(() => Promise.resolve(mockUser)),
    };

    mockSessionRepository = {
      findByToken: mock(() => Promise.resolve(mockSession)),
      delete: mock(() => Promise.resolve(true)),
    };

    mockRoleService = {
      isModerator: mock(() => Promise.resolve(false)),
      isAdmin: mock(() => Promise.resolve(false)),
    };

    app = new Hono();

    // Set up context with mock repositories
    app.use("*", async (c, next) => {
      c.set("userRepository", mockUserRepository);
      c.set("sessionRepository", mockSessionRepository);
      c.set("roleService", mockRoleService);
      await next();
    });

    // Protected route
    app.get("/api/mod/test", requireModeratorRole(), (c) => {
      return c.json({ success: true, user: c.get("user") });
    });
  });

  describe("authentication", () => {
    test("should return 401 when no authorization header", async () => {
      const res = await app.request("/api/mod/test", {
        method: "GET",
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("Authentication required");
    });

    test("should return 401 when token does not exist in database", async () => {
      mockSessionRepository.findByToken = mock(() => Promise.resolve(null));

      const res = await app.request("/api/mod/test", {
        method: "GET",
        headers: { Authorization: "Bearer non-existent-token" },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("Invalid or expired token");
    });

    test("should return 401 when session is expired", async () => {
      mockSessionRepository.findByToken = mock(() =>
        Promise.resolve({
          ...mockSession,
          expiresAt: new Date(Date.now() - 1000), // Expired
        }),
      );

      const res = await app.request("/api/mod/test", {
        method: "GET",
        headers: { Authorization: "Bearer expired-token" },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("Invalid or expired token");
    });
  });

  describe("suspended user handling", () => {
    test("should return 401 when user is suspended (session invalidated)", async () => {
      // AuthService.validateSession returns null for suspended users
      // after deleting their session, so middleware returns 401
      mockUserRepository.findById = mock(() => Promise.resolve(mockSuspendedUser));
      mockSessionRepository.findByToken = mock(() =>
        Promise.resolve({
          ...mockSession,
          userId: "suspended-123",
        }),
      );

      const res = await app.request("/api/mod/test", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token" },
      });

      // AuthService invalidates session for suspended users and returns null
      // which results in 401 "Invalid or expired token"
      expect(res.status).toBe(401);
      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("Invalid or expired token");
    });
  });

  describe("moderator role checking", () => {
    test("should return 403 when user has no moderator role", async () => {
      mockRoleService.isModerator = mock(() => Promise.resolve(false));
      mockRoleService.isAdmin = mock(() => Promise.resolve(false));

      const res = await app.request("/api/mod/test", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe("Moderator access required");
    });

    test("should allow access when user has moderator role", async () => {
      mockRoleService.isModerator = mock(() => Promise.resolve(true));

      const res = await app.request("/api/mod/test", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
    });

    test("should allow access when user has admin role", async () => {
      mockRoleService.isModerator = mock(() => Promise.resolve(false));
      mockRoleService.isAdmin = mock(() => Promise.resolve(true));

      const res = await app.request("/api/mod/test", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
    });

    test("should allow access when user has legacy isAdmin flag", async () => {
      mockUserRepository.findById = mock(() => Promise.resolve(mockAdminUser));
      mockRoleService.isModerator = mock(() => Promise.resolve(false));
      mockRoleService.isAdmin = mock(() => Promise.resolve(false));

      const res = await app.request("/api/mod/test", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
    });
  });

  describe("context variables", () => {
    test("should set user in context when authenticated", async () => {
      mockRoleService.isModerator = mock(() => Promise.resolve(true));

      const res = await app.request("/api/mod/test", {
        method: "GET",
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.user?.id).toBe("user-123");
      expect(body.user?.username).toBe("testuser");
    });
  });
});

describe("Moderator route access patterns", () => {
  let app: Hono;

  const mockModeratorUser = {
    id: "mod-123",
    username: "moderator",
    email: "mod@example.com",
    isAdmin: false,
    isSuspended: false,
    host: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession = {
    id: "session-123",
    userId: "mod-123",
    token: "mod-token",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    app = new Hono();

    // Set up context with mock repositories (using any for test mocks)
    app.use("*", async (c, next) => {
      c.set("userRepository" as any, {
        findById: mock(() => Promise.resolve(mockModeratorUser)),
      });
      c.set("sessionRepository" as any, {
        findByToken: mock(() => Promise.resolve(mockSession)),
      });
      c.set("roleService" as any, {
        isModerator: mock(() => Promise.resolve(true)),
        isAdmin: mock(() => Promise.resolve(false)),
      });
      await next();
    });

    // Multiple protected routes
    app.use("/api/mod/*", requireModeratorRole());
    app.get("/api/mod/reports", (c) => c.json({ route: "reports" }));
    app.get("/api/mod/users/:id", (c) => c.json({ route: "user", id: c.req.param("id") }));
    app.post("/api/mod/users/:id/suspend", (c) =>
      c.json({ route: "suspend", id: c.req.param("id") }),
    );
    app.delete("/api/mod/notes/:id", (c) =>
      c.json({ route: "delete_note", id: c.req.param("id") }),
    );
  });

  test("should protect all /api/mod/* routes", async () => {
    // Without auth
    const res1 = await app.request("/api/mod/reports");
    expect(res1.status).toBe(401);

    // With auth
    const res2 = await app.request("/api/mod/reports", {
      headers: { Authorization: "Bearer mod-token" },
    });
    expect(res2.status).toBe(200);
    const body = (await res2.json()) as ApiResponse;
    expect(body.route).toBe("reports");
  });

  test("should allow GET requests to user details", async () => {
    const res = await app.request("/api/mod/users/user-456", {
      headers: { Authorization: "Bearer mod-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse;
    expect(body.route).toBe("user");
    expect(body.id).toBe("user-456");
  });

  test("should allow POST requests for user suspension", async () => {
    const res = await app.request("/api/mod/users/user-456/suspend", {
      method: "POST",
      headers: {
        Authorization: "Bearer mod-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Spam" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse;
    expect(body.route).toBe("suspend");
    expect(body.id).toBe("user-456");
  });

  test("should allow DELETE requests for note deletion", async () => {
    const res = await app.request("/api/mod/notes/note-789", {
      method: "DELETE",
      headers: { Authorization: "Bearer mod-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse;
    expect(body.route).toBe("delete_note");
    expect(body.id).toBe("note-789");
  });
});
