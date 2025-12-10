/**
 * Remote Likes Service
 *
 * Fetches likes/reactions from remote ActivityPub servers for remote notes.
 * This allows displaying reaction counts on remote notes that were originally
 * created on other servers.
 *
 * @module services/ap/RemoteLikesService
 */

import { RemoteFetchService, type SignatureConfig } from "./RemoteFetchService.js";
import type { IReactionRepository } from "../../interfaces/repositories/IReactionRepository.js";
import type { INoteRepository } from "../../interfaces/repositories/INoteRepository.js";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { ICustomEmojiRepository } from "../../interfaces/repositories/ICustomEmojiRepository.js";
import { generateId } from "shared";
import { logger } from "../../lib/logger.js";

/**
 * ActivityPub Collection interface (OrderedCollection or Collection)
 */
interface APCollection {
  "@context"?: string | string[];
  type: string;
  totalItems?: number;
  first?: string | APCollectionPage;
  items?: Array<string | APLike>;
  orderedItems?: Array<string | APLike>;
}

/**
 * Misskey API reaction response
 */
interface MisskeyReaction {
  id: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    host: string | null;
    name?: string;
    avatarUrl?: string;
  };
  type: string; // Reaction emoji or custom emoji like ":emoji@.:"
}

/**
 * Misskey emoji object from /api/emojis
 */
interface MisskeyEmoji {
  name: string;
  url: string;
  aliases?: string[];
  category?: string;
}

/**
 * ActivityPub Collection Page
 */
interface APCollectionPage {
  "@context"?: string | string[];
  type: string;
  totalItems?: number;
  next?: string;
  items?: Array<string | APLike>;
  orderedItems?: Array<string | APLike>;
}

/**
 * ActivityPub Like object
 */
interface APLike {
  "@context"?: string | string[];
  type: string;
  id?: string;
  actor: string;
  object: string;
  content?: string; // Misskey custom emoji
  _misskey_reaction?: string; // Misskey-specific reaction
  tag?: Array<{
    type: string;
    id?: string;
    name?: string;
    icon?: { url: string };
  }>;
}

/**
 * Rate limit state for a host
 */
interface HostRateLimitState {
  /** Timestamp of last request */
  lastRequest: number;
  /** Number of consecutive failures */
  failures: number;
  /** Timestamp when cooldown expires (if in cooldown) */
  cooldownUntil?: number;
}

/**
 * Remote Likes Service
 *
 * Fetches and processes likes from remote ActivityPub servers.
 * Supports both standard ActivityPub likes and Misskey-style reactions.
 *
 * Includes per-host rate limiting to avoid overwhelming remote servers.
 */
export class RemoteLikesService {
  private fetchService: RemoteFetchService;

  /**
   * Per-host rate limiting state
   * Prevents overwhelming remote servers with too many requests
   */
  private static hostRateLimits: Map<string, HostRateLimitState> = new Map();

  /**
   * Minimum interval between requests to the same host (ms)
   */
  private static readonly MIN_REQUEST_INTERVAL = 1000;

  /**
   * Cooldown duration after failures (ms)
   * Exponential backoff: 5s, 10s, 20s, 40s, max 60s
   */
  private static readonly BASE_COOLDOWN = 5000;
  private static readonly MAX_COOLDOWN = 60000;

  /**
   * Max failures before entering extended cooldown
   */
  private static readonly MAX_FAILURES = 5;

  /**
   * HTTP Signature configuration for authenticated fetches
   */
  private signatureConfig?: SignatureConfig;

  constructor(
    private reactionRepository: IReactionRepository,
    private noteRepository: INoteRepository,
    private userRepository: IUserRepository,
    private customEmojiRepository?: ICustomEmojiRepository,
    signatureConfig?: SignatureConfig,
  ) {
    this.fetchService = new RemoteFetchService();
    this.signatureConfig = signatureConfig;
  }

  /**
   * Set signature configuration for authenticated fetches
   * This should be called with the instance actor's key for signed requests
   */
  setSignatureConfig(config: SignatureConfig): void {
    this.signatureConfig = config;
  }

  /**
   * Check if we should skip fetching from a host due to rate limiting
   *
   * @param host - Remote host to check
   * @returns true if request should be skipped
   */
  private shouldSkipHost(host: string): boolean {
    const state = RemoteLikesService.hostRateLimits.get(host);
    if (!state) return false;

    const now = Date.now();

    // Check if in cooldown
    if (state.cooldownUntil && now < state.cooldownUntil) {
      logger.debug({ host, cooldownRemaining: state.cooldownUntil - now }, "Host in cooldown, skipping");
      return true;
    }

    // Check minimum interval
    if (now - state.lastRequest < RemoteLikesService.MIN_REQUEST_INTERVAL) {
      logger.debug({ host, timeSinceLastRequest: now - state.lastRequest }, "Rate limiting: too soon");
      return true;
    }

    return false;
  }

