/**
 * Crawler Detection Utility
 *
 * Detects embed crawlers from Discord, Slack, and other platforms
 * to serve Open Graph Protocol (OGP) meta tags for rich link previews.
 */

/**
 * Known embed crawler User-Agent patterns
 *
 * These crawlers fetch URLs to generate rich previews when links are shared
 * in chat applications.
 */
const EMBED_CRAWLER_PATTERNS: readonly string[] = [
  // Discord
  "Discordbot",

  // Slack
  "Slackbot-LinkExpanding",
  "Slack-ImgProxy",

  // Twitter/X
  "Twitterbot",

  // Facebook
  "facebookexternalhit",

  // LinkedIn
  "LinkedInBot",

  // Telegram
  "TelegramBot",

  // WhatsApp
  "WhatsApp",

  // iMessage/Apple
  "Applebot",

  // Line (uses "Line/" prefix in User-Agent to avoid matching "Timeline", etc.)
  "Line/",
];

/**
 * Check if a User-Agent string belongs to an embed crawler
 *
 * @param userAgent - User-Agent header value
 * @returns True if the User-Agent matches a known embed crawler
 *
 * @example
 * ```typescript
 * isEmbedCrawler("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)")
 * // => true
 *
 * isEmbedCrawler("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
 * // => false
 *
 * isEmbedCrawler(undefined)
 * // => false
 * ```
 */
export function isEmbedCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) {
    return false;
  }

  // Check if User-Agent contains any known crawler pattern (case-insensitive)
  const lowerUserAgent = userAgent.toLowerCase();
  return EMBED_CRAWLER_PATTERNS.some((pattern) =>
    lowerUserAgent.includes(pattern.toLowerCase())
  );
}

/**
 * Check if an Accept header indicates an ActivityPub request
 *
 * @param accept - Accept header value
 * @returns True if the request is for ActivityPub content
 *
 * @example
 * ```typescript
 * isActivityPubRequest("application/activity+json")
 * // => true
 *
 * isActivityPubRequest("text/html")
 * // => false
 * ```
 */
export function isActivityPubRequest(accept: string | undefined): boolean {
  if (!accept) {
    return false;
  }

  return (
    accept.includes("application/activity+json") ||
    accept.includes("application/ld+json")
  );
}
