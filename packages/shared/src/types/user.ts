import type { ID, Timestamps } from "./common.js";
import type { UISettings } from "./uiSettings.js";

/**
 * Profile emoji (custom emoji used in user profile from remote instances)
 */
export interface ProfileEmoji {
  name: string;
  url: string;
}

export interface User extends Timestamps {
  id: ID;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isAdmin: boolean;
  isSuspended: boolean;
  publicKey: string | null;
  privateKey: string | null;
  host: string | null; // null for local users, domain for remote users
  // ActivityPub fields
  inbox: string | null; // ActivityPub inbox URL
  outbox: string | null; // ActivityPub outbox URL
  followersUrl: string | null; // Followers collection URL
  followingUrl: string | null; // Following collection URL
  uri: string | null; // ActivityPub actor URI (for remote users)
  sharedInbox: string | null; // Shared inbox URL (for remote users, optional)
  // User customization
  customCss: string | null; // Custom CSS for profile page
  uiSettings: UISettings | null; // UI display preferences
  // Account migration fields
  alsoKnownAs: string[] | null; // Alternative account URIs for migration
  movedTo: string | null; // URI of account this user moved to
  movedAt: Date | null; // When migration was completed
  // Profile emojis from remote instances
  profileEmojis: ProfileEmoji[] | null;
  // Storage quota
  storageQuotaMb: number | null; // Storage quota in MB (null means use role default)
}

export interface UserProfile {
  id: ID;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  host: string | null;
  createdAt: Date;
}

export interface Follow extends Timestamps {
  id: ID;
  followerId: ID;
  followeeId: ID;
}
