/**
 * oEmbed Response Generator
 *
 * Generates oEmbed responses for rich embeds in Discord, Slack, and other platforms.
 * oEmbed provides structured data that enables richer embeds than OGP alone,
 * including author information, footer/provider info, and timestamps.
 *
 * @see https://oembed.com/
 * @module lib/oembed
 */

import { escapeHtml, truncateText, stripHtml } from "./ogp.js";

/**
 * oEmbed response type
 * We use "rich" type for notes as it supports the most embed features
 */
export type OEmbedType = "rich" | "photo" | "video" | "link";

/**
 * Base oEmbed response structure
 */
export interface OEmbedResponse {
  /** oEmbed version (always "1.0") */
  version: "1.0";
  /** Resource type */
  type: OEmbedType;
  /** Title of the resource */
  title?: string;
  /** Name of the author/owner */
  author_name?: string;
  /** URL for the author/owner */
  author_url?: string;
  /** Name of the provider (instance name) */
  provider_name?: string;
  /** URL of the provider */
  provider_url?: string;
  /** Suggested cache time in seconds */
  cache_age?: number;
  /** Thumbnail URL */
  thumbnail_url?: string;
  /** Thumbnail width */
  thumbnail_width?: number;
  /** Thumbnail height */
  thumbnail_height?: number;
  /** HTML content for rich embeds */
  html?: string;
  /** Width of the embedded content */
  width?: number;
  /** Height of the embedded content */
  height?: number;
}

/**
 * Options for generating note oEmbed response
 */
export interface NoteOEmbedOptions {
  /** Note ID */
  noteId: string;
  /** Note text content */
  text: string | null;
  /** Content Warning text */
  cw: string | null;
  /** Author username */
  authorUsername: string;
  /** Author display name */
  authorDisplayName: string | null;
  /** Author host (null for local users) */
  authorHost: string | null;
  /** Author avatar URL */
  authorAvatarUrl: string | null;
  /** First image URL from attachments */
  imageUrl: string | null;
  /** Note creation timestamp (ISO string) */
  createdAt: string | null;
  /** Instance base URL */
  baseUrl: string;
  /** Instance name */
  instanceName: string;
  /** Instance icon URL */
  instanceIconUrl: string | null;
}

/**
 * Options for generating user profile oEmbed response
 */
export interface UserOEmbedOptions {
  /** Username */
  username: string;
  /** Display name */
  displayName: string | null;
  /** User bio */
  bio: string | null;
  /** Host (null for local users) */
  host: string | null;
  /** Avatar URL */
  avatarUrl: string | null;
  /** Instance base URL */
  baseUrl: string;
  /** Instance name */
  instanceName: string;
  /** Instance icon URL */
  instanceIconUrl: string | null;
}

/**
 * Format username with host for display
 *
 * @param username - Username
 * @param host - Host (null for local users)
 * @returns Formatted username (e.g., "@alice" or "@alice@mastodon.social")
 */
function formatUsername(username: string, host: string | null): string {
  return host ? `@${username}@${host}` : `@${username}`;
}

/**
 * Generate oEmbed response for a note
 *
 * Discord uses oEmbed for rich embed fields like:
 * - author_name → Displays as embed author
 * - author_url → Author name becomes clickable
 * - provider_name → Displays in embed footer
 * - provider_url → Footer becomes clickable
 * - thumbnail_url → Displays as thumbnail (right side for rich, large for photo)
 *
 * @param options - Note oEmbed options
 * @returns oEmbed response object
 *
 * @example
 * ```typescript
 * const response = generateNoteOEmbed({
 *   noteId: "abc123",
 *   text: "Hello, world!",
 *   authorUsername: "alice",
 *   authorDisplayName: "Alice",
 *   authorHost: null,
 *   authorAvatarUrl: "https://example.com/avatar.jpg",
 *   baseUrl: "https://example.com",
 *   instanceName: "My Instance",
 *   instanceIconUrl: "https://example.com/icon.png",
 * });
 * ```
 */
