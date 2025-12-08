/**
 * Permission Middleware Unit Tests
 *
 * Tests for role-based permission middleware including requirePermission,
 * requireAdminRole, and requireModeratorRole
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import {
  requireAuth,
  requireAdmin,
  requirePermission,
  requireAdminRole,
  requireModeratorRole,
} from "../../middleware/auth.js";
import type { User, Session } from "shared";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { ISessionRepository } from "../../interfaces/repositories/ISessionRepository.js";
import type { RoleService } from "../../services/RoleService.js";

/**
 * Partial mock types for testing
 */
type MockUserRepo = Pick<IUserRepository, "findById">;
type MockSessionRepo = Pick<ISessionRepository, "findByToken" | "delete" | "deleteByToken">;
type MockRoleService = Pick<RoleService, "hasPermission" | "isAdmin" | "isModerator">;

describe("Permission Middleware", () => {
  // Mock data
  const mockRegularUser: User = {
    id: "user1",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "hash",
    displayName: "Test User",
    host: null,
    avatarUrl: null,
    bannerUrl: null,
    bio: null,
    isAdmin: false,
    isSuspended: false,
    isDeleted: false,
    deletedAt: null,
    publicKey: "mock-public-key",
    privateKey: "mock-private-key",
    inbox: "http://localhost:3000/users/testuser/inbox",
    outbox: "http://localhost:3000/users/testuser/outbox",
    followersUrl: "http://localhost:3000/users/testuser/followers",
    followingUrl: "http://localhost:3000/users/testuser/following",
    uri: "http://localhost:3000/users/testuser",
    sharedInbox: null,
    customCss: null,
    uiSettings: null,
    alsoKnownAs: [],
    movedTo: null,
    movedAt: null,
    profileEmojis: [],
    storageQuotaMb: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser: User = {
    ...mockRegularUser,
    id: "admin1",
    username: "admin",
    email: "admin@example.com",
    isAdmin: true,
  };

  const mockSuspendedUser: User = {
    ...mockRegularUser,
    id: "suspended1",
    username: "suspended",
    email: "suspended@example.com",
    isSuspended: true,
  };

  const mockSession: Session = {
    id: "session1",
    userId: "user1",
    token: "valid-token",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: null,
    ipAddress: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock services and repositories
  let mockUserRepo: MockUserRepo;
  let mockSessionRepo: MockSessionRepo;
  let mockRoleService: MockRoleService;

  beforeEach(() => {
    mockUserRepo = {
      findById: mock(() => Promise.resolve(mockRegularUser)),
    };

    mockSessionRepo = {
      findByToken: mock(() => Promise.resolve(mockSession)),
      delete: mock(() => Promise.resolve()),
      deleteByToken: mock(() => Promise.resolve()),
    };

    mockRoleService = {
      hasPermission: mock(() => Promise.resolve(false)),
      isAdmin: mock(() => Promise.resolve(false)),
      isModerator: mock(() => Promise.resolve(false)),
    };
  });

  /**
   * Helper to create a test app with middleware and mocked dependencies
   */
  const createTestApp = (middleware: ReturnType<typeof requireAuth>) => {
    const app = new Hono();

    // Inject mock dependencies
    app.use("*", async (c, next) => {
      c.set("userRepository", mockUserRepo as unknown as IUserRepository);
      c.set("sessionRepository", mockSessionRepo as unknown as ISessionRepository);
      c.set("roleService", mockRoleService as unknown as RoleService);
      await next();
    });

    app.get("/test", middleware, (c) => {
      return c.json({ success: true, user: c.get("user")?.username });
    });

    return app;
  };

  describe("requireAuth", () => {
    test("should allow authenticated user", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));

      const app = createTestApp(requireAuth());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
    });

    test("should reject request without auth header", async () => {
      const app = createTestApp(requireAuth());
      const res = await app.request("/test");

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Authentication required");
    });

    test("should reject invalid token", async () => {
      mockSessionRepo.findByToken = mock(() => Promise.resolve(null));

      const app = createTestApp(requireAuth());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer invalid-token" },
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Invalid or expired token");
    });

    test("should reject suspended user", async () => {
      // AuthService.validateSession returns null for suspended users (deletes session)
      // So the middleware receives null and returns 401 "Invalid or expired token"
      // This is the expected behavior - suspended users' sessions are invalidated
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockSuspendedUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockSuspendedUser));

      const app = createTestApp(requireAuth());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      // AuthService invalidates session and returns null, so middleware returns 401
      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Invalid or expired token");
    });
  });

  describe("requirePermission", () => {
    test("should allow user with permission via role system", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));
      mockRoleService.hasPermission = mock(() => Promise.resolve(true));

      const app = createTestApp(requirePermission("canInvite"));
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
    });

    test("should allow legacy admin for admin permissions", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockAdminUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockAdminUser));
      mockRoleService.hasPermission = mock(() => Promise.resolve(false)); // No role-based permission

      const app = createTestApp(requirePermission("canManageRoles"));
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
    });

    test("should reject user without permission", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));
      mockRoleService.hasPermission = mock(() => Promise.resolve(false));

      const app = createTestApp(requirePermission("canInvite"));
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Permission denied");
    });

    test("should reject unauthenticated request", async () => {
      const app = createTestApp(requirePermission("canInvite"));
      const res = await app.request("/test");

      expect(res.status).toBe(401);
    });
  });

  describe("requireAdminRole", () => {
    test("should allow user with admin role", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));
      mockRoleService.isAdmin = mock(() => Promise.resolve(true));

      const app = createTestApp(requireAdminRole());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
    });

    test("should allow legacy admin user", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockAdminUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockAdminUser));
      mockRoleService.isAdmin = mock(() => Promise.resolve(false)); // No role-based admin

      const app = createTestApp(requireAdminRole());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
    });

    test("should reject non-admin user", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));
      mockRoleService.isAdmin = mock(() => Promise.resolve(false));

      const app = createTestApp(requireAdminRole());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Admin access required");
    });
  });

  describe("requireModeratorRole", () => {
    test("should allow user with moderator role", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));
      mockRoleService.isModerator = mock(() => Promise.resolve(true));

      const app = createTestApp(requireModeratorRole());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
    });

    test("should allow admin via role system", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));
      mockRoleService.isModerator = mock(() => Promise.resolve(false));
      mockRoleService.isAdmin = mock(() => Promise.resolve(true));

      const app = createTestApp(requireModeratorRole());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
    });

    test("should allow legacy admin user", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockAdminUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockAdminUser));
      mockRoleService.isModerator = mock(() => Promise.resolve(false));
      mockRoleService.isAdmin = mock(() => Promise.resolve(false));

      const app = createTestApp(requireModeratorRole());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
    });

    test("should reject non-moderator user", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));
      mockRoleService.isModerator = mock(() => Promise.resolve(false));
      mockRoleService.isAdmin = mock(() => Promise.resolve(false));

      const app = createTestApp(requireModeratorRole());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Moderator access required");
    });
  });

  describe("requireAdmin (legacy)", () => {
    test("should allow admin user", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockAdminUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockAdminUser));

      const app = createTestApp(requireAdmin());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(200);
    });

    test("should reject non-admin user", async () => {
      mockSessionRepo.findByToken = mock(() =>
        Promise.resolve({ ...mockSession, userId: mockRegularUser.id }),
      );
      mockUserRepo.findById = mock(() => Promise.resolve(mockRegularUser));

      const app = createTestApp(requireAdmin());
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer valid-token" },
      });

      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Admin access required");
    });
  });
});
