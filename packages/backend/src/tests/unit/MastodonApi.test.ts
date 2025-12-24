import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { Context } from "hono";
import { Hono } from "hono";
import mastodonRoutes from "../../routes/mastodon.js";

/**
 * Helper to set context values in tests without type errors
 * This is needed because the Hono context has strict typing for c.set()
 */
const setMock = (c: Context, key: string, value: unknown) => {
  (c.set as (k: string, v: unknown) => void)(key, value);
};

// Helper type for JSON responses in tests
// biome-ignore lint/suspicious/noExplicitAny: Flexible type for test JSON responses
type JsonResponse = any;

/**
 * Unit tests for Mastodon Compatible API endpoints
 *
 * Tests the following endpoints:
 * - GET /api/v1/statuses/:id
 * - GET /api/v1/accounts/:id
 * - GET /api/v1/accounts/:id/statuses
 */

describe("Mastodon API - GET /statuses/:id", () => {
  let app: Hono;

  const mockNote = {
    id: "note123",
    userId: "user123",
    text: "Hello, world!",
    cw: null,
    visibility: "public" as const,
    localOnly: false,
    replyId: null,
    renoteId: null,
    fileIds: [],
    mentions: [],
    emojis: [],
    tags: ["test"],
    uri: null,
    repliesCount: 0,
    renoteCount: 0,
    isDeleted: false,
    deletedAt: null,
    deletedById: null,
    deletionReason: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };

  const mockUser = {
    id: "user123",
    username: "alice",
    displayName: "Alice",
    bio: "Hello!",
    host: null,
    avatarUrl: "https://example.com/avatar.jpg",
    bannerUrl: null,
    followersCount: 10,
    followingCount: 5,
    isDeleted: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    app = new Hono();

    // Set up mock repositories via middleware
    app.use("*", async (c, next) => {
      setMock(c, "noteRepository", {
        findById: mock((id: string) => {
          if (id === "note123") return Promise.resolve(mockNote);
          return Promise.resolve(null);
        }),
        countByUserId: mock(() => Promise.resolve(42)),
      });
      setMock(c, "userRepository", {
        findById: mock((id: string) => {
          if (id === "user123") return Promise.resolve(mockUser);
          return Promise.resolve(null);
        }),
      });
      setMock(c, "driveFileRepository", {
        findByIds: mock(() => Promise.resolve([])),
      });
      await next();
    });

    app.route("/", mastodonRoutes);
  });

  it("should return a status for a valid note ID", async () => {
    const res = await app.request("/statuses/note123");
    expect(res.status).toBe(200);

    const data: JsonResponse = await res.json();
    expect(data.id).toBe("note123");
    expect(data.content).toContain("Hello, world!");
    expect(data.visibility).toBe("public");
    expect(data.account.username).toBe("alice");
    expect(data.account.display_name).toBe("Alice");
    expect(data.tags).toHaveLength(1);
    expect(data.tags[0].name).toBe("test");
  });

  it("should return 404 for non-existent note", async () => {
    const res = await app.request("/statuses/nonexistent");
    expect(res.status).toBe(404);

    const data: JsonResponse = await res.json();
    expect(data.error).toBe("Record not found");
  });

  it("should return 404 for deleted note", async () => {
    // Update mock to return deleted note
    app = new Hono();
    app.use("*", async (c, next) => {
      setMock(c, "noteRepository", {
        findById: mock(() =>
          Promise.resolve({ ...mockNote, isDeleted: true })
        ),
        countByUserId: mock(() => Promise.resolve(42)),
      });
      setMock(c, "userRepository", {
        findById: mock(() => Promise.resolve(mockUser)),
      });
      setMock(c, "driveFileRepository", {
        findByIds: mock(() => Promise.resolve([])),
      });
      await next();
    });
    app.route("/", mastodonRoutes);

    const res = await app.request("/statuses/note123");
    expect(res.status).toBe(404);
  });

  it("should handle note with content warning", async () => {
    app = new Hono();
    app.use("*", async (c, next) => {
      setMock(c, "noteRepository", {
        findById: mock(() =>
          Promise.resolve({ ...mockNote, cw: "Spoiler!" })
        ),
        countByUserId: mock(() => Promise.resolve(42)),
      });
      setMock(c, "userRepository", {
        findById: mock(() => Promise.resolve(mockUser)),
      });
      setMock(c, "driveFileRepository", {
        findByIds: mock(() => Promise.resolve([])),
      });
      await next();
    });
    app.route("/", mastodonRoutes);

    const res = await app.request("/statuses/note123");
    expect(res.status).toBe(200);

    const data: JsonResponse = await res.json();
    expect(data.sensitive).toBe(true);
    expect(data.spoiler_text).toBe("Spoiler!");
  });

  it("should convert visibility correctly", async () => {
    const testVisibility = async (
      visibility: "public" | "home" | "followers" | "specified",
      expected: string
    ) => {
      const testApp = new Hono();
      testApp.use("*", async (c, next) => {
        setMock(c, "noteRepository", {
          findById: mock(() =>
            Promise.resolve({ ...mockNote, visibility })
          ),
          countByUserId: mock(() => Promise.resolve(42)),
        });
        setMock(c, "userRepository", {
          findById: mock(() => Promise.resolve(mockUser)),
        });
        setMock(c, "driveFileRepository", {
          findByIds: mock(() => Promise.resolve([])),
        });
        await next();
      });
      testApp.route("/", mastodonRoutes);

      const res = await testApp.request("/statuses/note123");
      const data: JsonResponse = await res.json();
      expect(data.visibility).toBe(expected);
    };

    await testVisibility("public", "public");
    await testVisibility("home", "unlisted");
    await testVisibility("followers", "private");
    await testVisibility("specified", "direct");
  });

  it("should include media attachments", async () => {
    app = new Hono();
    app.use("*", async (c, next) => {
      setMock(c, "noteRepository", {
        findById: mock(() =>
          Promise.resolve({ ...mockNote, fileIds: ["file1"] })
        ),
        countByUserId: mock(() => Promise.resolve(42)),
      });
      setMock(c, "userRepository", {
        findById: mock(() => Promise.resolve(mockUser)),
      });
      setMock(c, "driveFileRepository", {
        findByIds: mock(() =>
          Promise.resolve([
            {
              id: "file1",
              type: "image/jpeg",
              url: "https://example.com/image.jpg",
              thumbnailUrl: "https://example.com/thumb.jpg",
              comment: "A photo",
              blurhash: "LEHV6nWB2yk8",
            },
          ])
        ),
      });
      await next();
    });
    app.route("/", mastodonRoutes);

    const res = await app.request("/statuses/note123");
    expect(res.status).toBe(200);

    const data: JsonResponse = await res.json();
    expect(data.media_attachments).toHaveLength(1);
    expect(data.media_attachments[0].type).toBe("image");
    expect(data.media_attachments[0].description).toBe("A photo");
  });
});

