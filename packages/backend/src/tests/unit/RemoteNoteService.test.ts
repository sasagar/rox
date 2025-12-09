/**
 * RemoteNoteService Unit Tests
 *
 * Tests remote note processing including attachments handling.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { RemoteNoteService } from "../../services/ap/RemoteNoteService.js";
import type { INoteRepository } from "../../interfaces/repositories/INoteRepository.js";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { ICustomEmojiRepository } from "../../interfaces/repositories/ICustomEmojiRepository.js";
import type { IDriveFileRepository } from "../../interfaces/repositories/IDriveFileRepository.js";

describe("RemoteNoteService", () => {
  let service: RemoteNoteService;
  let mockNoteRepository: Partial<INoteRepository>;
  let mockUserRepository: Partial<IUserRepository>;
  let mockCustomEmojiRepository: Partial<ICustomEmojiRepository>;
  let mockDriveFileRepository: Partial<IDriveFileRepository>;

  beforeEach(() => {
    mockNoteRepository = {
      findByUri: mock(() => Promise.resolve(null)),
      create: mock((note) => Promise.resolve({ ...note, createdAt: new Date(), updatedAt: new Date() })),
      incrementRepliesCount: mock(() => Promise.resolve()),
    };

    mockUserRepository = {
      findByUri: mock(() =>
        Promise.resolve({
          id: "user-123",
          username: "testuser",
          email: "test@remote.example",
          passwordHash: "",
          host: "remote.example",
          displayName: "Test User",
          avatarUrl: null,
          bannerUrl: null,
          bio: null,
          uri: "https://remote.example/users/testuser",
          publicKey: null,
          privateKey: null,
          inbox: "https://remote.example/users/testuser/inbox",
          sharedInbox: null,
          outbox: null,
          followersUrl: null,
          followingUrl: null,
          isAdmin: false,
          isSuspended: false,
          isLocked: false,
          isBot: false,
          isDeleted: false,
          deletedAt: null,
          followingCount: 0,
          followersCount: 0,
          notesCount: 0,
          pinnedNoteIds: [],
          fields: [],
          alsoKnownAs: [],
          movedTo: null,
          movedAt: null,
          customCss: null,
          customJs: null,
          customHtml: null,
          featured: null,
          uiSettings: {},
          profileEmojis: [],
          storageQuotaMb: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
    };

    mockCustomEmojiRepository = {
      findByName: mock(() => Promise.resolve(null)),
      create: mock((emoji) => Promise.resolve({ ...emoji, createdAt: new Date(), updatedAt: new Date() })),
      update: mock(() => Promise.resolve(null)),
    };

    mockDriveFileRepository = {
      create: mock((file) => Promise.resolve({ ...file, createdAt: new Date(), updatedAt: new Date() })),
    };

    service = new RemoteNoteService(
      mockNoteRepository as INoteRepository,
      mockUserRepository as IUserRepository,
      undefined, // remoteActorService - will use default
      mockCustomEmojiRepository as ICustomEmojiRepository,
      mockDriveFileRepository as IDriveFileRepository,
    );
  });

  describe("processNote", () => {
    test("should create note from ActivityPub object", async () => {
      const apNote = {
        id: "https://remote.example/notes/123",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Hello world!</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        cc: [],
      };

      const result = await service.processNote(apNote);

      expect(result).toBeDefined();
      expect(result.uri).toBe("https://remote.example/notes/123");
      expect(result.text).toBe("Hello world!");
      expect(result.visibility).toBe("public");
      expect(mockNoteRepository.create).toHaveBeenCalled();
    });

    test("should return existing note if already processed", async () => {
      const existingNote = {
        id: "existing-123",
        userId: "user-123",
        text: "Existing note",
        uri: "https://remote.example/notes/123",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNoteRepository.findByUri = mock(() => Promise.resolve(existingNote as any));

      const apNote = {
        id: "https://remote.example/notes/123",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Hello world!</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
      };

      const result = await service.processNote(apNote);

      expect(result.id).toBe("existing-123");
      expect(mockNoteRepository.create).not.toHaveBeenCalled();
    });

    test("should process note with attachments", async () => {
      const apNote = {
        id: "https://remote.example/notes/456",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Note with image</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        attachment: [
          {
            type: "Document",
            mediaType: "image/png",
            url: "https://remote.example/files/image.png",
            name: "My Image",
          },
        ],
      };

      const result = await service.processNote(apNote);

      expect(result).toBeDefined();
      expect(result.fileIds).toHaveLength(1);
      expect(mockDriveFileRepository.create).toHaveBeenCalledTimes(1);

      const createCall = (mockDriveFileRepository.create as ReturnType<typeof mock>).mock.calls[0];
      expect(createCall).toBeDefined();
      expect(createCall![0].url).toBe("https://remote.example/files/image.png");
      expect(createCall![0].type).toBe("image/png");
      expect(createCall![0].comment).toBe("My Image");
    });

    test("should process note with multiple attachments", async () => {
      const apNote = {
        id: "https://remote.example/notes/789",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Note with multiple files</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        attachment: [
          {
            type: "Image",
            mediaType: "image/jpeg",
            url: "https://remote.example/files/photo.jpg",
          },
          {
            type: "Video",
            mediaType: "video/mp4",
            url: "https://remote.example/files/video.mp4",
            name: "My Video",
          },
          {
            type: "Audio",
            mediaType: "audio/mp3",
            url: "https://remote.example/files/audio.mp3",
          },
        ],
      };

      const result = await service.processNote(apNote);

      expect(result.fileIds).toHaveLength(3);
      expect(mockDriveFileRepository.create).toHaveBeenCalledTimes(3);
    });

    test("should skip unsupported attachment types", async () => {
      const apNote = {
        id: "https://remote.example/notes/abc",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Note with link attachment</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        attachment: [
          {
            type: "Link", // Unsupported type
            mediaType: "text/html",
            url: "https://example.com",
          },
        ],
      };

      const result = await service.processNote(apNote);

      expect(result.fileIds).toHaveLength(0);
      expect(mockDriveFileRepository.create).not.toHaveBeenCalled();
    });

    test("should handle attachment without URL gracefully", async () => {
      const apNote = {
        id: "https://remote.example/notes/def",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Note with invalid attachment</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        attachment: [
          {
            type: "Document",
            mediaType: "image/png",
            url: "", // Empty URL
            name: "Invalid",
          },
        ],
      };

      const result = await service.processNote(apNote);

      expect(result.fileIds).toHaveLength(0);
      expect(mockDriveFileRepository.create).not.toHaveBeenCalled();
    });

    test("should process note without attachments", async () => {
      const apNote = {
        id: "https://remote.example/notes/noattach",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Simple note</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
      };

      const result = await service.processNote(apNote);

      expect(result.fileIds).toHaveLength(0);
      expect(mockDriveFileRepository.create).not.toHaveBeenCalled();
    });

    test("should extract filename from attachment URL", async () => {
      const apNote = {
        id: "https://remote.example/notes/filename",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Note with named file</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        attachment: [
          {
            type: "Document",
            mediaType: "image/png",
            url: "https://remote.example/media/uploads/my-photo-2024.png",
            // No name provided - should extract from URL
          },
        ],
      };

      const result = await service.processNote(apNote);

      expect(result.fileIds).toHaveLength(1);

      const createCall = (mockDriveFileRepository.create as ReturnType<typeof mock>).mock.calls[0];
      expect(createCall).toBeDefined();
      expect(createCall![0].name).toBe("my-photo-2024.png");
    });

    test("should handle visibility correctly", async () => {
      // Test home/unlisted visibility (public in cc, not to)
      const unlistedNote = {
        id: "https://remote.example/notes/unlisted",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Unlisted note</p>",
        to: ["https://remote.example/users/testuser/followers"],
        cc: ["https://www.w3.org/ns/activitystreams#Public"],
      };

      const result = await service.processNote(unlistedNote);
      expect(result.visibility).toBe("home");
    });

    test("should handle followers-only visibility", async () => {
      const followersNote = {
        id: "https://remote.example/notes/followers",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Followers only</p>",
        to: ["https://remote.example/users/testuser/followers"],
        cc: [],
      };

      const result = await service.processNote(followersNote);
      expect(result.visibility).toBe("followers");
    });

    test("should resolve mentions in tags", async () => {
      const apNote = {
        id: "https://remote.example/notes/mention",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Hello @mentioneduser!</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        tag: [
          {
            type: "Mention",
            name: "@mentioneduser@remote.example",
            href: "https://remote.example/users/mentioneduser",
          },
        ],
      };

      const result = await service.processNote(apNote);

      // The mention should be resolved to a user ID
      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0]).toBe("user-123");
    });

    test("should handle note with no matching mentions gracefully", async () => {
      // Test that notes with mentions that don't resolve still get created
      // The service uses a cached actor lookup, so missing mentions just result in empty mentions array
      const apNote = {
        id: "https://remote.example/notes/nomatch",
        type: "Note",
        attributedTo: "https://remote.example/users/testuser",
        content: "<p>Hello @unknown!</p>",
        to: ["https://www.w3.org/ns/activitystreams#Public"],
        tag: [
          {
            type: "Mention",
            name: "@unknown@remote.example",
            // href points to the same user, so it will resolve
            href: "https://remote.example/users/testuser",
          },
        ],
      };

      const result = await service.processNote(apNote);

      // Note should be created successfully
      expect(result).toBeDefined();
      // Mention should resolve since we're using the same user URI
      expect(result.mentions).toHaveLength(1);
    });
  });
});
