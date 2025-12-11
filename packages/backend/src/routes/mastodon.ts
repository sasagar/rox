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
import type { INoteRepository } from "../interfaces/repositories/INoteRepository.js";
import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { ISessionRepository } from "../interfaces/repositories/ISessionRepository.js";
import type { IFollowRepository } from "../interfaces/repositories/IFollowRepository.js";

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
  const followRepository = c.get("followRepository") as IFollowRepository;

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
      // Get counts in parallel
      const [notesCount, followersCount, followingCount] = await Promise.all([
        noteRepository.countByUserId(user.id),
        followRepository.countFollowers(user.id),
        followRepository.countFollowing(user.id),
      ]);

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
        followers_count: followersCount,
        following_count: followingCount,
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

export default app;