  /**
   * Record a successful request to a host
   */
  private recordSuccess(host: string): void {
    RemoteLikesService.hostRateLimits.set(host, {
      lastRequest: Date.now(),
      failures: 0,
    });
  }

  /**
   * Record a failed request to a host
   */
  private recordFailure(host: string): void {
    const state = RemoteLikesService.hostRateLimits.get(host) || {
      lastRequest: 0,
      failures: 0,
    };

    const failures = state.failures + 1;
    const cooldownDuration = Math.min(
      RemoteLikesService.BASE_COOLDOWN * Math.pow(2, failures - 1),
      RemoteLikesService.MAX_COOLDOWN,
    );

    RemoteLikesService.hostRateLimits.set(host, {
      lastRequest: Date.now(),
      failures,
      cooldownUntil: failures >= RemoteLikesService.MAX_FAILURES
        ? Date.now() + cooldownDuration
        : undefined,
    });

    if (failures >= RemoteLikesService.MAX_FAILURES) {
      logger.warn({ host, failures, cooldownMs: cooldownDuration }, "Host entering cooldown after repeated failures");
    }
  }

  /**
   * Fetch and store likes for a remote note
   *
   * Retrieves the likes collection from the remote server and stores
   * new likes in the local database. Supports both ActivityPub likes
   * collection and Misskey's proprietary API.
   *
   * @param noteId - Local note ID
   * @returns Object with counts and emojis, or null if fetch failed
   *
   * @example
   * ```typescript
   * const service = new RemoteLikesService(reactionRepo, noteRepo, userRepo);
   * const result = await service.fetchRemoteLikes('abc123');
   * // => { counts: { "👍": 5, ":custom:": 2 }, emojis: { ":custom:": "https://..." } }
   * ```
   */
  async fetchRemoteLikes(noteId: string): Promise<{
    counts: Record<string, number>;
    emojis: Record<string, string>;
  } | null> {
    // Get the note
    const note = await this.noteRepository.findById(noteId);
    if (!note || !note.uri) {
      logger.debug({ noteId }, "Note not found or is not a remote note");
      return null;
    }

    // Extract host from note URI for rate limiting
    let host: string;
    try {
      host = new URL(note.uri).hostname;
    } catch {
      logger.debug({ noteUri: note.uri }, "Invalid note URI");
      return null;
    }

    // Check rate limit before making request
    if (this.shouldSkipHost(host)) {
      // Return local counts when rate limited
      return this.reactionRepository.countByNoteIdWithEmojis(noteId);
    }

    // Fetch the note object from remote server to get likes collection URL
    // Use HTTP Signature if configured (required by some secure servers)
    const noteResult = await this.fetchService.fetchActivityPubObject<{
      likes?: string | APCollection;
      reactions?: string | APCollection;
    }>(note.uri, {
      signature: this.signatureConfig,
    });

    if (!noteResult.success || !noteResult.data) {
      this.recordFailure(host);
      logger.warn({ noteUri: note.uri, err: noteResult.error }, "Failed to fetch remote note");
      // Return local counts on failure instead of null
      return this.reactionRepository.countByNoteIdWithEmojis(noteId);
    }

    // Record success
    this.recordSuccess(host);

    // Get likes collection URL (some servers use 'reactions' instead of 'likes')
    const likesUrl = this.getLikesUrl(noteResult.data);
    if (!likesUrl) {
      // No ActivityPub likes collection - try Misskey API fallback
      const misskeyResult = await this.fetchMisskeyReactions(note.uri, noteId);
      if (misskeyResult) {
        return misskeyResult;
      }
      logger.debug({ noteUri: note.uri }, "No likes collection found for note");
      // Return existing local counts if no remote likes available
      return this.reactionRepository.countByNoteIdWithEmojis(noteId);
    }

    // Fetch likes collection (also with signature for secure servers)
    const likesResult = await this.fetchService.fetchActivityPubObject<APCollection>(likesUrl, {
      signature: this.signatureConfig,
    });
    if (!likesResult.success || !likesResult.data) {
      logger.warn({ likesUrl, err: likesResult.error }, "Failed to fetch likes collection");
      return this.reactionRepository.countByNoteIdWithEmojis(noteId);
    }

    // Process likes and store them
    await this.processLikesCollection(noteId, likesResult.data);

    // Return updated counts from local database
    return this.reactionRepository.countByNoteIdWithEmojis(noteId);
  }

