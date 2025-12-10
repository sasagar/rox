/**
 * Utility functions for fetching instance icons from ActivityPub servers
 *
 * This module provides shared logic for fetching instance icons/favicons
 * from remote servers, used by both RemoteInstanceService and
 * RemoteInstanceRefreshService.
 */

import { logger } from "./logger.js";

/**
 * Try to fetch instance icon from software-specific APIs, then fall back to favicon
 *
 * @param host - The hostname of the remote instance
 * @param softwareName - The software name (e.g., "misskey", "mastodon")
 * @returns The icon URL if found, null otherwise
 */
export async function fetchInstanceIcon(
  host: string,
  softwareName: string | null,
): Promise<string | null> {
  // Try software-specific APIs first
  const iconUrl = await fetchInstanceIconFromApi(host, softwareName);
  if (iconUrl) {
    return iconUrl;
  }

  // Fall back to favicon
  return fetchFavicon(host);
}

/**
 * Fetch instance icon from software-specific API
 *
 * Different ActivityPub server implementations expose their instance icon
 * through different APIs. This function attempts to fetch the icon using
 * the appropriate API based on the software name.
 *
 * @param host - The hostname of the remote instance
 * @param softwareName - The software name (e.g., "misskey", "mastodon")
 * @returns The icon URL if found, null otherwise
 */
export async function fetchInstanceIconFromApi(
  host: string,
  softwareName: string | null,
): Promise<string | null> {
  const normalizedName = softwareName?.toLowerCase();

  try {
    // Misskey and forks (Misskey, Firefish, Sharkey, Foundkey, etc.)
    if (
      normalizedName === "misskey" ||
      normalizedName === "firefish" ||
      normalizedName === "sharkey" ||
      normalizedName === "foundkey" ||
      normalizedName === "calckey" ||
      normalizedName === "cherrypick"
    ) {
      const response = await fetch(`https://${host}/api/meta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const meta = (await response.json()) as { iconUrl?: string; uri?: string };
        if (meta.iconUrl) {
          // iconUrl may be relative or absolute
          if (meta.iconUrl.startsWith("http")) {
            return meta.iconUrl;
          }
          return `https://${host}${meta.iconUrl}`;
        }
      }
    }

    // Mastodon and forks (Mastodon, Hometown, Glitch-soc, etc.)
    if (
      normalizedName === "mastodon" ||
      normalizedName === "hometown" ||
      normalizedName === "glitch" ||
      normalizedName === "kmyblue"
    ) {
      const response = await fetch(`https://${host}/api/v2/instance`, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const instance = (await response.json()) as {
          thumbnail?: { url?: string };
        };
        if (instance.thumbnail?.url) {
          return instance.thumbnail.url;
        }
      }

      // Fall back to v1 API for older Mastodon versions
      const v1Response = await fetch(`https://${host}/api/v1/instance`, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (v1Response.ok) {
        const instance = (await v1Response.json()) as { thumbnail?: string };
        if (instance.thumbnail) {
          return instance.thumbnail;
        }
      }
    }

    // Pleroma / Akkoma
    if (normalizedName === "pleroma" || normalizedName === "akkoma") {
      const response = await fetch(`https://${host}/api/v1/instance`, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const instance = (await response.json()) as { thumbnail?: string };
        if (instance.thumbnail) {
          return instance.thumbnail;
        }
      }
    }

    // GoToSocial
    if (normalizedName === "gotosocial") {
      const response = await fetch(`https://${host}/api/v1/instance`, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const instance = (await response.json()) as { thumbnail?: string };
        if (instance.thumbnail) {
          return instance.thumbnail;
        }
      }
    }

    // If software is unknown, try common APIs
    if (!normalizedName) {
      // Try Mastodon API first (most common)
      try {
        const response = await fetch(`https://${host}/api/v1/instance`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const instance = (await response.json()) as { thumbnail?: string };
          if (instance.thumbnail) {
            return instance.thumbnail;
          }
        }
      } catch {
        // Ignore and try next
      }

      // Try Misskey API
      try {
        const response = await fetch(`https://${host}/api/meta`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const meta = (await response.json()) as { iconUrl?: string };
          if (meta.iconUrl) {
            if (meta.iconUrl.startsWith("http")) {
              return meta.iconUrl;
            }
            return `https://${host}${meta.iconUrl}`;
          }
        }
      } catch {
        // Ignore
      }
    }
  } catch (error) {
    logger.debug({ err: error, host, softwareName }, "Failed to fetch instance icon from API");
  }

  return null;
}

/**
 * Try to fetch favicon from the remote server (fallback)
 *
 * This is used as a fallback when software-specific APIs don't provide an icon.
 *
 * @param host - The hostname of the remote instance
 * @returns The favicon URL if found, null otherwise
 */
export async function fetchFavicon(host: string): Promise<string | null> {
  // Try common favicon paths
  const faviconPaths = ["/favicon.ico", "/favicon.png", "/apple-touch-icon.png"];

  for (const path of faviconPaths) {
    try {
      const url = `https://${host}${path}`;
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.startsWith("image/")) {
          return url;
        }
      }
    } catch {
      // Ignore errors, try next path
    }
  }

  return null;
}
