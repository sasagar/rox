/**
 * SQLite Repository Integration Tests (Node.js/Vitest)
 *
 * Tests SQLite repository implementations with an actual SQLite database.
 * This file uses Vitest and runs in Node.js to support better-sqlite3.
 *
 * Run with: bun run test:sqlite
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema/sqlite.js";
import { SqliteNoteRepository } from "../../repositories/sqlite/SqliteNoteRepository.js";
import { SqliteUserRepository } from "../../repositories/sqlite/SqliteUserRepository.js";
import { SqliteSessionRepository } from "../../repositories/sqlite/SqliteSessionRepository.js";
import { SqliteFollowRepository } from "../../repositories/sqlite/SqliteFollowRepository.js";
import { SqliteInstanceBlockRepository } from "../../repositories/sqlite/SqliteInstanceBlockRepository.js";
import { randomUUID } from "crypto";
import type { User, Session, Follow, Note } from "shared";

const uuidv4 = randomUUID;

// NoteCreateInput matches the type expected by SqliteNoteRepository.create
type NoteCreateInput = Omit<Note, "createdAt" | "updatedAt" | "repliesCount" | "renoteCount"> & {
  repliesCount?: number;
  renoteCount?: number;
};

// Extended Note type returned by findById (includes user info)
interface NoteWithUser extends Note {
  user?: {
    id: string;
    username: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    host: string | null;
    profileEmojis: unknown;
  };
}

/**
 * Creates a complete Note object with all required fields for testing
 */
function createTestNote(overrides: {
  id: string;
  userId: string;
  text: string;
  visibility?: "public" | "home" | "followers" | "specified";
  localOnly?: boolean;
}): NoteCreateInput {
  return {
    id: overrides.id,
    userId: overrides.userId,
    text: overrides.text,
    cw: null,
    visibility: overrides.visibility ?? "public",
    localOnly: overrides.localOnly ?? false,
    replyId: null,
    renoteId: null,
    fileIds: [],
    mentions: [],
    emojis: [],
    tags: [],
    uri: null,
    isDeleted: false,
    deletedAt: null,
    deletedById: null,
    deletionReason: null,
  };
}

/**
 * Creates a complete User object with all required fields for testing
 */
function createTestUser(overrides: {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  isAdmin?: boolean;
}): Omit<User, "createdAt" | "updatedAt"> {
  return {
    id: overrides.id,
    username: overrides.username,
    email: overrides.email,
    passwordHash: overrides.passwordHash,
    displayName: null,
    bio: null,
    avatarUrl: null,
    bannerUrl: null,
    isAdmin: overrides.isAdmin ?? false,
    isSuspended: false,
    isDeleted: false,
    deletedAt: null,
    isSystemUser: false,
    publicKey: null,
    privateKey: null,
    host: null,
    inbox: null,
    outbox: null,
    followersUrl: null,
    followingUrl: null,
    uri: null,
    sharedInbox: null,
    customCss: null,
    uiSettings: null,
    alsoKnownAs: null,
    movedTo: null,
    movedAt: null,
    profileEmojis: null,
    storageQuotaMb: null,
    goneDetectedAt: null,
    fetchFailureCount: 0,
    lastFetchAttemptAt: null,
    lastFetchError: null,
    followersCount: 0,
    followingCount: 0,
  };
}

/**
 * Creates a complete Session object with all required fields for testing
 */
function createTestSession(overrides: {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}): Omit<Session, "createdAt" | "updatedAt"> {
  return {
    id: overrides.id,
    userId: overrides.userId,
    token: overrides.token,
    expiresAt: overrides.expiresAt,
    userAgent: null,
    ipAddress: null,
  };
}

/**
 * Creates a complete Follow object with all required fields for testing
 */
function createTestFollow(overrides: {
  id: string;
  followerId: string;
  followeeId: string;
}): Omit<Follow, "createdAt" | "updatedAt"> {
  return {
    id: overrides.id,
    followerId: overrides.followerId,
    followeeId: overrides.followeeId,
  };
}