  /**
   * Fetch reactions from Misskey API
   *
   * Misskey doesn't expose reactions via ActivityPub, so we use
   * their proprietary API as a fallback.
   *
   * @param noteUri - Remote note URI
   * @param noteId - Local note ID
   * @returns Reaction counts and emojis, or null if not a Misskey instance
   */
  private async fetchMisskeyReactions(
    noteUri: string,
    noteId: string,
  ): Promise<{ counts: Record<string, number>; emojis: Record<string, string> } | null> {
    try {
      // Parse note URI to get base URL and note ID
      const url = new URL(noteUri);
      const pathParts = url.pathname.split("/");
      const remoteNoteId = pathParts[pathParts.length - 1];

      if (!remoteNoteId || !pathParts.includes("notes")) {
        return null;
      }

      // Try Misskey API endpoint
      const apiUrl = `${url.origin}/api/notes/reactions`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Rox/1.0 (ActivityPub)",
        },
        body: JSON.stringify({
          noteId: remoteNoteId,
          limit: 100,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const reactions = (await response.json()) as MisskeyReaction[];
      if (!Array.isArray(reactions) || reactions.length === 0) {
        return this.reactionRepository.countByNoteIdWithEmojis(noteId);
      }

      logger.debug({ count: reactions.length, noteUri }, "Fetched reactions from Misskey API");

      // Aggregate reaction counts and collect custom emoji names
      const counts: Record<string, number> = {};
      const customEmojiNames: Set<string> = new Set();

      for (const reaction of reactions) {
        // Normalize reaction type (remove @.: suffix for local emojis)
        let reactionType = reaction.type;
        if (reactionType.endsWith("@.:")) {
          reactionType = reactionType.slice(0, -3) + ":";
        }

        counts[reactionType] = (counts[reactionType] || 0) + 1;

        // Collect custom emoji names (format: :emoji_name:)
        if (reactionType.startsWith(":") && reactionType.endsWith(":")) {
          const emojiName = reactionType.slice(1, -1);
          customEmojiNames.add(emojiName);
        }
      }

      // Fetch emoji URLs if there are custom emojis
      let emojis: Record<string, string> = {};
      if (customEmojiNames.size > 0) {
        emojis = await this.fetchMisskeyEmojiUrls(url.origin, customEmojiNames);
      }

      return { counts, emojis };
    } catch (error) {
      logger.debug({ err: error }, "Failed to fetch Misskey reactions");
      return null;
    }
  }

  /**
   * Fetch emoji URLs from Misskey's /api/emojis endpoint
   *
   * Also saves fetched emojis to the local database for future use
   * when users react with the same emoji.
   *
   * @param baseUrl - The base URL of the Misskey instance
   * @param emojiNames - Set of emoji names to fetch URLs for
   * @returns Map of emoji name (with colons) to URL
   */
  private async fetchMisskeyEmojiUrls(
    baseUrl: string,
    emojiNames: Set<string>,
  ): Promise<Record<string, string>> {
    try {
      const apiUrl = `${baseUrl}/api/emojis`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Rox/1.0 (ActivityPub)",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        logger.debug({ baseUrl, status: response.status }, "Failed to fetch emojis from Misskey instance");
        return {};
      }

      const data = (await response.json()) as { emojis: MisskeyEmoji[] };
      if (!data.emojis || !Array.isArray(data.emojis)) {
        return {};
      }

      // Extract host from base URL
      const host = new URL(baseUrl).hostname;

      // Build map of emoji names to URLs and save to database
      const emojis: Record<string, string> = {};
      for (const emoji of data.emojis) {
        if (emojiNames.has(emoji.name) && emoji.url) {
          // Store with colon format for consistency
          emojis[`:${emoji.name}:`] = emoji.url;

          // Save to database for future use (when user reacts with this emoji)
          if (this.customEmojiRepository) {
            await this.saveRemoteEmoji(emoji.name, host, emoji.url);
          }
        }
      }

      logger.debug({ count: Object.keys(emojis).length, baseUrl }, "Fetched emoji URLs from Misskey instance");
      return emojis;
    } catch (error) {
      logger.debug({ err: error, baseUrl }, "Failed to fetch emoji URLs");
      return {};
    }
  }

  /**
   * Save a remote emoji to the local database
   *
   * This allows users to use remote emojis when reacting to notes.
   *
   * @param name - Emoji name (without colons)
   * @param host - Remote server hostname
   * @param url - Emoji image URL
   */
  private async saveRemoteEmoji(name: string, host: string, url: string): Promise<void> {
    if (!this.customEmojiRepository) return;

    try {
      // Check if emoji already exists
      const existing = await this.customEmojiRepository.findByName(name, host);

      if (existing) {
        // Update URL if it changed
        if (existing.url !== url) {
          await this.customEmojiRepository.update(existing.id, { url, updatedAt: new Date() });
          logger.debug({ name, host }, "Updated remote emoji URL");
        }
        return;
      }

      // Create new remote emoji entry
      await this.customEmojiRepository.create({
        id: generateId(),
        name,
        host,
        url,
        publicUrl: url,
        aliases: [],
        isSensitive: false,
        localOnly: false,
      });

      logger.debug({ name, host }, "Saved remote emoji");
    } catch (error) {
      // Don't fail if emoji saving fails
      logger.debug({ err: error, name, host }, "Failed to save remote emoji");
    }
  }

