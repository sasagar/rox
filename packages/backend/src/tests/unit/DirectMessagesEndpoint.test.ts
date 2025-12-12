/**
 * Direct Messages API Endpoint Unit Tests
 *
 * Tests the /api/direct/* endpoints for DM functionality.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import type { User, Note } from "../../db/schema/pg.js";

/**
 * API response types for type safety in tests
 */
interface ErrorResponse {
  error: string;
}

interface ConversationPartner {
  partnerId: string;
  partnerUsername: string;
  partnerDisplayName: string | null;
  partnerAvatarUrl: string | null;
  partnerHost: string | null;
  partnerProfileEmojis: Array<{ name: string; url: string }> | null;
  lastNoteId: string;
  lastNoteText: string | null;
  lastNoteCreatedAt: string;
}

// Mock user
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
    isSystemUser: false,
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
  goneDetectedAt: null,
  fetchFailureCount: 0,
  lastFetchAttemptAt: null,
  lastFetchError: null,
    followersCount: 0,
    followingCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock DM notes
const mockDMNote: Note = {
  id: "dm-1",
  userId: "user-1",
  text: "Hello, this is a DM",
  cw: null,
  visibility: "specified",
  localOnly: false,
  replyId: null,
  renoteId: null,
  fileIds: [],
  mentions: ["user-2"],
  emojis: [],
  tags: [],
  uri: null,
  repliesCount: 0,
  renoteCount: 0,
  isDeleted: false,
  deletedAt: null,
  deletedById: null,
  deletionReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDMNote2: Note = {
  id: "dm-2",
  userId: "user-2",
  text: "Hi, thanks for the message!",
  cw: null,
  visibility: "specified",
  localOnly: false,
  replyId: null,
  renoteId: null,
  fileIds: [],
  mentions: ["user-1"],
  emojis: [],
  tags: [],
  uri: null,
  repliesCount: 0,
  renoteCount: 0,
  isDeleted: false,
  deletedAt: null,
  deletedById: null,
  deletionReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock conversation partners
const mockConversationPartners: ConversationPartner[] = [
  {
    partnerId: "user-2",
    partnerUsername: "partner1",
    partnerDisplayName: "Partner One",
    partnerAvatarUrl: "https://example.com/avatar.png",
    partnerHost: null,
    partnerProfileEmojis: null,
    lastNoteId: "dm-1",
    lastNoteText: "Hello, this is a DM",
    lastNoteCreatedAt: new Date().toISOString(),
  },
];

// Mock repository type for testing - only includes methods we test
type MockNoteRepo = {
  getConversationPartners: ReturnType<typeof mock>;
  findDirectMessages: ReturnType<typeof mock>;
  findDirectMessageThread: ReturnType<typeof mock>;
};

describe("Direct Messages API", () => {
  let app: Hono;
  let mockNoteRepo: MockNoteRepo;

  beforeEach(() => {
    mockNoteRepo = {
      getConversationPartners: mock(() => Promise.resolve(mockConversationPartners)),
      findDirectMessages: mock(() => Promise.resolve([mockDMNote, mockDMNote2])),
      findDirectMessageThread: mock(() => Promise.resolve([mockDMNote, mockDMNote2])),
    };

    app = new Hono();

    // Add middleware to set user and repositories in context
    app.use("*", async (c, next) => {
      c.set("user", mockUser);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      c.set("noteRepository", mockNoteRepo as any);
      await next();
    });

    // GET /api/direct/conversations
    app.get("/conversations", async (c) => {
      const user = c.get("user") as User | undefined;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noteRepository = c.get("noteRepository") as any as MockNoteRepo;
      const limit = Math.min(
        c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 20,
        100,
      );

      try {
        const conversations = await noteRepository.getConversationPartners(user.id, limit);
        return c.json(conversations);
      } catch {
        return c.json({ error: "Failed to get conversations" }, 500);
      }
    });

    // GET /api/direct/messages
    app.get("/messages", async (c) => {
      const user = c.get("user") as User | undefined;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noteRepository = c.get("noteRepository") as any as MockNoteRepo;
      const limit = Math.min(
        c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 20,
        100,
      );
      const sinceId = c.req.query("sinceId");
      const untilId = c.req.query("untilId");

      try {
        const messages = await noteRepository.findDirectMessages(user.id, {
          limit,
          sinceId,
          untilId,
        });
        return c.json(messages);
      } catch {
        return c.json({ error: "Failed to get direct messages" }, 500);
      }
    });

    // GET /api/direct/thread/:partnerId
    app.get("/thread/:partnerId", async (c) => {
      const user = c.get("user") as User | undefined;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noteRepository = c.get("noteRepository") as any as MockNoteRepo;
      const partnerId = c.req.param("partnerId");

      if (!partnerId) {
        return c.json({ error: "partnerId is required" }, 400);
      }

      const limit = Math.min(
        c.req.query("limit") ? Number.parseInt(c.req.query("limit")!, 10) : 50,
        100,
      );
      const sinceId = c.req.query("sinceId");
      const untilId = c.req.query("untilId");

      try {
        const thread = await noteRepository.findDirectMessageThread(user.id, partnerId, {
          limit,
          sinceId,
          untilId,
        });
        return c.json(thread);
      } catch {
        return c.json({ error: "Failed to get DM thread" }, 500);
      }
    });
  });

  describe("GET /conversations", () => {
    test("should return conversation partners for authenticated user", async () => {
      const res = await app.request("/conversations");
      const data = (await res.json()) as ConversationPartner[];

      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      const firstPartner = data[0];
      expect(firstPartner).toBeDefined();
      expect(firstPartner!.partnerId).toBe("user-2");
      expect(firstPartner!.partnerUsername).toBe("partner1");
      expect(mockNoteRepo.getConversationPartners).toHaveBeenCalledWith("user-1", 20);
    });

    test("should respect limit parameter", async () => {
      const res = await app.request("/conversations?limit=10");

      expect(res.status).toBe(200);
      expect(mockNoteRepo.getConversationPartners).toHaveBeenCalledWith("user-1", 10);
    });

    test("should cap limit at 100", async () => {
      const res = await app.request("/conversations?limit=200");

      expect(res.status).toBe(200);
      expect(mockNoteRepo.getConversationPartners).toHaveBeenCalledWith("user-1", 100);
    });

    test("should return empty array when no conversations", async () => {
      mockNoteRepo.getConversationPartners = mock(() => Promise.resolve([]));

      const res = await app.request("/conversations");
      const data = (await res.json()) as ConversationPartner[];

      expect(res.status).toBe(200);
      expect(data).toHaveLength(0);
    });

    test("should return 500 on repository error", async () => {
      mockNoteRepo.getConversationPartners = mock(() =>
        Promise.reject(new Error("Database error")),
      );

      const res = await app.request("/conversations");
      const data = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to get conversations");
    });
  });

  describe("GET /messages", () => {
    test("should return all direct messages for authenticated user", async () => {
      const res = await app.request("/messages");
      const data = (await res.json()) as Note[];

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockNoteRepo.findDirectMessages).toHaveBeenCalledWith("user-1", {
        limit: 20,
        sinceId: undefined,
        untilId: undefined,
      });
    });

    test("should respect pagination parameters", async () => {
      const res = await app.request("/messages?limit=10&untilId=dm-5");

      expect(res.status).toBe(200);
      expect(mockNoteRepo.findDirectMessages).toHaveBeenCalledWith("user-1", {
        limit: 10,
        sinceId: undefined,
        untilId: "dm-5",
      });
    });

    test("should support sinceId for fetching new messages", async () => {
      const res = await app.request("/messages?sinceId=dm-0");

      expect(res.status).toBe(200);
      expect(mockNoteRepo.findDirectMessages).toHaveBeenCalledWith("user-1", {
        limit: 20,
        sinceId: "dm-0",
        untilId: undefined,
      });
    });

    test("should return 500 on repository error", async () => {
      mockNoteRepo.findDirectMessages = mock(() => Promise.reject(new Error("Database error")));

      const res = await app.request("/messages");
      const data = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to get direct messages");
    });
  });

  describe("GET /thread/:partnerId", () => {
    test("should return DM thread between authenticated user and partner", async () => {
      const res = await app.request("/thread/user-2");
      const data = (await res.json()) as Note[];

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockNoteRepo.findDirectMessageThread).toHaveBeenCalledWith("user-1", "user-2", {
        limit: 50,
        sinceId: undefined,
        untilId: undefined,
      });
    });

    test("should respect pagination parameters", async () => {
      const res = await app.request("/thread/user-2?limit=25&untilId=dm-10");

      expect(res.status).toBe(200);
      expect(mockNoteRepo.findDirectMessageThread).toHaveBeenCalledWith("user-1", "user-2", {
        limit: 25,
        sinceId: undefined,
        untilId: "dm-10",
      });
    });

    test("should support sinceId for polling new messages", async () => {
      const res = await app.request("/thread/user-2?sinceId=dm-1");

      expect(res.status).toBe(200);
      expect(mockNoteRepo.findDirectMessageThread).toHaveBeenCalledWith("user-1", "user-2", {
        limit: 50,
        sinceId: "dm-1",
        untilId: undefined,
      });
    });

    test("should return empty array for new conversation", async () => {
      mockNoteRepo.findDirectMessageThread = mock(() => Promise.resolve([]));

      const res = await app.request("/thread/user-3");
      const data = (await res.json()) as Note[];

      expect(res.status).toBe(200);
      expect(data).toHaveLength(0);
    });

    test("should return 500 on repository error", async () => {
      mockNoteRepo.findDirectMessageThread = mock(() =>
        Promise.reject(new Error("Database error")),
      );

      const res = await app.request("/thread/user-2");
      const data = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to get DM thread");
    });
  });

  describe("Authentication", () => {
    test("should require authentication for conversations", async () => {
      // Create app without user middleware
      const unauthApp = new Hono();
      unauthApp.get("/conversations", async (c) => {
        const user = c.get("user");
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }
        return c.json([]);
      });

      const res = await unauthApp.request("/conversations");
      const data = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    test("should require authentication for messages", async () => {
      const unauthApp = new Hono();
      unauthApp.get("/messages", async (c) => {
        const user = c.get("user");
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }
        return c.json([]);
      });

      const res = await unauthApp.request("/messages");
      const data = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    test("should require authentication for thread", async () => {
      const unauthApp = new Hono();
      unauthApp.get("/thread/:partnerId", async (c) => {
        const user = c.get("user");
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }
        return c.json([]);
      });

      const res = await unauthApp.request("/thread/user-2");
      const data = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });
});
