/**
 * Mastodon Compatible API Routes
 *
 * Provides compatibility endpoints for Mastodon API clients and
 * federation monitoring tools (fediverse.observer, etc.)
 *
 * @module routes/mastodon
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Visibility } from "shared";
import type { INoteRepository } from "../interfaces/repositories/INoteRepository.js";
import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { ISessionRepository } from "../interfaces/repositories/ISessionRepository.js";
import type { IRemoteInstanceRepository } from "../interfaces/repositories/IRemoteInstanceRepository.js";
import type { IDriveFileRepository } from "../interfaces/repositories/IDriveFileRepository.js";

const app = new Hono();

/**
 * Weekly Activity Statistics
 *
 * Represents activity for a single week.
 * All numeric values are returned as strings per Mastodon API spec.
 */
interface WeeklyActivity {
  /** UNIX timestamp of midnight on the first day of the week */
  week: string;
  /** Number of posts created during the week */
  statuses: string;
  /** Number of user logins during the week */
  logins: string;
  /** Number of new user registrations during the week */
  registrations: string;
}

/**
 * Get Instance Activity
 *
 * GET /api/v1/instance/activity
 *
 * Returns instance activity over the last 3 months, binned weekly.
 * This endpoint is used by federation monitoring tools.
 *
 * Response: Array of WeeklyActivity objects
 */
app.get("/instance/activity", async (c: Context) => {
  const noteRepository = c.get("noteRepository") as INoteRepository;
  const userRepository = c.get("userRepository") as IUserRepository;
  const sessionRepository = c.get("sessionRepository") as ISessionRepository;

  // Calculate weeks for the last 12 weeks (approximately 3 months)
  const now = new Date();
  const weeks: WeeklyActivity[] = [];

  for (let i = 0; i < 12; i++) {
    // Get the start of the week (Sunday at midnight UTC)
    const weekStart = new Date(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay() - i * 7);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    // Get statistics for this week
    const [statusCount, loginCount, registrationCount] = await Promise.all([
      noteRepository.countInPeriod?.(weekStart, weekEnd) ?? 0,
      sessionRepository.countActiveInPeriod?.(weekStart, weekEnd) ?? 0,
      userRepository.countRegistrationsInPeriod?.(weekStart, weekEnd) ?? 0,
    ]);

    weeks.push({
      week: Math.floor(weekStart.getTime() / 1000).toString(),
      statuses: statusCount.toString(),
      logins: loginCount.toString(),
      registrations: registrationCount.toString(),
    });
  }

  return c.json(weeks);
});

/**
 * Mastodon Account Entity (simplified)
 *
 * Only includes fields needed for directory listing.
 */
interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  locked: boolean;
  bot: boolean;
  created_at: string;
  note: string;
  url: string;
  avatar: string;
  avatar_static: string;
  header: string;
  header_static: string;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  last_status_at: string | null;
  emojis: unknown[];
  fields: unknown[];
}

/**
 * Mastodon Media Attachment Entity
 *
 * Represents attached media (images, videos, etc.)
 */
interface MastodonMediaAttachment {
  id: string;
  type: "unknown" | "image" | "gifv" | "video" | "audio";
  url: string;
  preview_url: string | null;
  remote_url: string | null;
  meta: unknown;
  description: string | null;
  blurhash: string | null;
}

/**
 * Mastodon Status Entity
 *
 * Represents a post/note in Mastodon API format.
 */
interface MastodonStatus {
  id: string;
  uri: string;
  created_at: string;
  account: MastodonAccount;
  content: string;
  visibility: "public" | "unlisted" | "private" | "direct";
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: MastodonMediaAttachment[];
  application: { name: string; website: string | null } | null;
  mentions: Array<{ id: string; username: string; url: string; acct: string }>;
  tags: Array<{ name: string; url: string }>;
  emojis: unknown[];
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string | null;
  in_reply_to_id: string | null;
  in_reply_to_account_id: string | null;
  reblog: MastodonStatus | null;
  poll: unknown | null;
  card: unknown | null;
  language: string | null;
  edited_at: string | null;
  favourited: boolean;
  reblogged: boolean;
  muted: boolean;
  bookmarked: boolean;
  pinned: boolean;
}

/**
 * Convert Misskey/Rox visibility to Mastodon visibility
 *
 * @param visibility - Misskey visibility value
 * @returns Mastodon visibility value
 */
function convertVisibility(visibility: Visibility): MastodonStatus["visibility"] {
  switch (visibility) {
    case "public":
      return "public";
    case "home":
      return "unlisted";
    case "followers":
      return "private";
    case "specified":
      return "direct";
    default:
      return "public";
  }
}