describe("Mastodon API - GET /accounts/:id", () => {
  let app: Hono;

  const mockUser = {
    id: "user123",
    username: "alice",
    displayName: "Alice",
    bio: "Hello!",
    host: null,
    avatarUrl: "https://example.com/avatar.jpg",
    bannerUrl: "https://example.com/banner.jpg",
    followersCount: 10,
    followingCount: 5,
    isDeleted: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    app = new Hono();
    app.use("*", async (c, next) => {
      setMock(c, "userRepository", {
        findById: mock((id: string) => {
          if (id === "user123") return Promise.resolve(mockUser);
          return Promise.resolve(null);
        }),
      });
      setMock(c, "noteRepository", {
        countByUserId: mock(() => Promise.resolve(42)),
      });
      await next();
    });
    app.route("/", mastodonRoutes);
  });

  it("should return an account for a valid user ID", async () => {
    const res = await app.request("/accounts/user123");
    expect(res.status).toBe(200);

    const data: JsonResponse = await res.json();
    expect(data.id).toBe("user123");
    expect(data.username).toBe("alice");
    expect(data.acct).toBe("alice");
    expect(data.display_name).toBe("Alice");
    expect(data.note).toBe("Hello!");
    expect(data.followers_count).toBe(10);
    expect(data.following_count).toBe(5);
    expect(data.statuses_count).toBe(42);
    expect(data.header).toBe("https://example.com/banner.jpg");
  });

  it("should return 404 for non-existent user", async () => {
    const res = await app.request("/accounts/nonexistent");
    expect(res.status).toBe(404);

    const data: JsonResponse = await res.json();
    expect(data.error).toBe("Record not found");
  });

  it("should return 404 for deleted user", async () => {
    app = new Hono();
    app.use("*", async (c, next) => {
      setMock(c, "userRepository", {
        findById: mock(() =>
          Promise.resolve({ ...mockUser, isDeleted: true })
        ),
      });
      setMock(c, "noteRepository", {
        countByUserId: mock(() => Promise.resolve(42)),
      });
      await next();
    });
    app.route("/", mastodonRoutes);

    const res = await app.request("/accounts/user123");
    expect(res.status).toBe(404);
  });

  it("should handle remote user with host", async () => {
    app = new Hono();
    app.use("*", async (c, next) => {
      setMock(c, "userRepository", {
        findById: mock(() =>
          Promise.resolve({ ...mockUser, host: "mastodon.social" })
        ),
      });
      setMock(c, "noteRepository", {
        countByUserId: mock(() => Promise.resolve(42)),
      });
      await next();
    });
    app.route("/", mastodonRoutes);

    const res = await app.request("/accounts/user123");
    expect(res.status).toBe(200);

    const data: JsonResponse = await res.json();
    expect(data.acct).toBe("alice@mastodon.social");
    expect(data.url).toBe("https://mastodon.social/@alice");
  });
});