export function generateNoteOEmbed(options: NoteOEmbedOptions): OEmbedResponse {
  const {
    authorUsername,
    authorDisplayName,
    authorHost,
    authorAvatarUrl,
    imageUrl,
    baseUrl,
    instanceName,
  } = options;

  const formattedUsername = formatUsername(authorUsername, authorHost);
  const displayName = authorDisplayName || authorUsername;

  // Build author URL (profile page)
  const authorUrl = authorHost
    ? `${baseUrl}/@${authorUsername}@${authorHost}`
    : `${baseUrl}/@${authorUsername}`;

  // Determine thumbnail (prefer note image, fallback to author avatar)
  const thumbnailUrl = imageUrl || authorAvatarUrl;

  // Use "link" type so Discord uses OGP title/description while we provide author/provider info
  // Note: Do NOT include "title" in oEmbed - Discord will use og:title from OGP instead
  // This avoids duplicate display of information
  const response: OEmbedResponse = {
    version: "1.0",
    type: "link",
    // Author info - maps to Discord embed author section (small text above title)
    author_name: `${displayName} (${formattedUsername})`,
    author_url: authorUrl,
    // Provider info - maps to Discord embed footer
    provider_name: instanceName,
    provider_url: baseUrl,
    // Cache for 5 minutes
    cache_age: 300,
  };

  // Add thumbnail if available
  if (thumbnailUrl) {
    response.thumbnail_url = thumbnailUrl;
    // Use square dimensions for avatars, larger for note images
    if (imageUrl) {
      response.thumbnail_width = 400;
      response.thumbnail_height = 300;
    } else {
      response.thumbnail_width = 128;
      response.thumbnail_height = 128;
    }
  }

  return response;
}

/**
 * Generate oEmbed response for a user profile
 *
 * @param options - User profile oEmbed options
 * @returns oEmbed response object
 *
 * @example
 * ```typescript
 * const response = generateUserOEmbed({
 *   username: "alice",
 *   displayName: "Alice",
 *   bio: "Hello, I'm Alice!",
 *   host: null,
 *   avatarUrl: "https://example.com/avatar.jpg",
 *   baseUrl: "https://example.com",
 *   instanceName: "My Instance",
 *   instanceIconUrl: "https://example.com/icon.png",
 * });
 * ```
 */
export function generateUserOEmbed(options: UserOEmbedOptions): OEmbedResponse {
  const {
    username,
    displayName,
    bio,
    host,
    avatarUrl,
    baseUrl,
    instanceName,
  } = options;

  const formattedUsername = formatUsername(username, host);

  // Profile URL
  const profileUrl = host
    ? `${baseUrl}/@${username}@${host}`
    : `${baseUrl}/@${username}`;

  // Build title from bio or default
  const title = bio
    ? truncateText(stripHtml(bio), 200)
    : `View ${formattedUsername}'s profile`;

  const response: OEmbedResponse = {
    version: "1.0",
    type: "rich",
    title,
    // Author info - the user themselves
    author_name: displayName ? `${displayName} (${formattedUsername})` : formattedUsername,
    author_url: profileUrl,
    // Provider info
    provider_name: instanceName,
    provider_url: baseUrl,
    // Cache for 5 minutes
    cache_age: 300,
  };

  // Add avatar as thumbnail if available
  if (avatarUrl) {
    response.thumbnail_url = avatarUrl;
    response.thumbnail_width = 128;
    response.thumbnail_height = 128;
  }

  return response;
}

/**
 * Generate oEmbed discovery link HTML for embedding in OGP pages
 *
 * @param oembedUrl - Full URL to the oEmbed endpoint
 * @returns HTML link tag string
 *
 * @example
 * ```typescript
 * const link = generateOEmbedDiscoveryLink(
 *   "https://example.com/oembed?url=https://example.com/notes/abc123"
 * );
 * // Returns: <link rel="alternate" type="application/json+oembed" href="..." title="oEmbed">
 * ```
 */
export function generateOEmbedDiscoveryLink(oembedUrl: string): string {
  return `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(oembedUrl)}" title="oEmbed">`;
}
