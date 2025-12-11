/**
 * Custom Emoji Atoms
 *
 * Jotai atoms for managing custom emoji state and caching.
 * Provides efficient emoji lookup with batch fetching.
 *
 * @module lib/atoms/customEmoji
 */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { apiClient } from "../api/client";

/**
 * Custom emoji type
 */
export interface CustomEmoji {
  id: string;
  name: string;
  category: string | null;
  aliases: string[];
  url: string;
  isSensitive: boolean;
}

/**
 * Local storage key for emoji cache
 */
const EMOJI_CACHE_KEY = "rox-custom-emoji-cache";

/**
 * Cache expiry time (5 minutes)
 */
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Cached emoji list with timestamp
 */
interface EmojiCache {
  emojis: CustomEmoji[];
  timestamp: number;
}

/**
 * Persisted emoji cache atom
 * Stores the full emoji list in localStorage for faster initial load
 */
export const emojiCacheAtom = atomWithStorage<EmojiCache | null>(EMOJI_CACHE_KEY, null);

/**
 * Emoji list atom
 * Derived from cache or fetched from API
 */
export const emojiListAtom = atom<CustomEmoji[]>((get) => {
  const cache = get(emojiCacheAtom);
  return cache?.emojis ?? [];
});

/**
 * Emoji categories atom
 * Derived from emoji list
 */
export const emojiCategoriesAtom = atom<string[]>((get) => {
  const emojis = get(emojiListAtom);
  const categories = new Set<string>();

  for (const emoji of emojis) {
    if (emoji.category) {
      categories.add(emoji.category);
    }
  }

  return Array.from(categories).sort();
});

/**
 * Emoji map atom
 * Maps emoji name to emoji object for fast lookup
 */
export const emojiMapAtom = atom<Map<string, CustomEmoji>>((get) => {
  const emojis = get(emojiListAtom);
  const map = new Map<string, CustomEmoji>();

  for (const emoji of emojis) {
    // Map by primary name
    map.set(emoji.name, emoji);

    // Also map by aliases
    for (const alias of emoji.aliases) {
      if (!map.has(alias)) {
        map.set(alias, emoji);
      }
    }
  }

  return map;
});

/**
 * Loading state atom
 */
export const emojiLoadingAtom = atom<boolean>(false);

/**
 * Error state atom
 */
export const emojiErrorAtom = atom<string | null>(null);

/**
 * Fetch emoji list action atom
 * Fetches all emojis with pagination to handle large emoji sets
 */
export const fetchEmojisAtom = atom(null, async (get, set, forceRefresh = false) => {
  // Check cache validity
  const cache = get(emojiCacheAtom);
  const now = Date.now();

  if (!forceRefresh && cache && now - cache.timestamp < CACHE_EXPIRY_MS) {
    return cache.emojis;
  }

  set(emojiLoadingAtom, true);
  set(emojiErrorAtom, null);

  try {
    // Fetch emojis with pagination to handle large sets
    const allEmojis: CustomEmoji[] = [];
    let offset = 0;
    const limit = 500; // Fetch in batches of 500
    let hasMore = true;

    while (hasMore) {
      const response = await apiClient.get<{
        emojis: CustomEmoji[];
        total: number;
        limit: number;
        offset: number;
      }>(`/api/emojis?limit=${limit}&offset=${offset}`);

      allEmojis.push(...response.emojis);
      offset += response.emojis.length;
      hasMore = offset < response.total;
    }

    // Update cache
    set(emojiCacheAtom, {
      emojis: allEmojis,
      timestamp: now,
    });

    set(emojiLoadingAtom, false);
    return allEmojis;
  } catch (error) {
    set(emojiLoadingAtom, false);
    set(emojiErrorAtom, error instanceof Error ? error.message : "Failed to load emojis");
    throw error;
  }
});

/**
 * Emojis grouped by category atom
 * Groups emojis by their category for efficient display
 */
export const emojisByCategoryAtom = atom<Map<string, CustomEmoji[]>>((get) => {
  const emojis = get(emojiListAtom);
  const map = new Map<string, CustomEmoji[]>();

  // Group for uncategorized emojis
  const uncategorized: CustomEmoji[] = [];

  for (const emoji of emojis) {
    if (emoji.category) {
      const existing = map.get(emoji.category) || [];
      existing.push(emoji);
      map.set(emoji.category, existing);
    } else {
      uncategorized.push(emoji);
    }
  }

  // Add uncategorized at the end if any
  if (uncategorized.length > 0) {
    map.set("", uncategorized);
  }

  return map;
});

/**
 * In-memory emoji URL cache for batch lookups
 * Maps emoji name to URL
 */
const emojiUrlCache = new Map<string, string>();

/**
 * Pending emoji lookup requests
 * Used to batch multiple requests
 */
let pendingLookups: Set<string> = new Set();
let lookupTimeout: ReturnType<typeof setTimeout> | null = null;
let lookupPromise: Promise<void> | null = null;

/**
 * Batch lookup emojis by name
 * Returns a map of emoji name to URL
 */
export async function lookupEmojis(names: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const uncachedNames: string[] = [];

  // Check cache first
  for (const name of names) {
    const cached = emojiUrlCache.get(name);
    if (cached) {
      result.set(name, cached);
    } else {
      uncachedNames.push(name);
    }
  }

  // If all names are cached, return immediately
  if (uncachedNames.length === 0) {
    return result;
  }

  // Add to pending lookups
  for (const name of uncachedNames) {
    pendingLookups.add(name);
  }

  // Schedule batch lookup
  if (!lookupTimeout) {
    lookupPromise = new Promise<void>((resolve) => {
      lookupTimeout = setTimeout(async () => {
        const namesToLookup = Array.from(pendingLookups);
        pendingLookups = new Set();
        lookupTimeout = null;

        if (namesToLookup.length > 0) {
          try {
            const response = await apiClient.post<{ emojis: Record<string, string> }>(
              "/api/emojis/lookup",
              { names: namesToLookup },
            );

            // Update cache
            for (const [name, url] of Object.entries(response.emojis)) {
              emojiUrlCache.set(name, url);
            }
          } catch (error) {
            console.error("Failed to lookup emojis:", error);
          }
        }

        resolve();
      }, 50); // Batch within 50ms window
    });
  }

  // Wait for batch lookup to complete
  await lookupPromise;

  // Return results including newly cached values
  for (const name of names) {
    const cached = emojiUrlCache.get(name);
    if (cached) {
      result.set(name, cached);
    }
  }

  return result;
}

/**
 * Get single emoji URL by name
 * Uses the batch lookup mechanism
 */
export async function getEmojiUrl(name: string): Promise<string | null> {
  const result = await lookupEmojis([name]);
  return result.get(name) ?? null;
}

/**
 * Clear emoji caches
 */
export function clearEmojiCache(): void {
  emojiUrlCache.clear();
}
