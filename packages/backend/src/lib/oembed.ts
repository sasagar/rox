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

import { escapeHtml } from "./ogp.js";

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
 * Generate oEmbed response for a note
 *
 * Discord uses oEmbed for rich embed fields like:
 * - author_name → Displays as embed author (with Fediverse-style @user@domain format)
 * - author_url → Author name becomes clickable
 * - title → Note title/excerpt
 * - provider_name → Displays in embed footer
 * - provider_url → Footer becomes clickable
 * - thumbnail_url → Displays as thumbnail (right side for rich, large for photo)
 *
 * Best practices for ActivityPub/Fediverse:
 * - Include both author and provider information
 * - Use Fediverse ID format for author_name: "Display Name (@user@domain)"
 * - Include title for better context
 * - Optionally include html with blockquote markup
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
    noteId,
    text,
    cw,
    authorUsername,
    authorDisplayName,
    authorHost,
    authorAvatarUrl,
    imageUrl,
    baseUrl,
    instanceName,
  } = options;

  // Determine thumbnail (prefer note image, fallback to author avatar)
  const thumbnailUrl = imageUrl || authorAvatarUrl;

  // Build Fediverse-style author name: "Display Name (@user@domain)"
  const displayName = authorDisplayName || authorUsername;
  const domain = authorHost || new URL(baseUrl).hostname;
  const authorName = `${displayName} (@${authorUsername}@${domain})`;

  // Build author profile URL
  const authorUrl = `${baseUrl}/@${authorUsername}${authorHost ? `@${authorHost}` : ""}`;

  // Build title from CW or text excerpt
  const title = cw || (text ? text.substring(0, 200) : "Note");

  // Discord uses both OGP and oEmbed:
  // - OGP provides static information (title, description, image)
  // - oEmbed provides dynamic structure (author, provider hierarchy)
  // Both author_name and provider_name are included for proper attribution
  const response: OEmbedResponse = {
    version: "1.0",
    type: "rich",
    // Title of the note (excerpt)
    title: title,
    // Author information - displays as embed author with Fediverse ID
    author_name: authorName,
    author_url: authorUrl,
    // Provider info - displayed in footer
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

  // Optionally add HTML content for rich rendering
  // Some platforms may render this instead of constructing their own embed
  if (text) {
    const escapedText = escapeHtml(text);
    const noteUrl = `${baseUrl}/notes/${noteId}`;
    response.html = `<blockquote class="activitypub-post"><p>${escapedText}</p><cite><a href="${escapeHtml(authorUrl)}">${escapeHtml(authorName)}</a> · <a href="${escapeHtml(noteUrl)}">${escapeHtml(instanceName)}</a></cite></blockquote>`;
  }

  return response;
}

/**
 * Generate oEmbed response for a user profile
 *
 * Best practices for ActivityPub/Fediverse user profiles:
 * - Include author information with Fediverse ID format
 * - Include title (display name or bio excerpt)
 * - Include provider information for instance attribution
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

  // Build Fediverse-style author name: "Display Name (@user@domain)"
  const name = displayName || username;
  const domain = host || new URL(baseUrl).hostname;
  const authorName = `${name} (@${username}@${domain})`;

  // Build author profile URL
  const authorUrl = `${baseUrl}/@${username}${host ? `@${host}` : ""}`;

  // Build title from display name or bio excerpt
  const title = displayName || (bio ? bio.substring(0, 200) : `@${username}`);

  // Discord uses both OGP and oEmbed for user profiles
  const response: OEmbedResponse = {
    version: "1.0",
    type: "rich",
    // Title of the profile
    title: title,
    // Author information - displays as embed author with Fediverse ID
    author_name: authorName,
    author_url: authorUrl,
    // Provider info - displayed in footer
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

  // Optionally add HTML content for rich rendering
  if (bio) {
    const escapedBio = escapeHtml(bio);
    response.html = `<blockquote class="activitypub-profile"><p>${escapedBio}</p><cite><a href="${escapeHtml(authorUrl)}">${escapeHtml(authorName)}</a> · <a href="${escapeHtml(baseUrl)}">${escapeHtml(instanceName)}</a></cite></blockquote>`;
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