describe("Mastodon API - GET /accounts/:id/statuses", () => {
  let app: Hono;

  const mockUser = {
    id: "user123",
    username: "alice",
    displayName: "Alice",
    bio: "Hello!",
    host: null,
    avatarUrl: "https://example.com/avatar.jpg",
    bannerUrl: null,
    followersCount: 10,
    followingCount: 5,
    isDeleted: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };

  const mockNotes = [
    {
      id: "note1",
      userId: "user123",
      text: "First post",
      cw: null,
      visibility: "public" as const,
      localOnly: false,
      replyId: null,
      renoteId: null,
      fileIds: [],
      mentions: [],
      emojis: [],
      tags: [],
      uri: null,
      repliesCount: 0,
      renoteCount: 0,
      isDeleted: false,
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
      createdAt: new Date("2025-01-02T00:00:00Z"),
      updatedAt: new Date("2025-01-02T00:00:00Z"),
    },
    {
      id: "note2",
      userId: "user123",
      text: "Second post",
      cw: null,
      visibility: "public" as const,
      localOnly: false,
      replyId: null,
      renoteId: null,
      fileIds: [],
      mentions: [],
      emojis: [],
      tags: [],
      uri: null,
      repliesCount: 0,
      renoteCount: 0,
      isDeleted: false,
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    },
  ];

  beforeEach(() => {
    app = new Hono();
    app.use("*", async (c, next) => {
      setMock(c, "userRepository", {
        findById: mock((id: string) => {
          if (id === "user123") return Promise.resolve(mockUser);
          return Promise.resolve(null);
        }),
      });
      setMock(c, "noteRepository", {
        countByUserId: mock(() => Promise.resolve(2)),
        findByUserId: mock(() => Promise.resolve(mockNotes)),
      });
      setMock(c, "driveFileRepository", {
        findByIds: mock(() => Promise.resolve([])),
      });
      await next();
    });
    app.route("/", mastodonRoutes);
  });

  it("should return statuses for a valid user ID", async () => {
    const res = await app.request("/accounts/user123/statuses");
    expect(res.status).toBe(200);

    const data: JsonResponse = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe("note1");
    expect(data[1].id).toBe("note2");
    expect(data[0].account.username).toBe("alice");
  });

  it("should return 404 for non-existent user", async () => {
    const res = await app.request("/accounts/nonexistent/statuses");
    expect(res.status).toBe(404);
  });

  it("should respect limit parameter", async () => {
    app = new Hono();
    let capturedOptions: unknown;
    app.use("*", async (c, next) => {
      setMock(c, "userRepository", {
        findById: mock(() => Promise.resolve(mockUser)),
      });
      setMock(c, "noteRepository", {
        countByUserId: mock(() => Promise.resolve(2)),
        findByUserId: mock((_userId: string, options: unknown) => {
          capturedOptions = options;
          return Promise.resolve(mockNotes);
        }),
      });
      setMock(c, "driveFileRepository", {
        findByIds: mock(() => Promise.resolve([])),
      });
      await next();
    });
    app.route("/", mastodonRoutes);

    await app.request("/accounts/user123/statuses?limit=10");
    expect((capturedOptions as { limit: number }).limit).toBe(10);
  });

  it("should respect max_id parameter", async () => {
    app = new Hono();
    let capturedOptions: unknown;
    app.use("*", async (c, next) => {
      setMock(c, "userRepository", {
        findById: mock(() => Promise.resolve(mockUser)),
      });
      setMock(c, "noteRepository", {
        countByUserId: mock(() => Promise.resolve(2)),
        findByUserId: mock((_userId: string, options: unknown) => {
          capturedOptions = options;
          return Promise.resolve(mockNotes);
        }),
      });
      setMock(c, "driveFileRepository", {
        findByIds: mock(() => Promise.resolve([])),
      });
      await next();
    });
    app.route("/", mastodonRoutes);

    await app.request("/accounts/user123/statuses?max_id=oldnote123");
    expect((capturedOptions as { untilId: string }).untilId).toBe("oldnote123");
  });

  it("should skip deleted notes", async () => {
    app = new Hono();
    app.use("*", async (c, next) => {
      setMock(c, "userRepository", {
        findById: mock(() => Promise.resolve(mockUser)),
      });
      setMock(c, "noteRepository", {
        countByUserId: mock(() => Promise.resolve(2)),
        findByUserId: mock(() =>
          Promise.resolve([
            mockNotes[0],
            { ...mockNotes[1], isDeleted: true },
          ])
        ),
      });
      setMock(c, "driveFileRepository", {
        findByIds: mock(() => Promise.resolve([])),
      });
      await next();
    });
    app.route("/", mastodonRoutes);

    const res = await app.request("/accounts/user123/statuses");
    const data: JsonResponse = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("note1");
  });
});
