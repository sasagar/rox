/**
 * UserDataExportService Unit Tests
 *
 * Tests GDPR-compliant user data export functionality.
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { UserDataExportService } from "../../services/UserDataExportService";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository";
import type { INoteRepository } from "../../interfaces/repositories/INoteRepository";
import type { IFollowRepository } from "../../interfaces/repositories/IFollowRepository";
import type { IDriveFileRepository } from "../../interfaces/repositories/IDriveFileRepository";
import type { INotificationRepository } from "../../interfaces/repositories/INotificationRepository";

describe("UserDataExportService", () => {
  let service: UserDataExportService;
  let mockUserRepository: IUserRepository;
  let mockNoteRepository: INoteRepository;
  let mockFollowRepository: IFollowRepository;
  let mockDriveFileRepository: IDriveFileRepository;
  let mockNotificationRepository: INotificationRepository;

  const mockUser = {
    id: "user-1",
    username: "testuser",
    email: "test@example.com",
    displayName: "Test User",
    bio: "A test user bio",
    avatarUrl: "https://example.com/avatar.png",
    bannerUrl: "https://example.com/banner.png",
    uri: "https://example.com/users/testuser",
    uiSettings: { theme: "dark" },
    customCss: ".profile { color: red; }",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-06-01T00:00:00Z"),
  };

  const mockNotes = [
    {
      id: "note-1",
      userId: "user-1",
      text: "Hello world",
      visibility: "public",
      createdAt: new Date("2024-02-01T00:00:00Z"),
      updatedAt: null,
    },
    {
      id: "note-2",
      userId: "user-1",
      text: "Second post",
      visibility: "followers",
      createdAt: new Date("2024-03-01T00:00:00Z"),
      updatedAt: new Date("2024-03-02T00:00:00Z"),
    },
  ];

  const mockFollowing = [
    {
      id: "follow-1",
      followerId: "user-1",
      followeeId: "user-2",
      createdAt: new Date("2024-01-15T00:00:00Z"),
    },
  ];

  const mockFollowers = [
    {
      id: "follow-2",
      followerId: "user-3",
      followeeId: "user-1",
      createdAt: new Date("2024-02-15T00:00:00Z"),
    },
  ];

  const mockDriveFiles = [
    {
      id: "file-1",
      userId: "user-1",
      name: "image.png",
      type: "image/png",
      size: 1024,
      url: "https://example.com/files/image.png",
      createdAt: new Date("2024-04-01T00:00:00Z"),
    },
  ];

  const mockNotifications = [
    { id: "notif-1", userId: "user-1", type: "follow" },
    { id: "notif-2", userId: "user-1", type: "mention" },
    { id: "notif-3", userId: "user-1", type: "follow" },
  ];

  beforeEach(() => {
    mockUserRepository = {
      findById: mock(() => Promise.resolve(mockUser)),
    } as unknown as IUserRepository;

    mockNoteRepository = {
      findByUserId: mock(() => Promise.resolve(mockNotes)),
    } as unknown as INoteRepository;

    mockFollowRepository = {
      findByFollowerId: mock(() => Promise.resolve(mockFollowing)),
      findByFolloweeId: mock(() => Promise.resolve(mockFollowers)),
    } as unknown as IFollowRepository;

    mockDriveFileRepository = {
      findByUserId: mock(() => Promise.resolve(mockDriveFiles)),
    } as unknown as IDriveFileRepository;

    mockNotificationRepository = {
      findByUserId: mock(() => Promise.resolve(mockNotifications)),
    } as unknown as INotificationRepository;

    service = new UserDataExportService(
      mockUserRepository,
      mockNoteRepository,
      mockFollowRepository,
      mockDriveFileRepository,
      mockNotificationRepository,
    );
  });

  describe("exportUserData", () => {
    it("should export user data in correct format", async () => {
      const result = await service.exportUserData("user-1");

      expect(result.exportVersion).toBe("1.0");
      expect(result.exportedAt).toBeDefined();
      expect(new Date(result.exportedAt)).toBeInstanceOf(Date);
    });

    it("should include correct data subject information", async () => {
      const result = await service.exportUserData("user-1");

      expect(result.dataSubject).toEqual({
        id: "user-1",
        username: "testuser",
        email: "test@example.com",
        createdAt: "2024-01-01T00:00:00.000Z",
      });
    });

    it("should include profile information", async () => {
      const result = await service.exportUserData("user-1");

      expect(result.profile).toEqual({
        displayName: "Test User",
        bio: "A test user bio",
        avatarUrl: "https://example.com/avatar.png",
        bannerUrl: "https://example.com/banner.png",
        uri: "https://example.com/users/testuser",
      });
    });

    it("should include settings", async () => {
      const result = await service.exportUserData("user-1");

      expect(result.settings).toEqual({
        uiSettings: { theme: "dark" },
        customCss: ".profile { color: red; }",
      });
    });

    it("should include all user notes", async () => {
      const result = await service.exportUserData("user-1");

      expect(result.content.noteCount).toBe(2);
      expect(result.content.notes).toHaveLength(2);
      expect(result.content.notes[0]).toEqual({
        id: "note-1",
        text: "Hello world",
        visibility: "public",
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: null,
      });
      expect(result.content.notes[1]).toEqual({
        id: "note-2",
        text: "Second post",
        visibility: "followers",
        createdAt: "2024-03-01T00:00:00.000Z",
        updatedAt: "2024-03-02T00:00:00.000Z",
      });
    });

    it("should include social connections", async () => {
      const result = await service.exportUserData("user-1");

      expect(result.social.followingCount).toBe(1);
      expect(result.social.followersCount).toBe(1);
      expect(result.social.following[0]).toEqual({
        id: "follow-1",
        followeeId: "user-2",
        followedAt: "2024-01-15T00:00:00.000Z",
      });
      expect(result.social.followers[0]).toEqual({
        id: "follow-2",
        followerId: "user-3",
        followedAt: "2024-02-15T00:00:00.000Z",
      });
    });

    it("should include media files with correct total size", async () => {
      const result = await service.exportUserData("user-1");

      expect(result.media.fileCount).toBe(1);
      expect(result.media.totalSizeBytes).toBe(1024);
      expect(result.media.files[0]).toEqual({
        id: "file-1",
        name: "image.png",
        type: "image/png",
        size: 1024,
        url: "https://example.com/files/image.png",
        createdAt: "2024-04-01T00:00:00.000Z",
      });
    });

    it("should include notification statistics by type", async () => {
      const result = await service.exportUserData("user-1");

      expect(result.notifications.count).toBe(3);
      expect(result.notifications.types).toEqual({
        follow: 2,
        mention: 1,
      });
    });

    it("should throw error for non-existent user", async () => {
      mockUserRepository.findById = mock(() => Promise.resolve(null));

      await expect(service.exportUserData("non-existent")).rejects.toThrow("User not found");
    });

    it("should handle user with no notes", async () => {
      mockNoteRepository.findByUserId = mock(() => Promise.resolve([]));

      const result = await service.exportUserData("user-1");

      expect(result.content.noteCount).toBe(0);
      expect(result.content.notes).toEqual([]);
    });

    it("should handle user with no followers or following", async () => {
      mockFollowRepository.findByFollowerId = mock(() => Promise.resolve([]));
      mockFollowRepository.findByFolloweeId = mock(() => Promise.resolve([]));

      const result = await service.exportUserData("user-1");

      expect(result.social.followingCount).toBe(0);
      expect(result.social.followersCount).toBe(0);
      expect(result.social.following).toEqual([]);
      expect(result.social.followers).toEqual([]);
    });

    it("should handle user with no media files", async () => {
      mockDriveFileRepository.findByUserId = mock(() => Promise.resolve([]));

      const result = await service.exportUserData("user-1");

      expect(result.media.fileCount).toBe(0);
      expect(result.media.totalSizeBytes).toBe(0);
      expect(result.media.files).toEqual([]);
    });

    it("should handle user with no notifications", async () => {
      mockNotificationRepository.findByUserId = mock(() => Promise.resolve([]));

      const result = await service.exportUserData("user-1");

      expect(result.notifications.count).toBe(0);
      expect(result.notifications.types).toEqual({});
    });

    it("should call repositories with correct parameters", async () => {
      await service.exportUserData("user-1");

      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-1");
      expect(mockFollowRepository.findByFollowerId).toHaveBeenCalledWith("user-1", 10000);
      expect(mockFollowRepository.findByFolloweeId).toHaveBeenCalledWith("user-1", 10000);
      expect(mockDriveFileRepository.findByUserId).toHaveBeenCalledWith("user-1", { limit: 10000 });
      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith("user-1", {
        limit: 10000,
      });
    });

    it("should handle null values in user profile", async () => {
      mockUserRepository.findById = mock(() =>
        Promise.resolve({
          ...mockUser,
          displayName: null,
          bio: null,
          avatarUrl: null,
          bannerUrl: null,
          uri: null,
          email: null,
          customCss: null,
        } as any),
      );

      const result = await service.exportUserData("user-1");

      expect(result.dataSubject.email).toBeNull();
      expect(result.profile.displayName).toBeNull();
      expect(result.profile.bio).toBeNull();
      expect(result.profile.avatarUrl).toBeNull();
      expect(result.profile.bannerUrl).toBeNull();
      expect(result.profile.uri).toBeNull();
      expect(result.settings.customCss).toBeNull();
    });
  });
});