  /**
   * Get likes collection URL from note object
   *
   * @param noteData - Remote note ActivityPub object
   * @returns Likes collection URL or null
   */
  private getLikesUrl(noteData: { likes?: string | APCollection; reactions?: string | APCollection }): string | null {
    // Try 'likes' first (standard ActivityPub)
    if (noteData.likes) {
      if (typeof noteData.likes === "string") {
        return noteData.likes;
      }
      // Inline collection - no URL to fetch
      return null;
    }

    // Try 'reactions' (Misskey extension)
    if (noteData.reactions) {
      if (typeof noteData.reactions === "string") {
        return noteData.reactions;
      }
    }

    return null;
  }

  /**
   * Process likes collection and store reactions
   *
   * @param noteId - Local note ID
   * @param collection - Likes collection object
   */
  private async processLikesCollection(noteId: string, collection: APCollection): Promise<void> {
    // Get items from collection
    const items = collection.orderedItems || collection.items || [];

    // Process first page items
    for (const item of items) {
      await this.processLikeItem(noteId, item);
    }

    // If there's a first page reference, fetch it
    if (collection.first) {
      const firstUrl = typeof collection.first === "string" ? collection.first : null;
      if (firstUrl) {
        const pageResult = await this.fetchService.fetchActivityPubObject<APCollectionPage>(firstUrl);
        if (pageResult.success && pageResult.data) {
          const pageItems = pageResult.data.orderedItems || pageResult.data.items || [];
          for (const item of pageItems) {
            await this.processLikeItem(noteId, item);
          }
          // Note: We only fetch the first page to avoid excessive requests
        }
      }
    }
  }

  /**
   * Process a single like item
   *
   * @param noteId - Local note ID
   * @param item - Like item (can be URL string or Like object)
   */
  private async processLikeItem(noteId: string, item: string | APLike): Promise<void> {
    try {
      let like: APLike;

      if (typeof item === "string") {
        // URL reference - need to fetch the Like object
        const likeResult = await this.fetchService.fetchActivityPubObject<APLike>(item, {
          maxRetries: 1,
          timeout: 5000,
        });
        if (!likeResult.success || !likeResult.data) {
          return;
        }
        like = likeResult.data;
      } else {
        like = item;
      }

      // Extract actor URI
      const actorUri = like.actor;
      if (!actorUri) return;

      // Extract reaction (default to heart if not specified)
      const reaction = this.extractReaction(like);

      // Find or skip the user (we don't want to create users just for reactions)
      const user = await this.userRepository.findByUri(actorUri);
      if (!user) {
        // User not in our database - skip
        // We could resolve the actor here, but that would be expensive for many likes
        return;
      }

      // Check if reaction already exists
      const existing = await this.reactionRepository.findByUserNoteAndReaction(
        user.id,
        noteId,
        reaction,
      );

      if (!existing) {
        // Create reaction
        const customEmojiUrl = this.extractCustomEmojiUrl(like);
        await this.reactionRepository.create({
          id: generateId(),
          userId: user.id,
          noteId,
          reaction,
          ...(customEmojiUrl && { customEmojiUrl }),
        });
        logger.debug({ username: user.username, host: user.host, reaction, noteId }, "Stored remote reaction");
      }
    } catch (error) {
      logger.debug({ err: error }, "Failed to process like item");
    }
  }

  /**
   * Extract reaction emoji from Like object
   *
   * Supports:
   * - Misskey _misskey_reaction extension
   * - Standard Like (defaults to ❤️)
   *
   * @param like - Like object
   * @returns Reaction emoji string
   */
  private extractReaction(like: APLike): string {
    // Misskey custom reaction
    if (like._misskey_reaction) {
      return like._misskey_reaction;
    }

    // Content field (some implementations use this)
    if (like.content) {
      return like.content;
    }

    // Default to heart
    return "❤️";
  }

  /**
   * Extract custom emoji URL from Like object
   *
   * @param like - Like object
   * @returns Custom emoji URL or undefined
   */
  private extractCustomEmojiUrl(like: APLike): string | undefined {
    if (!like.tag || !Array.isArray(like.tag)) {
      return undefined;
    }

    // Find Emoji tag
    const emojiTag = like.tag.find((t) => t.type === "Emoji" && t.icon?.url);
    return emojiTag?.icon?.url;
  }
}