describe("SQLite Repository Integration Tests", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(() => {
    // Create in-memory SQLite database for testing
    sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });

    // Create tables manually for testing (must match Drizzle schema column names exactly)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        bio TEXT,
        avatar_url TEXT,
        banner_url TEXT,
        is_admin INTEGER NOT NULL DEFAULT 0,
        is_suspended INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        is_system_user INTEGER NOT NULL DEFAULT 0,
        public_key TEXT,
        private_key TEXT,
        host TEXT,
        inbox TEXT,
        outbox TEXT,
        followers_url TEXT,
        following_url TEXT,
        uri TEXT,
        shared_inbox TEXT,
        also_known_as TEXT DEFAULT '[]',
        moved_to TEXT,
        moved_at INTEGER,
        custom_css TEXT,
        ui_settings TEXT,
        profile_emojis TEXT DEFAULT '[]',
        storage_quota_mb INTEGER,
        gone_detected_at INTEGER,
        fetch_failure_count INTEGER NOT NULL DEFAULT 0,
        last_fetch_attempt_at INTEGER,
        last_fetch_error TEXT,
        followers_count INTEGER NOT NULL DEFAULT 0,
        following_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        text TEXT,
        cw TEXT,
        visibility TEXT NOT NULL DEFAULT 'public',
        local_only INTEGER NOT NULL DEFAULT 0,
        reply_id TEXT REFERENCES notes(id),
        renote_id TEXT REFERENCES notes(id),
        file_ids TEXT DEFAULT '[]',
        mentions TEXT DEFAULT '[]',
        emojis TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        uri TEXT UNIQUE,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        deleted_by_id TEXT REFERENCES users(id),
        deletion_reason TEXT,
        replies_count INTEGER NOT NULL DEFAULT 0,
        renote_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS follows (
        id TEXT PRIMARY KEY,
        follower_id TEXT NOT NULL REFERENCES users(id),
        followee_id TEXT NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(follower_id, followee_id)
      );

      CREATE TABLE IF NOT EXISTS instance_blocks (
        id TEXT PRIMARY KEY,
        host TEXT NOT NULL UNIQUE,
        reason TEXT,
        blocked_by_id TEXT NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL
      );
    `);
  });

  afterAll(() => {
    sqlite.close();
  });

  describe("SqliteUserRepository", () => {
    let userRepo: SqliteUserRepository;

    beforeAll(() => {
      userRepo = new SqliteUserRepository(db);
    });

    beforeEach(() => {
      // Clean up users table before each test
      sqlite.exec("DELETE FROM notes");
      sqlite.exec("DELETE FROM sessions");
      sqlite.exec("DELETE FROM follows");
      sqlite.exec("DELETE FROM users");
    });

    test("should create a user", async () => {
      const userId = uuidv4();
      const user = await userRepo.create(
        createTestUser({
          id: userId,
          username: "testuser",
          email: "test@example.com",
          passwordHash: "hashedpassword",
        })
      );

      expect(user.id).toBe(userId);
      expect(user.username).toBe("testuser");
      expect(user.email).toBe("test@example.com");
    });

    test("should find user by id", async () => {
      const userId = uuidv4();
      await userRepo.create(
        createTestUser({
          id: userId,
          username: "findbyid",
          email: "findbyid@example.com",
          passwordHash: "hash",
        })
      );

      const found = await userRepo.findById(userId);
      expect(found).not.toBeNull();
      expect(found?.username).toBe("findbyid");
    });

    test("should find user by username", async () => {
      const userId = uuidv4();
      await userRepo.create(
        createTestUser({
          id: userId,
          username: "findbyusername",
          email: "findbyusername@example.com",
          passwordHash: "hash",
        })
      );

      const found = await userRepo.findByUsername("findbyusername");
      expect(found).not.toBeNull();
      expect(found?.id).toBe(userId);
    });

    test("should return null for non-existent user", async () => {
      const found = await userRepo.findById("non-existent-id");
      expect(found).toBeNull();
    });

    test("should update user", async () => {
      const userId = uuidv4();
      await userRepo.create(
        createTestUser({
          id: userId,
          username: "updateuser",
          email: "update@example.com",
          passwordHash: "hash",
        })
      );

      const updated = await userRepo.update(userId, {
        displayName: "Updated Display Name",
        bio: "Updated bio",
      });

      expect(updated.displayName).toBe("Updated Display Name");
      expect(updated.bio).toBe("Updated bio");
    });

    test("should count users", async () => {
      const count1 = await userRepo.count();
      expect(count1).toBe(0);

      await userRepo.create(
        createTestUser({
          id: uuidv4(),
          username: "user1",
          email: "user1@example.com",
          passwordHash: "hash",
        })
      );

      const count2 = await userRepo.count();
      expect(count2).toBe(1);
    });
  });

  describe("SqliteNoteRepository", () => {
    let noteRepo: SqliteNoteRepository;
    let testUserId: string;

    beforeAll(async () => {
      noteRepo = new SqliteNoteRepository(db);
      const userRepo = new SqliteUserRepository(db);

      // Create a test user for notes
      testUserId = uuidv4();
      await userRepo.create(
        createTestUser({
          id: testUserId,
          username: "noteuser",
          email: "noteuser@example.com",
          passwordHash: "hash",
        })
      );
    });

    beforeEach(() => {
      // Clean up notes table before each test
      sqlite.exec(`DELETE FROM notes WHERE user_id != '${testUserId}'`);
    });

    test("should create a note", async () => {
      const noteId = uuidv4();
      const note = await noteRepo.create(
        createTestNote({
          id: noteId,
          userId: testUserId,
          text: "Hello, world!",
        })
      );

      expect(note.id).toBe(noteId);
      expect(note.text).toBe("Hello, world!");
      expect(note.userId).toBe(testUserId);
    });

    test("should find note by id with user", async () => {
      const noteId = uuidv4();
      await noteRepo.create(
        createTestNote({
          id: noteId,
          userId: testUserId,
          text: "Find me!",
        })
      );

      const found = (await noteRepo.findById(noteId)) as NoteWithUser | null;
      expect(found).not.toBeNull();
      expect(found?.text).toBe("Find me!");
      expect(found?.user).toBeDefined();
      expect(found?.user?.username).toBe("noteuser");
    });

    test("should return null for non-existent note", async () => {
      const found = await noteRepo.findById("non-existent-note-id");
      expect(found).toBeNull();
    });

    test("should soft delete a note", async () => {
      const noteId = uuidv4();
      await noteRepo.create(
        createTestNote({
          id: noteId,
          userId: testUserId,
          text: "Delete me!",
        })
      );

      const deleted = await noteRepo.softDelete(noteId, testUserId, "Test deletion");
      expect(deleted?.isDeleted).toBe(true);
      expect(deleted?.deletedById).toBe(testUserId);
      expect(deleted?.deletionReason).toBe("Test deletion");
    });

    test("should restore a soft-deleted note", async () => {
      const noteId = uuidv4();
      await noteRepo.create(
        createTestNote({
          id: noteId,
          userId: testUserId,
          text: "Restore me!",
        })
      );

      await noteRepo.softDelete(noteId, testUserId);
      const restored = await noteRepo.restore(noteId);

      expect(restored?.isDeleted).toBe(false);
      expect(restored?.deletedById).toBeNull();
    });

    test("should increment and decrement replies count", async () => {
      const noteId = uuidv4();
      await noteRepo.create(
        createTestNote({
          id: noteId,
          userId: testUserId,
          text: "Count replies!",
        })
      );

      await noteRepo.incrementRepliesCount(noteId);
      await noteRepo.incrementRepliesCount(noteId);

      let note = await noteRepo.findById(noteId);
      expect(note?.repliesCount).toBe(2);

      await noteRepo.decrementRepliesCount(noteId);
      note = await noteRepo.findById(noteId);
      expect(note?.repliesCount).toBe(1);
    });

    test("should count notes", async () => {
      // Clear all notes first
      sqlite.exec("DELETE FROM notes");

      const noteId1 = uuidv4();
      const noteId2 = uuidv4();

      await noteRepo.create(
        createTestNote({
          id: noteId1,
          userId: testUserId,
          text: "Note 1",
        })
      );

      await noteRepo.create(
        createTestNote({
          id: noteId2,
          userId: testUserId,
          text: "Note 2",
        })
      );

      const count = await noteRepo.count();
      expect(count).toBe(2);
    });
  });

  describe("SqliteSessionRepository", () => {
    let sessionRepo: SqliteSessionRepository;
    let testUserId: string;

    beforeAll(async () => {
      sessionRepo = new SqliteSessionRepository(db);
      const userRepo = new SqliteUserRepository(db);

      // Create a test user for sessions
      testUserId = uuidv4();
      await userRepo.create(
        createTestUser({
          id: testUserId,
          username: "sessionuser",
          email: "sessionuser@example.com",
          passwordHash: "hash",
        })
      );
    });

    beforeEach(() => {
      sqlite.exec("DELETE FROM sessions");
    });

    test("should create a session", async () => {
      const sessionId = uuidv4();
      const session = await sessionRepo.create(
        createTestSession({
          id: sessionId,
          userId: testUserId,
          token: "test-token-" + sessionId,
          expiresAt: new Date(Date.now() + 86400000),
        })
      );

      expect(session.id).toBe(sessionId);
      expect(session.userId).toBe(testUserId);
    });

    test("should find session by token", async () => {
      const sessionId = uuidv4();
      const token = "find-token-" + sessionId;
      await sessionRepo.create(
        createTestSession({
          id: sessionId,
          userId: testUserId,
          token,
          expiresAt: new Date(Date.now() + 86400000),
        })
      );

      const found = await sessionRepo.findByToken(token);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(sessionId);
    });

    test("should delete session", async () => {
      const sessionId = uuidv4();
      await sessionRepo.create(
        createTestSession({
          id: sessionId,
          userId: testUserId,
          token: "delete-token-" + sessionId,
          expiresAt: new Date(Date.now() + 86400000),
        })
      );

      await sessionRepo.delete(sessionId);
      const found = await sessionRepo.findById(sessionId);
      expect(found).toBeNull();
    });

    test("should delete expired sessions", async () => {
      const expiredId = uuidv4();
      const validId = uuidv4();

      // Create expired session
      await sessionRepo.create(
        createTestSession({
          id: expiredId,
          userId: testUserId,
          token: "expired-token",
          expiresAt: new Date(Date.now() - 86400000), // Yesterday
        })
      );

      // Create valid session
      await sessionRepo.create(
        createTestSession({
          id: validId,
          userId: testUserId,
          token: "valid-token",
          expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        })
      );

      const deletedCount = await sessionRepo.deleteExpired();
      expect(deletedCount).toBe(1);

      const expiredSession = await sessionRepo.findById(expiredId);
      const validSession = await sessionRepo.findById(validId);

      expect(expiredSession).toBeNull();
      expect(validSession).not.toBeNull();
    });
  });

  describe("SqliteFollowRepository", () => {
    let followRepo: SqliteFollowRepository;
    let user1Id: string;
    let user2Id: string;

    beforeAll(async () => {
      followRepo = new SqliteFollowRepository(db);
      const userRepo = new SqliteUserRepository(db);

      user1Id = uuidv4();
      user2Id = uuidv4();

      await userRepo.create(
        createTestUser({
          id: user1Id,
          username: "follower",
          email: "follower@example.com",
          passwordHash: "hash",
        })
      );

      await userRepo.create(
        createTestUser({
          id: user2Id,
          username: "followee",
          email: "followee@example.com",
          passwordHash: "hash",
        })
      );
    });

    beforeEach(() => {
      sqlite.exec("DELETE FROM follows");
    });

    test("should create a follow relationship", async () => {
      const followId = uuidv4();
      const follow = await followRepo.create(
        createTestFollow({
          id: followId,
          followerId: user1Id,
          followeeId: user2Id,
        })
      );

      expect(follow.id).toBe(followId);
      expect(follow.followerId).toBe(user1Id);
      expect(follow.followeeId).toBe(user2Id);
    });

    test("should check if following", async () => {
      const followId = uuidv4();
      await followRepo.create(
        createTestFollow({
          id: followId,
          followerId: user1Id,
          followeeId: user2Id,
        })
      );

      const isFollowing = await followRepo.exists(user1Id, user2Id);
      expect(isFollowing).toBe(true);

      const notFollowing = await followRepo.exists(user2Id, user1Id);
      expect(notFollowing).toBe(false);
    });

    test("should get followers", async () => {
      const followId = uuidv4();
      await followRepo.create(
        createTestFollow({
          id: followId,
          followerId: user1Id,
          followeeId: user2Id,
        })
      );

      const followers = await followRepo.findByFolloweeId(user2Id);
      expect(followers.length).toBe(1);
      expect(followers[0]?.followerId).toBe(user1Id);
    });

    test("should get following", async () => {
      const followId = uuidv4();
      await followRepo.create(
        createTestFollow({
          id: followId,
          followerId: user1Id,
          followeeId: user2Id,
        })
      );

      const following = await followRepo.findByFollowerId(user1Id);
      expect(following.length).toBe(1);
      expect(following[0]?.followeeId).toBe(user2Id);
    });

    test("should delete follow relationship", async () => {
      const followId = uuidv4();
      await followRepo.create(
        createTestFollow({
          id: followId,
          followerId: user1Id,
          followeeId: user2Id,
        })
      );

      await followRepo.delete(user1Id, user2Id);
      const isFollowing = await followRepo.exists(user1Id, user2Id);
      expect(isFollowing).toBe(false);
    });
  });

  describe("SqliteInstanceBlockRepository", () => {
    let blockRepo: SqliteInstanceBlockRepository;
    let adminUserId: string;

    beforeAll(async () => {
      blockRepo = new SqliteInstanceBlockRepository(db);
      const userRepo = new SqliteUserRepository(db);

      adminUserId = uuidv4();
      await userRepo.create(
        createTestUser({
          id: adminUserId,
          username: "admin",
          email: "admin@example.com",
          passwordHash: "hash",
          isAdmin: true,
        })
      );
    });

    beforeEach(() => {
      sqlite.exec("DELETE FROM instance_blocks");
    });

    test("should create an instance block", async () => {
      const block = await blockRepo.create({
        host: "spam.example.com",
        reason: "Spam instance",
        blockedById: adminUserId,
      });

      expect(block.host).toBe("spam.example.com");
      expect(block.reason).toBe("Spam instance");
    });

    test("should check if host is blocked", async () => {
      await blockRepo.create({
        host: "blocked.example.com",
        reason: null,
        blockedById: adminUserId,
      });

      const isBlocked = await blockRepo.isBlocked("blocked.example.com");
      expect(isBlocked).toBe(true);

      const notBlocked = await blockRepo.isBlocked("allowed.example.com");
      expect(notBlocked).toBe(false);
    });

    test("should find block by host", async () => {
      await blockRepo.create({
        host: "findme.example.com",
        reason: "Test reason",
        blockedById: adminUserId,
      });

      const found = await blockRepo.findByHost("findme.example.com");
      expect(found).not.toBeNull();
      expect(found?.reason).toBe("Test reason");
    });

    test("should delete block by host", async () => {
      await blockRepo.create({
        host: "deleteme.example.com",
        reason: null,
        blockedById: adminUserId,
      });

      const deleted = await blockRepo.deleteByHost("deleteme.example.com");
      expect(deleted).toBe(true);

      const isBlocked = await blockRepo.isBlocked("deleteme.example.com");
      expect(isBlocked).toBe(false);
    });

    test("should return false when deleting non-existent block", async () => {
      const deleted = await blockRepo.deleteByHost("nonexistent.example.com");
      expect(deleted).toBe(false);
    });

    test("should count blocks", async () => {
      expect(await blockRepo.count()).toBe(0);

      await blockRepo.create({
        host: "spam1.example.com",
        reason: null,
        blockedById: adminUserId,
      });

      await blockRepo.create({
        host: "spam2.example.com",
        reason: null,
        blockedById: adminUserId,
      });

      expect(await blockRepo.count()).toBe(2);
    });
  });
});
