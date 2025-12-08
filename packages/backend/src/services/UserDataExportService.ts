/**
 * User Data Export Service
 *
 * Provides GDPR-compliant data export functionality.
 * Allows users to download all their personal data in a portable format.
 */

import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { INoteRepository } from "../interfaces/repositories/INoteRepository.js";
import type { IFollowRepository } from "../interfaces/repositories/IFollowRepository.js";
import type { IDriveFileRepository } from "../interfaces/repositories/IDriveFileRepository.js";
import type { INotificationRepository } from "../interfaces/repositories/INotificationRepository.js";
import type { Note } from "../db/schema/pg.js";

/**
 * Exported user data structure (GDPR Article 20 compliant)
 */
export interface UserDataExport {
  exportVersion: string;
  exportedAt: string;
  dataSubject: {
    id: string;
    username: string;
    email: string | null;
    createdAt: string;
  };
  profile: {
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    uri: string | null;
  };
  settings: {
    uiSettings: unknown;
    customCss: string | null;
  };
  content: {
    notes: Array<{
      id: string;
      text: string | null;
      visibility: string;
      createdAt: string;
      updatedAt: string | null;
    }>;
    noteCount: number;
  };
  social: {
    following: Array<{
      id: string;
      followeeId: string;
      followedAt: string;
    }>;
    followers: Array<{
      id: string;
      followerId: string;
      followedAt: string;
    }>;
    followingCount: number;
    followersCount: number;
  };
  media: {
    files: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      url: string;
      createdAt: string;
    }>;
    fileCount: number;
    totalSizeBytes: number;
  };
  notifications: {
    count: number;
    types: Record<string, number>;
  };
}

export class UserDataExportService {
  constructor(
    private userRepository: IUserRepository,
    private noteRepository: INoteRepository,
    private followRepository: IFollowRepository,
    private driveFileRepository: IDriveFileRepository,
    private notificationRepository: INotificationRepository,
  ) {}

  /**
   * Export all user data in GDPR-compliant format
   *
   * @param userId - The user ID to export data for
   * @returns User data export object
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Fetch all user data in parallel for efficiency
    const [notes, following, followers, files, notifications] = await Promise.all([
      this.fetchUserNotes(userId),
      this.fetchFollowing(userId),
      this.fetchFollowers(userId),
      this.fetchDriveFiles(userId),
      this.fetchNotificationStats(userId),
    ]);

    const totalFileSize = files.reduce((sum: number, file) => sum + (file.size || 0), 0);

    return {
      exportVersion: "1.0",
      exportedAt: new Date().toISOString(),
      dataSubject: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      profile: {
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        uri: user.uri,
      },
      settings: {
        uiSettings: user.uiSettings,
        customCss: user.customCss,
      },
      content: {
        notes: notes.map((note: Note) => ({
          id: note.id,
          text: note.text,
          visibility: note.visibility,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt?.toISOString() || null,
        })),
        noteCount: notes.length,
      },
      social: {
        following: following.map((f) => ({
          id: f.id,
          followeeId: f.followeeId,
          followedAt: f.createdAt.toISOString(),
        })),
        followers: followers.map((f) => ({
          id: f.id,
          followerId: f.followerId,
          followedAt: f.createdAt.toISOString(),
        })),
        followingCount: following.length,
        followersCount: followers.length,
      },
      media: {
        files: files.map((file) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          url: file.url,
          createdAt: file.createdAt.toISOString(),
        })),
        fileCount: files.length,
        totalSizeBytes: totalFileSize,
      },
      notifications: notifications,
    };
  }

  /**
   * Fetch all notes by user
   */
  private async fetchUserNotes(userId: string): Promise<Note[]> {
    // Fetch notes in batches to handle large datasets
    const allNotes: Note[] = [];
    let untilId: string | undefined;
    const batchSize = 100;

    do {
      const notes = await this.noteRepository.findByUserId(userId, {
        limit: batchSize,
        untilId,
      });
      allNotes.push(...notes);
      untilId = notes.length === batchSize ? notes[notes.length - 1]?.id : undefined;
    } while (untilId);

    return allNotes;
  }

  /**
   * Fetch all users this user is following
   */
  private async fetchFollowing(userId: string) {
    // Use findByFollowerId - this returns users that userId is following
    return this.followRepository.findByFollowerId(userId, 10000);
  }

  /**
   * Fetch all followers of this user
   */
  private async fetchFollowers(userId: string) {
    // Use findByFolloweeId - this returns users that are following userId
    return this.followRepository.findByFolloweeId(userId, 10000);
  }

  /**
   * Fetch all drive files by user
   */
  private async fetchDriveFiles(userId: string) {
    return this.driveFileRepository.findByUserId(userId, { limit: 10000 });
  }

  /**
   * Fetch notification statistics
   */
  private async fetchNotificationStats(userId: string): Promise<{
    count: number;
    types: Record<string, number>;
  }> {
    const notifications = await this.notificationRepository.findByUserId(userId, { limit: 10000 });
    const types: Record<string, number> = {};

    for (const notif of notifications) {
      types[notif.type] = (types[notif.type] || 0) + 1;
    }

    return {
      count: notifications.length,
      types,
    };
  }
}
