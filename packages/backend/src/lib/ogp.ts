/**
 * Open Graph Protocol (OGP) HTML Generator
 *
 * Generates minimal HTML documents with OGP and Twitter Card meta tags
 * for rich link previews in Discord, Slack, and other platforms.
 *
 * The generated HTML is kept under 32KB for Slack compatibility.
 */

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param text - Text to escape
 * @returns Escaped text safe for HTML attributes
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 200)
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength = 200): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1).trimEnd() + "…";
}

/**
 * Strip HTML tags from text for plain text descriptions
 *
 * @param html - HTML string to strip
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Options for generating Note OGP HTML
 */
export interface NoteOgpOptions {
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
  /** First image URL from attachments */
  imageUrl: string | null;
  /** Instance base URL */
  baseUrl: string;
  /** Instance name */
  instanceName: string;
  /** Theme color (hex) */
  themeColor: string;
}

/**
 * Options for generating User Profile OGP HTML
 */
export interface UserOgpOptions {
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
  /** Theme color (hex) */
  themeColor: string;
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
 * Generate minimal HTML with OGP meta tags for a note
 *
 * @param options - Note OGP options
 * @returns HTML string with OGP meta tags
 *
 * @example
 * ```typescript
 * const html = generateNoteOgpHtml({
 *   noteId: "abc123",
 *   text: "Hello, world!",
 *   cw: null,
 *   authorUsername: "alice",
 *   authorDisplayName: "Alice",
 *   authorHost: null,
 *   imageUrl: null,
 *   baseUrl: "https://example.com",
 *   instanceName: "My Instance",
 *   themeColor: "#3b82f6",
 * });
 * ```
 */
export function generateNoteOgpHtml(options: NoteOgpOptions): string {
  const {
    noteId,
    text,
    cw,
    authorUsername,
    authorDisplayName,
    authorHost,
    imageUrl,
    baseUrl,
    instanceName,
    themeColor,
  } = options;

  const formattedUsername = formatUsername(authorUsername, authorHost);
  const displayName = authorDisplayName || authorUsername;
  const noteUrl = `${baseUrl}/notes/${noteId}`;

  // Determine title and description based on CW
  let title: string;
  let description: string;

  if (cw) {
    // Content Warning present: show CW as main content indicator
    title = `CW: ${escapeHtml(truncateText(cw, 60))}`;
    description = "This note contains sensitive content.";
  } else if (text) {
    // Regular note with text
    const plainText = stripHtml(text);
    title = `Note by ${displayName} (${formattedUsername})`;
    description = escapeHtml(truncateText(plainText, 200));
  } else {
    // Media-only or renote
    title = `Note by ${displayName} (${formattedUsername})`;
    description = "View this note for more details.";
  }

  // Escape values for HTML attributes
  const escapedTitle = escapeHtml(title);
  const escapedDescription = description; // Already escaped above or literal string
  const escapedNoteUrl = escapeHtml(noteUrl);
  const escapedInstanceName = escapeHtml(instanceName);
  const escapedThemeColor = escapeHtml(themeColor);

  // Determine Twitter card type based on image presence
  const twitterCard = imageUrl ? "summary_large_image" : "summary";

  // Build image meta tag if present
  const imageMeta = imageUrl
    ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">\n  `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  ${imageMeta}<meta property="og:url" content="${escapedNoteUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${escapedInstanceName}">
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="theme-color" content="${escapedThemeColor}">
  <title>${escapedTitle} - ${escapedInstanceName}</title>
  <meta http-equiv="refresh" content="0;url=${escapedNoteUrl}">
</head>
<body>
  <p>Redirecting to <a href="${escapedNoteUrl}">note</a>...</p>
</body>
</html>`;
}

/**
 * Generate minimal HTML with OGP meta tags for a user profile
 *
 * @param options - User profile OGP options
 * @returns HTML string with OGP meta tags
 *
 * @example
 * ```typescript
 * const html = generateUserOgpHtml({
 *   username: "alice",
 *   displayName: "Alice",
 *   bio: "Hello, I'm Alice!",
 *   host: null,
 *   avatarUrl: "https://example.com/avatar.jpg",
 *   baseUrl: "https://example.com",
 *   instanceName: "My Instance",
 *   themeColor: "#3b82f6",
 * });
 * ```
 */
export function generateUserOgpHtml(options: UserOgpOptions): string {
  const {
    username,
    displayName,
    bio,
    host,
    avatarUrl,
    baseUrl,
    instanceName,
    themeColor,
  } = options;

  const formattedUsername = formatUsername(username, host);

  // Profile URL is /@username for local users, /@username@host for remote
  const profileUrl = host
    ? `${baseUrl}/@${username}@${host}`
    : `${baseUrl}/@${username}`;

  // Build title
  const title = displayName
    ? `${displayName} (${formattedUsername})`
    : formattedUsername;

  // Build description from bio or default
  const description = bio
    ? truncateText(stripHtml(bio), 200)
    : `View ${formattedUsername}'s profile`;

  // Escape values for HTML attributes
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedProfileUrl = escapeHtml(profileUrl);
  const escapedInstanceName = escapeHtml(instanceName);
  const escapedThemeColor = escapeHtml(themeColor);

  // Build image meta tag if avatar present
  const imageMeta = avatarUrl
    ? `<meta property="og:image" content="${escapeHtml(avatarUrl)}">\n  `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  ${imageMeta}<meta property="og:url" content="${escapedProfileUrl}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${escapedInstanceName}">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="${escapedThemeColor}">
  <title>${escapedTitle} - ${escapedInstanceName}</title>
  <meta http-equiv="refresh" content="0;url=${escapedProfileUrl}">
</head>
<body>
  <p>Redirecting to <a href="${escapedProfileUrl}">profile</a>...</p>
</body>
</html>`;
}
