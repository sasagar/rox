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
  /** Author avatar URL for fallback */
  authorAvatarUrl?: string | null;
  /** Note creation timestamp (ISO string) */
  createdAt?: string | null;
  /** Instance base URL */
  baseUrl: string;
  /** Instance name */
  instanceName: string;
  /** Instance icon URL */
  instanceIconUrl?: string | null;
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
  /** Instance icon URL */
  instanceIconUrl?: string | null;
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
    authorAvatarUrl,
    createdAt,
    baseUrl,
    instanceName,
    instanceIconUrl,
    themeColor,
  } = options;

  const formattedUsername = formatUsername(authorUsername, authorHost);
  const displayName = authorDisplayName || authorUsername;
  const noteUrl = `${baseUrl}/notes/${noteId}`;
  const authorUrl = authorHost
    ? `${baseUrl}/@${authorUsername}@${authorHost}`
    : `${baseUrl}/@${authorUsername}`;

  // Determine title and description based on CW
  // FxTwitter-style: og:title = author name, og:description = full note text
  // This allows Discord to display the full note text without truncation
  let title: string;
  let description: string;

  // Title is always the author info (like FxTwitter)
  title = `${displayName} (${formattedUsername})`;

  if (cw) {
    // Content Warning present: show CW indicator + hidden content notice
    description = `⚠️ CW: ${truncateText(cw, 100)}`;
  } else if (text) {
    // Regular note: show full text in description (Discord displays this as embed body)
    const plainText = stripHtml(text);
    // Use longer truncation for description to show more content
    description = truncateText(plainText, 4096);
  } else {
    // Media-only or renote
    description = "📷 Media attached";
  }

  // Escape values for HTML attributes
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedNoteUrl = escapeHtml(noteUrl);
  const escapedAuthorUrl = escapeHtml(authorUrl);
  const escapedInstanceName = escapeHtml(instanceName);
  const escapedThemeColor = escapeHtml(themeColor);
  const escapedDisplayName = escapeHtml(displayName);

  // Use fixed "tweet" card type like FxTwitter for better Discord embed rendering
  // The "tweet" type triggers special X/Twitter-like embed styling in Discord
  // This provides consistent behavior regardless of image presence
  const twitterCard = "tweet";

  // Use note image, fallback to author avatar, then instance icon
  const finalImageUrl = imageUrl || authorAvatarUrl;

  // Build comprehensive image meta tags for better embed support
  let imageMeta = "";
  if (finalImageUrl) {
    const escapedImageUrl = escapeHtml(finalImageUrl);
    const imageAlt = text
      ? escapeHtml(truncateText(stripHtml(text), 100))
      : `Note by ${escapedDisplayName}`;
    imageMeta = `<meta property="og:image" content="${escapedImageUrl}">
  <meta property="og:image:alt" content="${imageAlt}">
  <meta name="twitter:image" content="${escapedImageUrl}">
  <meta name="twitter:image:alt" content="${imageAlt}">
  `;
    // Add image dimensions hint for large images (Discord/Slack optimization)
    if (imageUrl) {
      imageMeta += `<meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  `;
    }
  }

  // Build article metadata for better Discord/Slack embeds
  let articleMeta = "";
  if (createdAt) {
    articleMeta += `<meta property="article:published_time" content="${escapeHtml(createdAt)}">
  `;
  }
  articleMeta += `<meta property="article:author" content="${escapedAuthorUrl}">
  `;

  // Build provider/footer meta for Discord embeds
  let providerMeta = "";
  if (instanceIconUrl) {
    providerMeta = `<link rel="icon" href="${escapeHtml(instanceIconUrl)}" type="image/png">
  `;
  }

  // Build oEmbed discovery link for rich embeds (Discord, Slack)
  const oembedUrl = `${baseUrl}/oembed?url=${encodeURIComponent(noteUrl)}`;
  const oembedLink = `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(oembedUrl)}" title="oEmbed">
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${providerMeta}${oembedLink}<!-- Open Graph / Facebook -->
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedNoteUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${escapedInstanceName}">
  <meta property="og:locale" content="ja_JP">
  ${imageMeta}${articleMeta}<!-- Twitter -->
  <meta name="twitter:card" content="${twitterCard}">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:site" content="${escapedInstanceName}">
  <!-- Discord / Slack / Other -->
  <meta name="theme-color" content="${escapedThemeColor}">
  <meta name="author" content="${escapedDisplayName}">
  <!-- Page -->
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
    instanceIconUrl,
    themeColor,
  } = options;

  const formattedUsername = formatUsername(username, host);
  const name = displayName || username;

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
    ? truncateText(stripHtml(bio), 300)
    : `View ${formattedUsername}'s profile on ${instanceName}`;

  // Escape values for HTML attributes
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedProfileUrl = escapeHtml(profileUrl);
  const escapedInstanceName = escapeHtml(instanceName);
  const escapedThemeColor = escapeHtml(themeColor);
  const escapedName = escapeHtml(name);

  // Build comprehensive image meta tags for better embed support
  let imageMeta = "";
  if (avatarUrl) {
    const escapedAvatarUrl = escapeHtml(avatarUrl);
    imageMeta = `<meta property="og:image" content="${escapedAvatarUrl}">
  <meta property="og:image:alt" content="${escapedName}'s avatar">
  <meta property="og:image:width" content="400">
  <meta property="og:image:height" content="400">
  <meta name="twitter:image" content="${escapedAvatarUrl}">
  <meta name="twitter:image:alt" content="${escapedName}'s avatar">
  `;
  }

  // Build profile metadata
  const profileMeta = `<meta property="profile:username" content="${escapeHtml(username)}">
  `;

  // Build provider/footer meta for Discord embeds
  let providerMeta = "";
  if (instanceIconUrl) {
    providerMeta = `<link rel="icon" href="${escapeHtml(instanceIconUrl)}" type="image/png">
  `;
  }

  // Build oEmbed discovery link for rich embeds (Discord, Slack)
  const oembedUrl = `${baseUrl}/oembed?url=${encodeURIComponent(profileUrl)}`;
  const oembedLink = `<link rel="alternate" type="application/json+oembed" href="${escapeHtml(oembedUrl)}" title="oEmbed">
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${providerMeta}${oembedLink}<!-- Open Graph / Facebook -->
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedProfileUrl}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${escapedInstanceName}">
  <meta property="og:locale" content="ja_JP">
  ${imageMeta}${profileMeta}<!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:site" content="${escapedInstanceName}">
  <!-- Discord / Slack / Other -->
  <meta name="theme-color" content="${escapedThemeColor}">
  <meta name="author" content="${escapedName}">
  <!-- Page -->
  <title>${escapedTitle} - ${escapedInstanceName}</title>
  <meta http-equiv="refresh" content="0;url=${escapedProfileUrl}">
</head>
<body>
  <p>Redirecting to <a href="${escapedProfileUrl}">profile</a>...</p>
</body>
</html>`;
}
