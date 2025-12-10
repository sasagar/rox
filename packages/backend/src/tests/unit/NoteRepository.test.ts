/**
 * Note Repository Unit Tests
 *
 * Tests the note repository interface contract using mock implementations.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { INoteRepository, NoteCreateInput, TimelineOptions } from "../../interfaces/repositories/INoteRepository.js";
import type { Note } from "../../../../shared/src/types/note.js";

describe("NoteRepository", () => {
  // Mock note data (matches actual Note type from shared/types/note.ts)
  const mockNote: Note = {
    id: "note1",
    userId: "user1",
    text: "Hello, world!",
    visibility: "public",
    localOnly: false,
    uri: null,
    replyId: null,
    renoteId: null,
    fileIds: [],
    cw: null,
    mentions: [],
    emojis: [],
    repliesCount: 0,
    renoteCount: 0,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    deletedAt: null,
    deletedById: null,
    deletionReason: null,
  };

  const mockNoteWithReply: Note = {
    ...mockNote,
    id: "note2",
    replyId: "note1",
    text: "This is a reply",
  };

  const mockRenote: Note = {
    ...mockNote,
    id: "note3",
    renoteId: "note1",
    text: null,
  };

  const mockRemoteNote: Note = {
    ...mockNote,
    id: "note4",
    uri: "https://remote.example/notes/123",
  };

  const mockDeletedNote: Note = {
    ...mockNote,
    id: "note5",
    isDeleted: true,
    deletedAt: new Date(),
    deletedById: "admin1",
    deletionReason: "Rule violation",
  };

  let mockRepo: INoteRepository;

  beforeEach(() => {
    mockRepo = {
      create: mock(async (note: NoteCreateInput) =>
        Promise.resolve({ ...mockNote, ...note, id: note.id || "new-note-id" })
      ),
      findById: mock(async (id: string) =>
        id === "note1" ? Promise.resolve(mockNote) : Promise.resolve(null)
      ),
      findByUri: mock(async (uri: string) =>
        uri === mockRemoteNote.uri ? Promise.resolve(mockRemoteNote) : Promise.resolve(null)
      ),
      getLocalTimeline: mock(async () => Promise.resolve([mockNote])),
      getTimeline: mock(async () => Promise.resolve([mockNote])),
      getSocialTimeline: mock(async () => Promise.resolve([mockNote])),
      getGlobalTimeline: mock(async () => Promise.resolve([mockNote, mockRemoteNote])),
      findByUserId: mock(async () => Promise.resolve([mockNote])),
      findReplies: mock(async () => Promise.resolve([mockNoteWithReply])),
      findRenotes: mock(async () => Promise.resolve([mockRenote])),
      update: mock(async (id: string, data: Partial<Note>) =>
        Promise.resolve({ ...mockNote, ...data, id })
      ),
      delete: mock(async () => Promise.resolve()),
      softDelete: mock(async () => Promise.resolve(mockDeletedNote)),
      restore: mock(async () => Promise.resolve(mockNote)),
      findDeletedNotes: mock(async () => Promise.resolve([mockDeletedNote])),
      count: mock(async () => Promise.resolve(100)),
      countByUserId: mock(async () => Promise.resolve(10)),
      incrementRepliesCount: mock(async () => Promise.resolve()),
      decrementRepliesCount: mock(async () => Promise.resolve()),
      incrementRenoteCount: mock(async () => Promise.resolve()),
      decrementRenoteCount: mock(async () => Promise.resolve()),
      findMentionsAndReplies: mock(async () => Promise.resolve([])),
      findDirectMessages: mock(async () => Promise.resolve([])),
      findDirectMessageThread: mock(async () => Promise.resolve([])),
      getConversationPartners: mock(async () => Promise.resolve([])),
    };
  });

  describe("create", () => {
    test("should create a public note", async () => {
      const input: NoteCreateInput = {
        id: "new-note-id",
        userId: "user1",
        text: "New note content",
        visibility: "public",
        localOnly: false,
        uri: null,
        cw: null,
        replyId: null,
        renoteId: null,
        fileIds: [],
        mentions: [],
        emojis: [],
        tags: [],
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      };

      const result = await mockRepo.create(input);

      expect(result.id).toBe("new-note-id");
      expect(result.text).toBe("New note content");
      expect(result.visibility).toBe("public");
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    test("should create a note with attachments", async () => {
      const input: NoteCreateInput = {
        id: "new-note-id",
        userId: "user1",
        text: "Note with files",
        visibility: "public",
        localOnly: false,
        uri: null,
        cw: null,
        replyId: null,
        renoteId: null,
        fileIds: ["file1", "file2"],
        mentions: [],
        emojis: [],
        tags: [],
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      };

      const result = await mockRepo.create(input);

      expect(result.fileIds).toEqual(["file1", "file2"]);
    });

    test("should create a reply note", async () => {
      const input: NoteCreateInput = {
        id: "new-note-id",
        userId: "user1",
        text: "This is a reply",
        visibility: "public",
        localOnly: false,
        uri: null,
        cw: null,
        replyId: "note1",
        renoteId: null,
        fileIds: [],
        mentions: [],
        emojis: [],
        tags: [],
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      };

      const result = await mockRepo.create(input);

      expect(result.replyId).toBe("note1");
    });

    test("should create a renote", async () => {
      const input: NoteCreateInput = {
        id: "new-note-id",
        userId: "user1",
        text: null,
        visibility: "public",
        localOnly: false,
        uri: null,
        cw: null,
        replyId: null,
        renoteId: "note1",
        fileIds: [],
        mentions: [],
        emojis: [],
        tags: [],
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      };

      const result = await mockRepo.create(input);

      expect(result.renoteId).toBe("note1");
    });

    test("should create a note with CW", async () => {
      const input: NoteCreateInput = {
        id: "new-note-id",
        userId: "user1",
        text: "Sensitive content",
        visibility: "public",
        localOnly: false,
        uri: null,
        cw: "Content warning",
        replyId: null,
        renoteId: null,
        fileIds: [],
        mentions: [],
        emojis: [],
        tags: [],
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      };

      const result = await mockRepo.create(input);

      expect(result.cw).toBe("Content warning");
    });

    test("should create a local-only note", async () => {
      const input: NoteCreateInput = {
        id: "new-note-id",
        userId: "user1",
        text: "Local only content",
        visibility: "public",
        localOnly: true,
        uri: null,
        cw: null,
        replyId: null,
        renoteId: null,
        fileIds: [],
        mentions: [],
        emojis: [],
        tags: [],
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      };

      const result = await mockRepo.create(input);

      expect(result.localOnly).toBe(true);
    });

    test("should create a note with followers-only visibility", async () => {
      const input: NoteCreateInput = {
        id: "new-note-id",
        userId: "user1",
        text: "Followers only",
        visibility: "followers",
        localOnly: false,
        uri: null,
        cw: null,
        replyId: null,
        renoteId: null,
        fileIds: [],
        mentions: [],
        emojis: [],
        tags: [],
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      };

      const result = await mockRepo.create(input);

      expect(result.visibility).toBe("followers");
    });
  });

  describe("findById", () => {
    test("should find an existing note by ID", async () => {
      const result = await mockRepo.findById("note1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("note1");
      expect(result!.text).toBe("Hello, world!");
    });

    test("should return null for non-existent note", async () => {
      const result = await mockRepo.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUri", () => {
    test("should find a remote note by URI", async () => {
      const result = await mockRepo.findByUri("https://remote.example/notes/123");

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("https://remote.example/notes/123");
    });

    test("should return null for non-existent URI", async () => {
      const result = await mockRepo.findByUri("https://unknown.example/notes/999");

      expect(result).toBeNull();
    });
  });

  describe("Timeline Methods", () => {
    const defaultOptions: TimelineOptions = {
      limit: 20,
    };

    describe("getLocalTimeline", () => {
      test("should return local timeline notes", async () => {
        const result = await mockRepo.getLocalTimeline(defaultOptions);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(mockRepo.getLocalTimeline).toHaveBeenCalledWith(defaultOptions);
      });

      test("should support pagination with sinceId", async () => {
        const options: TimelineOptions = {
          limit: 20,
          sinceId: "note0",
        };

        await mockRepo.getLocalTimeline(options);

        expect(mockRepo.getLocalTimeline).toHaveBeenCalledWith(options);
      });

      test("should support pagination with untilId", async () => {
        const options: TimelineOptions = {
          limit: 20,
          untilId: "note2",
        };

        await mockRepo.getLocalTimeline(options);

        expect(mockRepo.getLocalTimeline).toHaveBeenCalledWith(options);
      });
    });

    describe("getTimeline (Home)", () => {
      test("should return home timeline for given user IDs", async () => {
        const options = {
          ...defaultOptions,
          userIds: ["user1", "user2"],
        };

        const result = await mockRepo.getTimeline(options);

        expect(Array.isArray(result)).toBe(true);
        expect(mockRepo.getTimeline).toHaveBeenCalledWith(options);
      });

      test("should return empty array for no followed users", async () => {
        mockRepo.getTimeline = mock(async () => Promise.resolve([]));
        const options = {
          ...defaultOptions,
          userIds: [],
        };

        const result = await mockRepo.getTimeline(options);

        expect(result).toEqual([]);
      });
    });

    describe("getSocialTimeline", () => {
      test("should return social timeline", async () => {
        const result = await mockRepo.getSocialTimeline(defaultOptions);

        expect(Array.isArray(result)).toBe(true);
        expect(mockRepo.getSocialTimeline).toHaveBeenCalledWith(defaultOptions);
      });

      test("should include followed user IDs when provided", async () => {
        const options = {
          ...defaultOptions,
          userIds: ["user2", "user3"],
        };

        await mockRepo.getSocialTimeline(options);

        expect(mockRepo.getSocialTimeline).toHaveBeenCalledWith(options);
      });
    });

    describe("getGlobalTimeline", () => {
      test("should return global timeline including remote notes", async () => {
        const result = await mockRepo.getGlobalTimeline(defaultOptions);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("findByUserId", () => {
      test("should return notes by specific user", async () => {
        const result = await mockRepo.findByUserId("user1", defaultOptions);

        expect(Array.isArray(result)).toBe(true);
        expect(mockRepo.findByUserId).toHaveBeenCalledWith("user1", defaultOptions);
      });
    });
  });

  describe("Reply and Renote Methods", () => {
    describe("findReplies", () => {
      test("should return replies to a note", async () => {
        const result = await mockRepo.findReplies("note1", { limit: 20 });

        expect(Array.isArray(result)).toBe(true);
        expect(result[0]?.replyId).toBe("note1");
      });
    });

    describe("findRenotes", () => {
      test("should return renotes of a note", async () => {
        const result = await mockRepo.findRenotes("note1", { limit: 20 });

        expect(Array.isArray(result)).toBe(true);
        expect(result[0]?.renoteId).toBe("note1");
      });
    });
  });

  describe("update", () => {
    test("should update note text", async () => {
      const result = await mockRepo.update("note1", { text: "Updated content" });

      expect(result.text).toBe("Updated content");
      expect(mockRepo.update).toHaveBeenCalledWith("note1", { text: "Updated content" });
    });

    test("should update note CW", async () => {
      const result = await mockRepo.update("note1", { cw: "New CW" });

      expect(result.cw).toBe("New CW");
    });
  });

  describe("delete", () => {
    test("should hard delete a note", async () => {
      await mockRepo.delete("note1");

      expect(mockRepo.delete).toHaveBeenCalledWith("note1");
    });
  });

  describe("Soft Delete and Restore", () => {
    describe("softDelete", () => {
      test("should soft delete a note with reason", async () => {
        const result = await mockRepo.softDelete("note1", "admin1", "Rule violation");

        expect(result).not.toBeNull();
        expect(result!.isDeleted).toBe(true);
        expect(result!.deletedById).toBe("admin1");
        expect(result!.deletionReason).toBe("Rule violation");
      });

      test("should soft delete without reason", async () => {
        mockRepo.softDelete = mock(async () =>
          Promise.resolve({ ...mockDeletedNote, deletionReason: null })
        );

        const result = await mockRepo.softDelete("note1", "admin1");

        expect(result).not.toBeNull();
        expect(result!.isDeleted).toBe(true);
      });

      test("should return null for non-existent note", async () => {
        mockRepo.softDelete = mock(async () => Promise.resolve(null));

        const result = await mockRepo.softDelete("nonexistent", "admin1");

        expect(result).toBeNull();
      });
    });

    describe("restore", () => {
      test("should restore a soft-deleted note", async () => {
        const result = await mockRepo.restore("note5");

        expect(result).not.toBeNull();
        expect(result!.isDeleted).toBe(false);
      });

      test("should return null for non-existent note", async () => {
        mockRepo.restore = mock(async () => Promise.resolve(null));

        const result = await mockRepo.restore("nonexistent");

        expect(result).toBeNull();
      });
    });

    describe("findDeletedNotes", () => {
      test("should return deleted notes", async () => {
        const result = await mockRepo.findDeletedNotes();

        expect(Array.isArray(result)).toBe(true);
        expect(result[0]?.isDeleted).toBe(true);
      });

      test("should filter by deletedById", async () => {
        await mockRepo.findDeletedNotes({ deletedById: "admin1" });

        expect(mockRepo.findDeletedNotes).toHaveBeenCalledWith({ deletedById: "admin1" });
      });

      test("should support pagination", async () => {
        await mockRepo.findDeletedNotes({ limit: 10, offset: 20 });

        expect(mockRepo.findDeletedNotes).toHaveBeenCalledWith({ limit: 10, offset: 20 });
      });
    });
  });

  describe("Count Methods", () => {
    describe("count", () => {
      test("should return total note count", async () => {
        const result = await mockRepo.count();

        expect(result).toBe(100);
      });

      test("should return local-only note count", async () => {
        mockRepo.count = mock(async (localOnly) =>
          localOnly ? Promise.resolve(50) : Promise.resolve(100)
        );

        const result = await mockRepo.count(true);

        expect(result).toBe(50);
      });
    });

    describe("countByUserId", () => {
      test("should return note count for specific user", async () => {
        const result = await mockRepo.countByUserId("user1");

        expect(result).toBe(10);
        expect(mockRepo.countByUserId).toHaveBeenCalledWith("user1");
      });
    });
  });

  describe("Counter Operations", () => {
    describe("incrementRepliesCount", () => {
      test("should increment replies count", async () => {
        await mockRepo.incrementRepliesCount("note1");

        expect(mockRepo.incrementRepliesCount).toHaveBeenCalledWith("note1");
      });
    });

    describe("decrementRepliesCount", () => {
      test("should decrement replies count", async () => {
        await mockRepo.decrementRepliesCount("note1");

        expect(mockRepo.decrementRepliesCount).toHaveBeenCalledWith("note1");
      });
    });

    describe("incrementRenoteCount", () => {
      test("should increment renote count", async () => {
        await mockRepo.incrementRenoteCount("note1");

        expect(mockRepo.incrementRenoteCount).toHaveBeenCalledWith("note1");
      });
    });

    describe("decrementRenoteCount", () => {
      test("should decrement renote count", async () => {
        await mockRepo.decrementRenoteCount("note1");

        expect(mockRepo.decrementRenoteCount).toHaveBeenCalledWith("note1");
      });
    });
  });

  describe("Mentions and Replies", () => {
    const mockMention: Note = {
      ...mockNote,
      id: "mention1",
      text: "@user1 hello!",
      mentions: ["user1"],
    };

    const mockReplyToUser: Note = {
      ...mockNote,
      id: "reply1",
      text: "Reply to your note",
      replyId: "user1-note",
    };

    describe("findMentionsAndReplies", () => {
      test("should return mentions and replies for a user", async () => {
        mockRepo.findMentionsAndReplies = mock(async () =>
          Promise.resolve([mockMention, mockReplyToUser])
        );

        const result = await mockRepo.findMentionsAndReplies("user1", { limit: 20 });

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(mockRepo.findMentionsAndReplies).toHaveBeenCalledWith("user1", { limit: 20 });
      });

      test("should return empty array when no mentions exist", async () => {
        mockRepo.findMentionsAndReplies = mock(async () => Promise.resolve([]));

        const result = await mockRepo.findMentionsAndReplies("user1", { limit: 20 });

        expect(result).toEqual([]);
      });

      test("should support pagination with sinceId", async () => {
        mockRepo.findMentionsAndReplies = mock(async () => Promise.resolve([mockMention]));

        await mockRepo.findMentionsAndReplies("user1", { limit: 20, sinceId: "note0" });

        expect(mockRepo.findMentionsAndReplies).toHaveBeenCalledWith("user1", {
          limit: 20,
          sinceId: "note0",
        });
      });

      test("should support pagination with untilId", async () => {
        mockRepo.findMentionsAndReplies = mock(async () => Promise.resolve([mockMention]));

        await mockRepo.findMentionsAndReplies("user1", { limit: 20, untilId: "note5" });

        expect(mockRepo.findMentionsAndReplies).toHaveBeenCalledWith("user1", {
          limit: 20,
          untilId: "note5",
        });
      });
    });
  });

  describe("Direct Messages", () => {
    const mockDM: Note = {
      ...mockNote,
      id: "dm1",
      text: "Private message",
      visibility: "specified",
    };

    const mockDMThread: Note[] = [
      { ...mockDM, id: "dm1", text: "Hi there!" },
      { ...mockDM, id: "dm2", text: "Hello!", userId: "user2" },
      { ...mockDM, id: "dm3", text: "How are you?" },
    ];

    describe("findDirectMessages", () => {
      test("should return direct messages for a user", async () => {
        mockRepo.findDirectMessages = mock(async () => Promise.resolve([mockDM]));

        const result = await mockRepo.findDirectMessages("user1", { limit: 20 });

        expect(Array.isArray(result)).toBe(true);
        expect(result[0]?.visibility).toBe("specified");
        expect(mockRepo.findDirectMessages).toHaveBeenCalledWith("user1", { limit: 20 });
      });

      test("should return empty array when no DMs exist", async () => {
        mockRepo.findDirectMessages = mock(async () => Promise.resolve([]));

        const result = await mockRepo.findDirectMessages("user1", { limit: 20 });

        expect(result).toEqual([]);
      });

      test("should support pagination", async () => {
        mockRepo.findDirectMessages = mock(async () => Promise.resolve([mockDM]));

        await mockRepo.findDirectMessages("user1", { limit: 10, untilId: "dm5" });

        expect(mockRepo.findDirectMessages).toHaveBeenCalledWith("user1", {
          limit: 10,
          untilId: "dm5",
        });
      });
    });

    describe("findDirectMessageThread", () => {
      test("should return DM thread between two users", async () => {
        mockRepo.findDirectMessageThread = mock(async () => Promise.resolve(mockDMThread));

        const result = await mockRepo.findDirectMessageThread("user1", "user2", { limit: 50 });

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(3);
        expect(mockRepo.findDirectMessageThread).toHaveBeenCalledWith("user1", "user2", {
          limit: 50,
        });
      });

      test("should return empty array for new conversation", async () => {
        mockRepo.findDirectMessageThread = mock(async () => Promise.resolve([]));

        const result = await mockRepo.findDirectMessageThread("user1", "user3", { limit: 50 });

        expect(result).toEqual([]);
      });

      test("should support pagination with sinceId", async () => {
        mockRepo.findDirectMessageThread = mock(async () => Promise.resolve([mockDM]));

        await mockRepo.findDirectMessageThread("user1", "user2", { limit: 50, sinceId: "dm0" });

        expect(mockRepo.findDirectMessageThread).toHaveBeenCalledWith("user1", "user2", {
          limit: 50,
          sinceId: "dm0",
        });
      });

      test("should support pagination with untilId", async () => {
        mockRepo.findDirectMessageThread = mock(async () => Promise.resolve([mockDM]));

        await mockRepo.findDirectMessageThread("user1", "user2", { limit: 50, untilId: "dm10" });

        expect(mockRepo.findDirectMessageThread).toHaveBeenCalledWith("user1", "user2", {
          limit: 50,
          untilId: "dm10",
        });
      });
    });

    describe("getConversationPartners", () => {
      const mockPartners = [
        {
          partnerId: "user2",
          partnerUsername: "user2",
          partnerDisplayName: "User Two",
          partnerAvatarUrl: "https://example.com/avatar2.png",
          partnerHost: null,
          partnerProfileEmojis: null,
          lastNoteId: "note123",
          lastNoteText: "See you!",
          lastNoteCreatedAt: new Date(),
        },
        {
          partnerId: "user3",
          partnerUsername: "user3",
          partnerDisplayName: "User Three",
          partnerAvatarUrl: null,
          partnerHost: "remote.example",
          partnerProfileEmojis: [{ name: "blobcat", url: "https://example.com/emoji/blobcat.png" }],
          lastNoteId: "note456",
          lastNoteText: "Thanks!",
          lastNoteCreatedAt: new Date(),
        },
      ];

      test("should return conversation partners for a user", async () => {
        mockRepo.getConversationPartners = mock(async () => Promise.resolve(mockPartners));

        const result = await mockRepo.getConversationPartners("user1", 20);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(mockRepo.getConversationPartners).toHaveBeenCalledWith("user1", 20);
      });

      test("should return empty array when no conversations exist", async () => {
        mockRepo.getConversationPartners = mock(async () => Promise.resolve([]));

        const result = await mockRepo.getConversationPartners("user1", 20);

        expect(result).toEqual([]);
      });

      test("should include last message info", async () => {
        mockRepo.getConversationPartners = mock(async () => Promise.resolve(mockPartners));

        const result = await mockRepo.getConversationPartners("user1", 20);

        expect(result[0]).toHaveProperty("lastNoteText");
        expect(result[0]).toHaveProperty("lastNoteCreatedAt");
      });

      test("should include partner user info", async () => {
        mockRepo.getConversationPartners = mock(async () => Promise.resolve(mockPartners));

        const result = await mockRepo.getConversationPartners("user1", 20);

        expect(result[0]).toHaveProperty("partnerUsername");
        expect(result[0]).toHaveProperty("partnerDisplayName");
        expect(result[0]).toHaveProperty("partnerAvatarUrl");
      });

      test("should support remote users", async () => {
        mockRepo.getConversationPartners = mock(async () => Promise.resolve(mockPartners));

        const result = await mockRepo.getConversationPartners("user1", 20);

        const remotePartner = result.find((p) => p.partnerHost !== null);
        expect(remotePartner).toBeDefined();
        expect(remotePartner?.partnerHost).toBe("remote.example");
      });
    });
  });
});