/**
 * Convert MIME type to Mastodon media type
 *
 * @param mimeType - MIME type string
 * @returns Mastodon media type
 */
function convertMediaType(mimeType: string): MastodonMediaAttachment["type"] {
  if (mimeType.startsWith("image/gif")) {
    return "gifv";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  return "unknown";
}

/**
 * Convert plain text or MFM to HTML content
 *
 * For now, we just escape HTML and convert newlines to <br>.
 * TODO: Implement proper MFM to HTML conversion
 *
 * @param text - Plain text or MFM content
 * @returns HTML content
 */
function convertToHtml(text: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/**
 * Get Profile Directory
 *
 * GET /api/v1/directory
 *
 * Returns a list of accounts visible in the profile directory.
 * Used by clients to discover users on the instance.
 *
 * Query Parameters:
 * - offset: Number to skip the first n results
 * - limit: Number of accounts to load (default 40, max 80)
 * - order: "active" (recently posted) or "new" (newest profiles)
 * - local: Boolean to return only local accounts (currently always true)
 */
app.get("/directory", async (c: Context) => {
  const userRepository = c.get("userRepository") as IUserRepository;
  const noteRepository = c.get("noteRepository") as INoteRepository;

  // Parse query parameters
  const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);
  const limit = Math.min(80, Math.max(1, parseInt(c.req.query("limit") || "40", 10) || 40));
  const order = c.req.query("order") === "new" ? "new" : "active";
  // local parameter is noted but we always return local users for now

  // For now, return local users only (directory typically shows local users)
  // In the future, could include remote users with discoverable flag
  const users = await userRepository.findAll({
    localOnly: true,
    limit,
    offset,
  });

  // Convert to Mastodon Account format
  const instanceUrl = process.env.URL || "http://localhost:3000";

  const accounts: MastodonAccount[] = await Promise.all(
    users.map(async (user) => {
      // Get note count (follower/following counts are now cached on user)
      const notesCount = await noteRepository.countByUserId(user.id);

      return {
        id: user.id,
        username: user.username,
        acct: user.username, // Local users don't have @host suffix
        display_name: user.displayName || user.username,
        locked: false, // Not implemented yet
        bot: false, // Not implemented yet
        created_at: user.createdAt.toISOString(),
        note: user.bio || "",
        url: `${instanceUrl}/@${user.username}`,
        avatar: user.avatarUrl || `${instanceUrl}/default-avatar.png`,
        avatar_static: user.avatarUrl || `${instanceUrl}/default-avatar.png`,
        header: user.bannerUrl || "",
        header_static: user.bannerUrl || "",
        followers_count: user.followersCount ?? 0,
        following_count: user.followingCount ?? 0,
        statuses_count: notesCount,
        last_status_at: null, // Not tracked yet
        emojis: [],
        fields: [],
      };
    }),
  );

  // Sort based on order parameter
  if (order === "new") {
    accounts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  // "active" order is already handled by the query if supported

  return c.json(accounts);
});


/**
 * Get Instance Peers
 *
 * GET /api/v1/instance/peers
 *
 * Returns an array of domain names that this instance has federated with.
 * This endpoint is used by federation monitoring tools (fediverse.observer, etc.)
 *
 * Response: Array of domain strings
 */
app.get("/instance/peers", async (c: Context) => {
  const remoteInstanceRepository = c.get("remoteInstanceRepository") as IRemoteInstanceRepository;

  // Get all known remote instances
  const instances = await remoteInstanceRepository.findAll();

  // Extract just the host domains
  const peers = instances.map((instance) => instance.host);

  return c.json(peers);
});

/**
 * Get a Single Status
 *
 * GET /api/v1/statuses/:id
 *
 * Returns a single status (note) in Mastodon API format.
 * Used by clients and embed services to fetch status details.
 *
 * @param id - The note ID
 * @returns MastodonStatus object or 404
 */
app.get("/statuses/:id", async (c: Context) => {
  const noteId = c.req.param("id");
  const noteRepository = c.get("noteRepository") as INoteRepository;
  const userRepository = c.get("userRepository") as IUserRepository;
  const driveFileRepository = c.get("driveFileRepository") as IDriveFileRepository;

  const instanceUrl = process.env.URL || "http://localhost:3000";

  // Find the note
  const note = await noteRepository.findById(noteId);
  if (!note || note.isDeleted) {
    return c.json({ error: "Record not found" }, 404);
  }

  // Get the author
  const user = await userRepository.findById(note.userId);
  if (!user) {
    return c.json({ error: "Record not found" }, 404);
  }

  // Get note count for user
  const notesCount = await noteRepository.countByUserId(user.id);

  // Build account object
  const account: MastodonAccount = {
    id: user.id,
    username: user.username,
    acct: user.host ? `${user.username}@${user.host}` : user.username,
    display_name: user.displayName || user.username,
    locked: false,
    bot: false,
    created_at: user.createdAt.toISOString(),
    note: user.bio || "",
    url: user.host
      ? `https://${user.host}/@${user.username}`
      : `${instanceUrl}/@${user.username}`,
    avatar: user.avatarUrl || `${instanceUrl}/default-avatar.png`,
    avatar_static: user.avatarUrl || `${instanceUrl}/default-avatar.png`,
    header: user.bannerUrl || "",
    header_static: user.bannerUrl || "",
    followers_count: user.followersCount ?? 0,
    following_count: user.followingCount ?? 0,
    statuses_count: notesCount,
    last_status_at: null,
    emojis: [],
    fields: [],
  };

  // Get media attachments
  const mediaAttachments: MastodonMediaAttachment[] = [];
  if (note.fileIds.length > 0) {
    const files = await driveFileRepository.findByIds(note.fileIds);
    for (const file of files) {
      mediaAttachments.push({
        id: file.id,
        type: convertMediaType(file.type),
        url: file.url,
        preview_url: file.thumbnailUrl,
        remote_url: null,
        meta: {},
        description: file.comment,
        blurhash: file.blurhash,
      });
    }
  }

  // Build status object
  const status: MastodonStatus = {
    id: note.id,
    uri: note.uri || `${instanceUrl}/notes/${note.id}`,
    created_at: note.createdAt.toISOString(),
    account,
    content: convertToHtml(note.text),
    visibility: convertVisibility(note.visibility),
    sensitive: note.cw !== null,
    spoiler_text: note.cw || "",
    media_attachments: mediaAttachments,
    application: null,
    mentions: [],
    tags: note.tags.map((tag) => ({
      name: tag,
      url: `${instanceUrl}/tags/${encodeURIComponent(tag)}`,
    })),
    emojis: [],
    reblogs_count: note.renoteCount,
    favourites_count: 0, // TODO: Get reaction count
    replies_count: note.repliesCount,
    url: `${instanceUrl}/notes/${note.id}`,
    in_reply_to_id: note.replyId,
    in_reply_to_account_id: null, // TODO: Resolve reply author
    reblog: null, // TODO: Handle renotes
    poll: null,
    card: null,
    language: null,
    edited_at: null,
    favourited: false,
    reblogged: false,
    muted: false,
    bookmarked: false,
    pinned: false,
  };

  return c.json(status);
});

/**
 * Get a Single Account
 *
 * GET /api/v1/accounts/:id
 *
 * Returns a single account (user) in Mastodon API format.
 *
 * @param id - The user ID
 * @returns MastodonAccount object or 404
 */
app.get("/accounts/:id", async (c: Context) => {
  const userId = c.req.param("id");
  const userRepository = c.get("userRepository") as IUserRepository;
  const noteRepository = c.get("noteRepository") as INoteRepository;

  const instanceUrl = process.env.URL || "http://localhost:3000";

  // Find the user
  const user = await userRepository.findById(userId);
  if (!user || user.isDeleted) {
    return c.json({ error: "Record not found" }, 404);
  }

  // Get note count
  const notesCount = await noteRepository.countByUserId(user.id);

  // Build account object
  const account: MastodonAccount = {
    id: user.id,
    username: user.username,
    acct: user.host ? `${user.username}@${user.host}` : user.username,
    display_name: user.displayName || user.username,
    locked: false,
    bot: false,
    created_at: user.createdAt.toISOString(),
    note: user.bio || "",
    url: user.host
      ? `https://${user.host}/@${user.username}`
      : `${instanceUrl}/@${user.username}`,
    avatar: user.avatarUrl || `${instanceUrl}/default-avatar.png`,
    avatar_static: user.avatarUrl || `${instanceUrl}/default-avatar.png`,
    header: user.bannerUrl || "",
    header_static: user.bannerUrl || "",
    followers_count: user.followersCount ?? 0,
    following_count: user.followingCount ?? 0,
    statuses_count: notesCount,
    last_status_at: null,
    emojis: [],
    fields: [],
  };

  return c.json(account);
});

/**
 * Get Account Statuses
 *
 * GET /api/v1/accounts/:id/statuses
 *
 * Returns statuses posted by the specified account.
 *
 * Query Parameters:
 * - max_id: Return results older than this ID
 * - since_id: Return results newer than this ID
 * - min_id: Return results immediately newer than this ID
 * - limit: Maximum number of results (default 20, max 40)
 * - only_media: Filter to only statuses with media attachments
 * - exclude_replies: Filter out statuses in reply to a different account
 * - exclude_reblogs: Filter out boosts
 * - pinned: Filter to only pinned statuses
 * - tagged: Filter to only statuses with the given hashtag
 *
 * @param id - The user ID
 * @returns Array of MastodonStatus objects
 */
app.get("/accounts/:id/statuses", async (c: Context) => {
  const userId = c.req.param("id");
  const userRepository = c.get("userRepository") as IUserRepository;
  const noteRepository = c.get("noteRepository") as INoteRepository;
  const driveFileRepository = c.get("driveFileRepository") as IDriveFileRepository;

  const instanceUrl = process.env.URL || "http://localhost:3000";

  // Parse query parameters
  const limit = Math.min(40, Math.max(1, parseInt(c.req.query("limit") || "20", 10) || 20));
  const maxId = c.req.query("max_id");
  const sinceId = c.req.query("since_id");
  // Note: only_media, exclude_replies, exclude_reblogs, pinned, tagged are not yet implemented

  // Verify user exists
  const user = await userRepository.findById(userId);
  if (!user || user.isDeleted) {
    return c.json({ error: "Record not found" }, 404);
  }

  // Get note count for user
  const notesCount = await noteRepository.countByUserId(user.id);

  // Build account object (reused for all statuses)
  const account: MastodonAccount = {
    id: user.id,
    username: user.username,
    acct: user.host ? `${user.username}@${user.host}` : user.username,
    display_name: user.displayName || user.username,
    locked: false,
    bot: false,
    created_at: user.createdAt.toISOString(),
    note: user.bio || "",
    url: user.host
      ? `https://${user.host}/@${user.username}`
      : `${instanceUrl}/@${user.username}`,
    avatar: user.avatarUrl || `${instanceUrl}/default-avatar.png`,
    avatar_static: user.avatarUrl || `${instanceUrl}/default-avatar.png`,
    header: user.bannerUrl || "",
    header_static: user.bannerUrl || "",
    followers_count: user.followersCount ?? 0,
    following_count: user.followingCount ?? 0,
    statuses_count: notesCount,
    last_status_at: null,
    emojis: [],
    fields: [],
  };

  // Get notes
  const notes = await noteRepository.findByUserId(userId, {
    limit,
    untilId: maxId || undefined,
    sinceId: sinceId || undefined,
  });

  // Build statuses array
  const statuses: MastodonStatus[] = [];

  for (const note of notes) {
    // Skip deleted notes
    if (note.isDeleted) continue;

    // Get media attachments
    const mediaAttachments: MastodonMediaAttachment[] = [];
    if (note.fileIds.length > 0) {
      const files = await driveFileRepository.findByIds(note.fileIds);
      for (const file of files) {
        mediaAttachments.push({
          id: file.id,
          type: convertMediaType(file.type),
          url: file.url,
          preview_url: file.thumbnailUrl,
          remote_url: null,
          meta: {},
          description: file.comment,
          blurhash: file.blurhash,
        });
      }
    }

    statuses.push({
      id: note.id,
      uri: note.uri || `${instanceUrl}/notes/${note.id}`,
      created_at: note.createdAt.toISOString(),
      account,
      content: convertToHtml(note.text),
      visibility: convertVisibility(note.visibility),
      sensitive: note.cw !== null,
      spoiler_text: note.cw || "",
      media_attachments: mediaAttachments,
      application: null,
      mentions: [],
      tags: note.tags.map((tag) => ({
        name: tag,
        url: `${instanceUrl}/tags/${encodeURIComponent(tag)}`,
      })),
      emojis: [],
      reblogs_count: note.renoteCount,
      favourites_count: 0,
      replies_count: note.repliesCount,
      url: `${instanceUrl}/notes/${note.id}`,
      in_reply_to_id: note.replyId,
      in_reply_to_account_id: null,
      reblog: null,
      poll: null,
      card: null,
      language: null,
      edited_at: null,
      favourited: false,
      reblogged: false,
      muted: false,
      bookmarked: false,
      pinned: false,
    });
  }

  return c.json(statuses);
});

export default app;
