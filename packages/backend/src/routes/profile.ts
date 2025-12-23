/**
 * Profile Routes
 *
 * Handles /@username style URLs for user profiles.
 * Serves OGP HTML for embed crawlers (Discord, Slack, etc.)
 * and ActivityPub actor documents for federation.
 * Browser requests are redirected to the frontend.
 *
 * @module routes/profile
 */

import { Hono } from "hono";
import type { Context } from "hono";
import {
  isEmbedCrawler,
  isActivityPubRequest,
} from "../lib/crawlerDetection.js";
import { generateUserOgpHtml } from "../lib/ogp.js";

const profile = new Hono();

/**
 * Handle OGP request for embed crawlers (Discord, Slack, etc.)
 *
 * @param c - Hono context
 * @param username - Username without @ prefix
 * @param host - Host for remote users (null for local)
 * @returns HTML response with OGP meta tags
 */
async function handleUserOgpRequest(
  c: Context,
  username: string,
  host: string | null,
): Promise<Response> {
  const baseUrl = process.env.URL || "http://localhost:3000";

  // Get user from repository
  const userRepository = c.get("userRepository");
  const user = await userRepository.findByUsername(username, host);

  // Only serve OGP for existing, non-deleted users
  if (!user || user.isDeleted) {
    return c.notFound();
  }

  // Get instance settings
  const instanceSettingsService = c.get("instanceSettingsService");
  const instanceInfo = await instanceSettingsService.getPublicInstanceInfo();

  // Use avatar or fallback to instance icon
  const avatarUrl = user.avatarUrl || instanceInfo.iconUrl;

  const html = generateUserOgpHtml({
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    host: user.host,
    avatarUrl,
    baseUrl,
    instanceName: instanceInfo.name,
    instanceIconUrl: instanceInfo.iconUrl,
    themeColor: instanceInfo.theme.primaryColor,
  });

  return c.html(html, 200, {
    // Cache OGP responses for 5 minutes to reduce load from embed crawlers
    "Cache-Control": "public, max-age=300",
  });
}

/**
 * Parse username parameter from /@username format
 *
 * Supports formats:
 * - "@alice" -> { username: "alice", host: null }
 * - "@alice@mastodon.social" -> { username: "alice", host: "mastodon.social" }
 *
 * @param param - Username parameter with @ prefix
 * @returns Parsed username and host
 */
function parseUserParam(param: string): { username: string; host: string | null } {
  // Remove leading @ if present
  const cleaned = param.startsWith("@") ? param.slice(1) : param;

  // Check for remote user format (username@host)
  const atIndex = cleaned.indexOf("@");
  if (atIndex > 0) {
    return {
      username: cleaned.slice(0, atIndex),
      host: cleaned.slice(atIndex + 1),
    };
  }

  return { username: cleaned, host: null };
}

/**
 * GET /@:username
 *
 * Handles user profile URLs in /@username format.
 * - Embed crawlers (Discord, Slack, etc.) receive OGP HTML
 * - ActivityPub requests for local users are redirected to /users/:username
 * - Browser requests receive redirect to frontend
 *
 * @param username - Username with @ prefix (e.g., "@alice" or "@alice@mastodon.social")
 * @returns OGP HTML, redirect, or 404
 *
 * @example
 * ```bash
 * # Discord crawler (returns OGP HTML)
 * curl -H "User-Agent: Discordbot/2.0" https://example.com/@alice
 *
 * # ActivityPub request (redirects to /users/alice for local users)
 * curl -H "Accept: application/activity+json" https://example.com/@alice
 *
 * # Browser request (receives frontend page)
 * curl https://example.com/@alice
 * ```
 */
profile.get("/@:username", async (c: Context) => {
  const { username: usernameParam } = c.req.param();
  const accept = c.req.header("Accept") || "";
  const userAgent = c.req.header("User-Agent") || "";

  if (!usernameParam) {
    return c.notFound();
  }

  const { username, host } = parseUserParam(usernameParam);

  // Check if this is an ActivityPub request
  if (isActivityPubRequest(accept)) {
    // For local users, redirect to canonical /users/:username endpoint
    // Remote users don't have ActivityPub endpoints on this server
    if (!host) {
      return c.redirect(`/users/${username}`, 301);
    }
    // Remote user ActivityPub should go to their origin server
    return c.notFound();
  }

  // Serve OGP HTML for embed crawlers
  if (isEmbedCrawler(userAgent)) {
    return handleUserOgpRequest(c, username, host);
  }

  // Regular browser request - return 404 so nginx routes to frontend
  // (or we could serve a basic HTML page, but frontend handles this better)
  return c.notFound();
});

export default profile;
