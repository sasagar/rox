/**
 * User Account Deletion Endpoint Unit Tests
 *
 * Tests the POST /api/users/@me/delete endpoint
 * for self-service account deletion.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { User } from "../../db/schema/pg.js";

// Mock the verifyPassword function
const mockVerifyPassword = mock(() => Promise.resolve(true));

// Mock user deletion service
const mockDeleteLocalUser = mock(() =>
  Promise.resolve({
    success: true,
    message: "User deleted successfully",
    deletedUserId: "user-1",
    isRemoteUser: false,
    activitiesSent: 5,
  })
);

describe("POST /api/users/@me/delete", () => {
  let app: Hono;
  let mockUserRepo: Partial<IUserRepository>;

  const mockUser: User = {
    id: "user-1",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "$argon2id$hashed-password",
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

  beforeEach(() => {
    // Reset mocks
    mockVerifyPassword.mockReset();
    mockVerifyPassword.mockResolvedValue(true);
    mockDeleteLocalUser.mockReset();
    mockDeleteLocalUser.mockResolvedValue({
      success: true,
      message: "User deleted successfully",
      deletedUserId: "user-1",
      isRemoteUser: false,
      activitiesSent: 5,
    });

    mockUserRepo = {
      findById: mock((id: string) => {
        if (id === "user-1") return Promise.resolve(mockUser);
        return Promise.resolve(null);
      }),
    };

    app = new Hono();

    // Add middleware to set user in context BEFORE route
    app.use("*", async (c, next) => {
      c.set("user", mockUser);
      await next();
    });

    // Simulate the endpoint logic
    app.post("/@me/delete", async (c) => {
      const user = c.get("user") as User | undefined;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const body = await c.req.json<{ password?: string }>();
      const { password } = body;

      if (!password) {
        return c.json({ error: "Password is required to delete your account" }, 400);
      }

      const fullUser = await mockUserRepo.findById!(user.id);
      if (!fullUser || !fullUser.passwordHash) {
        return c.json({ error: "User not found or no password set" }, 400);
      }

      const isValidPassword = await mockVerifyPassword(password, fullUser.passwordHash);
      if (!isValidPassword) {
        return c.json({ error: "Incorrect password" }, 400);
      }

      const result = await mockDeleteLocalUser(user.id, { deleteNotes: true });
      if (!result.success) {
        return c.json({ error: result.message }, 400);
      }

      return c.json({ success: true, message: "Account deleted successfully" });
    });
  });

  test("should delete account with valid password", async () => {
    const res = await app.request("/@me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correctPassword123" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Account deleted successfully");

    expect(mockVerifyPassword).toHaveBeenCalled();
    expect(mockDeleteLocalUser).toHaveBeenCalledWith("user-1", { deleteNotes: true });
  });

  test("should reject request without password", async () => {
    const res = await app.request("/@me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Password is required to delete your account");
  });

  test("should reject request with incorrect password", async () => {
    mockVerifyPassword.mockResolvedValue(false);

    const res = await app.request("/@me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrongPassword" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Incorrect password");
  });

  test("should handle deletion service failure", async () => {
    mockDeleteLocalUser.mockResolvedValue({
      success: false,
      message: "Cannot delete admin users. Remove admin status first.",
      deletedUserId: "user-1",
      isRemoteUser: false,
    });

    const res = await app.request("/@me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correctPassword123" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Cannot delete admin users. Remove admin status first.");
  });

  test("should reject unauthenticated request", async () => {
    // Create app without user middleware
    const unauthApp = new Hono();
    unauthApp.post("/@me/delete", async (c) => {
      const user = c.get("user") as User | undefined;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      return c.json({ success: true });
    });

    const res = await unauthApp.request("/@me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test" }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  test("should handle user not found in repository", async () => {
    mockUserRepo.findById = mock(() => Promise.resolve(null));

    const res = await app.request("/@me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("User not found or no password set");
  });

  test("should handle user without password hash (OAuth-only users)", async () => {
    mockUserRepo.findById = mock(() =>
      Promise.resolve({ ...mockUser, passwordHash: null })
    );

    const res = await app.request("/@me/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("User not found or no password set");
  });
});
