/**
 * ActivityPub Actor Routes
 *
 * Provides Actor document endpoints for ActivityPub federation.
 * Returns JSON-LD Person objects representing users.
 * Also serves Open Graph Protocol (OGP) HTML for embed crawlers (Discord, Slack, etc.)
 * to enable rich link previews when profile URLs are shared.
 *
 * @module routes/ap/actor
 */

import { Hono } from "hono";
import type { Context } from "hono";
import {
  isEmbedCrawler,
  isActivityPubRequest,
} from "../../lib/crawlerDetection.js";
import { generateUserOgpHtml } from "../../lib/ogp.js";

const actor = new Hono();

/**
 * Handle OGP request for embed crawlers (Discord, Slack, etc.)
 *
 * @param c - Hono context
 * @returns HTML response with OGP meta tags
 */
async function handleUserOgpRequest(c: Context): Promise<Response> {
  const { username } = c.req.param();
  const baseUrl = process.env.URL || "http://localhost:3000";

  // Get user from repository
  const userRepository = c.get("userRepository");
  const user = await userRepository.findByUsername(username as string);

  // Only serve OGP for local, non-deleted users
  if (!user || user.host !== null || user.isDeleted) {
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
    host: null, // Local user
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
 * GET /:username
 *
 * Returns ActivityPub Actor document for a local user.
 * Also serves OGP HTML for embed crawlers (Discord, Slack, etc.)
 * Content negotiation is performed based on the Accept header and User-Agent.
 *
 * @param username - Username of the actor
 * @returns Actor document (JSON-LD), OGP HTML, or redirect to frontend
 *
 * @example
 * ```bash
 * # ActivityPub request
 * curl -H "Accept: application/activity+json" https://example.com/users/alice
 *
 * # Discord/Slack crawler (returns OGP HTML)
 * curl -H "User-Agent: Discordbot/2.0" https://example.com/users/alice
 * ```
 */
actor.get("/:username", async (c: Context) => {
  const { username } = c.req.param();
  const accept = c.req.header("Accept") || "";
  const userAgent = c.req.header("User-Agent") || "";

  // Check if this is an ActivityPub request
  if (isActivityPubRequest(accept)) {
    // Continue with ActivityPub handling below
  } else if (isEmbedCrawler(userAgent)) {
    // Serve OGP HTML for embed crawlers
    return handleUserOgpRequest(c);
  } else {
    // Regular browser request - redirect to frontend
    return c.redirect(`/@${username}`);
  }

  const userRepository = c.get("userRepository");
  const user = await userRepository.findByUsername(username as string);

  // 404 if user not found or is a remote user
  if (!user || user.host !== null) {
    return c.notFound();
  }

  // 410 Gone if user is deleted (ActivityPub spec compliance)
  if (user.isDeleted) {
    const baseUrl = process.env.URL || "http://localhost:3000";
    // Return a Tombstone object for deleted actors
    return c.json(
      {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: `${baseUrl}/users/${user.username}`,
        type: "Tombstone",
        deleted: user.deletedAt?.toISOString(),
      },
      410,
      {
        "Content-Type": "application/activity+json; charset=utf-8",
      },
    );
  }

  const baseUrl = process.env.URL || "http://localhost:3000";

  // Determine actor type: Application for system user, Person for regular users
  const actorType = user.isSystemUser ? "Application" : "Person";

  // Build ActivityPub Actor document
  const actorDocument: Record<string, unknown> = {
    "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
    id: `${baseUrl}/users/${user.username}`,
    type: actorType,
    preferredUsername: user.username,
    name: user.displayName || user.username,
    summary: user.bio || "",
    inbox: `${baseUrl}/users/${user.username}/inbox`,
    outbox: `${baseUrl}/users/${user.username}/outbox`,
    followers: `${baseUrl}/users/${user.username}/followers`,
    following: `${baseUrl}/users/${user.username}/following`,
    icon: user.avatarUrl
      ? {
          type: "Image",
          mediaType: "image/jpeg",
          url: user.avatarUrl,
        }
      : undefined,
    image: user.bannerUrl
      ? {
          type: "Image",
          mediaType: "image/jpeg",
          url: user.bannerUrl,
        }
      : undefined,
    publicKey: {
      id: `${baseUrl}/users/${user.username}#main-key`,
      owner: `${baseUrl}/users/${user.username}`,
      publicKeyPem: user.publicKey,
    },
    endpoints: {
      sharedInbox: `${baseUrl}/inbox`,
    },
  };

  // Add migration-related fields if present
  if (user.alsoKnownAs && user.alsoKnownAs.length > 0) {
    actorDocument.alsoKnownAs = user.alsoKnownAs;
  }
  if (user.movedTo) {
    actorDocument.movedTo = user.movedTo;
  }

  return c.json(actorDocument, 200, {
    "Content-Type": "application/activity+json; charset=utf-8",
    // Cache actor documents for 1 hour (ActivityPub spec recommends caching)
    "Cache-Control": "public, max-age=3600",
  });
});

export default actor;
