/**
 * Image proxy utilities
 *
 * Provides functions to proxy external images through our server
 * to avoid CORS issues with remote ActivityPub servers.
 */

/**
 * Check if URL is external (not on the same origin)
 */
export function isExternalUrl(url: string): boolean {
  if (!url) return false;
  // Relative URLs are not external
  if (url.startsWith('/') && !url.startsWith('//')) return false;
  // Data URLs are not external
  if (url.startsWith('data:')) return false;

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Check if URL points to a local/development domain that shouldn't be proxied
 */
export function isLocalDevelopmentUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    );
  } catch {
    return false;
  }
}

/**
 * Get proxied URL for external images
 * External images are proxied through our server to avoid CORS issues
 * Local development URLs are not proxied as they would be blocked by the proxy
 *
 * @param url - The original image URL
 * @returns The proxied URL for external images, or the original URL for local images
 */
export function getProxiedImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!isExternalUrl(url)) return url;
  // Don't proxy local development URLs - they would be blocked by the proxy anyway
  if (isLocalDevelopmentUrl(url)) return url;
  // Use /api/proxy to ensure the request is routed to the backend API
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}
