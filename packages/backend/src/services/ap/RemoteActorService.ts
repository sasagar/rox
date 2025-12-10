/**
 * Remote Actor Service
 *
 * Handles fetching and caching of remote ActivityPub actors.
 * Resolves actor URIs to user records in the database.
 * Uses two-tier caching: memory cache (Dragonfly) + database cache.
 *
 * @module services/ap/RemoteActorService
 */

import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { User } from "../../db/schema/pg.js";
import type { ICacheService } from "../../interfaces/ICacheService.js";
import { generateId } from "shared";
import { RemoteFetchService, type SignatureConfig } from "./RemoteFetchService.js";
import { CacheTTL, CachePrefix } from "../../adapters/cache/DragonflyCacheAdapter.js";
import { logger } from "../../lib/logger.js";

/**
 * ActivityPub Emoji tag
 */
interface EmojiTag {
  type: "Emoji";
  name: string; // e.g., ":custom_emoji:"
  icon: {
    type: string;
    url: string;
    mediaType?: string;
  };
}

/**
 * Profile emoji (simplified format for storage)
 */
interface ProfileEmoji {
  name: string;
  url: string;
}

/**
 * Extract custom emojis from ActivityPub actor tags
 *
 * @param tags - Array of tags from actor document
 * @returns Array of profile emojis (name without colons, url)
 */
function extractEmojisFromTags(tags: ActorDocument["tag"]): ProfileEmoji[] {
  if (!tags || !Array.isArray(tags)) return [];

  return tags
    .filter((tag): tag is EmojiTag => tag.type === "Emoji" && "icon" in tag && "name" in tag)
    .map((tag) => ({
      // Remove colons from name (":custom:" -> "custom")
      name: tag.name.replace(/^:|:$/g, ""),
      url: tag.icon.url,
    }));
}

/**
 * Image object in ActivityPub (icon or image)
 */
interface ImageObject {
  type: string;
  url: string;
  mediaType?: string;
}

/**
 * Extract URL from icon/image which can be a single object or an array
 *
 * ActivityPub allows icon/image to be either a single ImageObject or an array of ImageObjects.
 * This function handles both cases and returns the first valid URL.
 *
 * @param iconOrImage - Single ImageObject, array of ImageObjects, or undefined
 * @returns The URL string or null if not found
 */
function extractImageUrl(iconOrImage: ImageObject | ImageObject[] | undefined): string | null {
  if (!iconOrImage) return null;

  // Handle array case - take the first item
  if (Array.isArray(iconOrImage)) {
    const firstImage = iconOrImage[0];
    return firstImage?.url || null;
  }

  // Handle single object case
  return iconOrImage.url || null;
}

/**
 * ActivityPub Actor document
 */
interface ActorDocument {
  "@context"?: string | string[];
  id: string;
  type: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  inbox: string;
  outbox?: string;
  followers?: string;
  following?: string;
  // icon can be a single ImageObject or an array of ImageObjects
  icon?: ImageObject | ImageObject[];
  // image can be a single ImageObject or an array of ImageObjects
  image?: ImageObject | ImageObject[];
  publicKey?: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
  endpoints?: {
    sharedInbox?: string;
  };
  // Account migration fields
  alsoKnownAs?: string[];
  movedTo?: string;
  // Custom emojis in name/summary
  tag?: Array<EmojiTag | { type: string; [key: string]: unknown }>;
}

/**
 * Remote Actor Service
 *
 * Manages remote ActivityPub actors (users from other servers).
 * Implements two-tier caching:
 * - L1: Memory cache (Dragonfly) - 1 hour TTL for fast lookups
 * - L2: Database cache - 24 hour TTL for persistence
 */
export class RemoteActorService {
  private fetchService: RemoteFetchService;
  private signatureConfig?: SignatureConfig;
  private cacheService: ICacheService | null;

  constructor(
    private userRepository: IUserRepository,
    signatureConfig?: SignatureConfig,
    cacheService?: ICacheService,
  ) {
    this.fetchService = new RemoteFetchService();
    this.signatureConfig = signatureConfig;
    this.cacheService = cacheService ?? null;
  }

  /**
   * Set signature configuration for authenticated fetches
   *
   * GoToSocial and other strict servers require HTTP Signature for actor fetches.
   */
  setSignatureConfig(config: SignatureConfig): void {
    this.signatureConfig = config;
  }

  /**
   * Resolve remote actor by URI
   *
   * Fetches actor document from remote server and saves/updates in database.
   * Results are cached in the database and refreshed if older than 24 hours.
   *
   * @param actorUri - ActivityPub actor URI (e.g., "https://remote.example.com/users/alice")
   * @param forceRefresh - Force refresh even if cache is fresh (default: false)
   * @returns User record (either existing or newly created)
   *
   * @example
   * ```typescript
   * const remoteUser = await remoteActorService.resolveActor(
   *   'https://mastodon.social/users/alice'
   * );
   * ```
   */
  async resolveActor(actorUri: string, forceRefresh = false): Promise<User> {
    const cacheKey = `${CachePrefix.REMOTE_ACTOR}:${actorUri}`;

    // L1: Check memory cache first (fastest)
    if (!forceRefresh && this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<User>(cacheKey);
      if (cached) {
        logger.debug({ username: cached.username, host: cached.host }, "L1 cache hit for actor");
        return cached;
      }
    }

    // L2: Check database cache
    const existing = await this.userRepository.findByUri(actorUri);

    if (existing && !forceRefresh) {
      // Check if database cache is fresh (< 24 hours old)
      const cacheAge = Date.now() - existing.updatedAt.getTime();
      const DB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge < DB_CACHE_TTL) {
        logger.debug({ username: existing.username, host: existing.host }, "L2 cache hit for actor");

        // Warm L1 cache for future requests
        if (this.cacheService?.isAvailable()) {
          this.cacheService.set(cacheKey, existing, { ttl: CacheTTL.LONG }).catch((err) => {
            logger.debug({ err }, "Failed to warm L1 cache");
          });
        }

        return existing;
      }

      logger.debug({ username: existing.username, host: existing.host }, "Actor cache expired, refreshing");
    }

    // Fetch actor document from remote server
    let actor: ActorDocument;
    try {
      actor = await this.fetchActor(actorUri);
    } catch (error) {
      // Record fetch failure if we have an existing user
      if (existing) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await this.userRepository.recordFetchFailure(existing.id, errorMessage);
        logger.debug(
          { username: existing.username, host: existing.host, error: errorMessage },
          "Recorded fetch failure for remote user",
        );
      }
      throw error;
    }

    // Extract host from actor URI
    const host = new URL(actorUri).hostname;

    // Extract custom emojis from tags
    const profileEmojis = extractEmojisFromTags(actor.tag);

    // Update existing user or create new one
    if (existing) {
      const updated = await this.userRepository.update(existing.id, {
        displayName: actor.name || actor.preferredUsername,
        avatarUrl: extractImageUrl(actor.icon),
        bannerUrl: extractImageUrl(actor.image),
        bio: actor.summary || null,
        publicKey: actor.publicKey?.publicKeyPem || null,
        inbox: actor.inbox,
        outbox: actor.outbox || null,
        followersUrl: actor.followers || null,
        followingUrl: actor.following || null,
        sharedInbox: actor.endpoints?.sharedInbox || null,
        profileEmojis,
      });

      // Clear any previous fetch failures since we successfully fetched
      if (existing.goneDetectedAt) {
        await this.userRepository.clearFetchFailure(existing.id);
        logger.debug(
          { username: actor.preferredUsername, host },
          "Cleared fetch failure status for recovered remote user",
        );
      }

      logger.debug({ username: actor.preferredUsername, host }, "Refreshed remote user");

      // Update L1 cache
      if (this.cacheService?.isAvailable()) {
        this.cacheService.set(cacheKey, updated, { ttl: CacheTTL.LONG }).catch((err) => {
          logger.debug({ err }, "Failed to update L1 cache");
        });
      }

      return updated;
    }

    // Check if a user with the same username/host already exists (race condition protection)
    // The database has a unique constraint on (username, host), but we check by URI above.
    // A user may have been created by a concurrent request with a different URI or no URI yet.
    const existingByUsernameHost = await this.userRepository.findByUsername(actor.preferredUsername, host);
    if (existingByUsernameHost) {
      // Update the existing user with the new data (including URI if not set)
      const updated = await this.userRepository.update(existingByUsernameHost.id, {
        displayName: actor.name || actor.preferredUsername,
        avatarUrl: extractImageUrl(actor.icon),
        bannerUrl: extractImageUrl(actor.image),
        bio: actor.summary || null,
        publicKey: actor.publicKey?.publicKeyPem || null,
        inbox: actor.inbox,
        outbox: actor.outbox || null,
        followersUrl: actor.followers || null,
        followingUrl: actor.following || null,
        sharedInbox: actor.endpoints?.sharedInbox || null,
        uri: actorUri, // Set/update the URI
        profileEmojis,
        alsoKnownAs: actor.alsoKnownAs || [],
        movedTo: actor.movedTo || null,
      });

      logger.debug(
        { username: actor.preferredUsername, host },
        "Found existing user by username/host, updated instead of creating",
      );

      // Update L1 cache
      if (this.cacheService?.isAvailable()) {
        this.cacheService.set(cacheKey, updated, { ttl: CacheTTL.LONG }).catch((err) => {
          logger.debug({ err }, "Failed to update L1 cache");
        });
      }

      return updated;
    }

    // Create new user record (with fallback for race condition)
    try {
      const user = await this.userRepository.create({
        id: generateId(),
        username: actor.preferredUsername,
        email: `${actor.preferredUsername}@${host}`, // Placeholder (not used for remote users)
        passwordHash: "", // Not used for remote users
        displayName: actor.name || actor.preferredUsername,
        host, // Non-null host indicates remote user
        avatarUrl: extractImageUrl(actor.icon),
        bannerUrl: extractImageUrl(actor.image),
        bio: actor.summary || null,
        isAdmin: false,
        isSuspended: false,
        isDeleted: false,
        deletedAt: null,
        publicKey: actor.publicKey?.publicKeyPem || null,
        privateKey: null, // Remote users don't have private keys
        inbox: actor.inbox,
        outbox: actor.outbox || null,
        followersUrl: actor.followers || null,
        followingUrl: actor.following || null,
        uri: actorUri,
        sharedInbox: actor.endpoints?.sharedInbox || null,
        customCss: null, // Remote users don't have custom CSS
        uiSettings: null, // Remote users don't have UI settings
        profileEmojis, // Custom emojis from actor tags
        // Account migration fields
        alsoKnownAs: actor.alsoKnownAs || [],
        movedTo: actor.movedTo || null,
        movedAt: null,
        // Storage quota (null for remote users - not applicable)
        storageQuotaMb: null,
        // Fetch status (initialized as no failures)
        goneDetectedAt: null,
        fetchFailureCount: 0,
        lastFetchAttemptAt: null,
        lastFetchError: null,
      });

      logger.debug({ username: actor.preferredUsername, host }, "Created remote user");

      // Update L1 cache
      if (this.cacheService?.isAvailable()) {
        this.cacheService.set(cacheKey, user, { ttl: CacheTTL.LONG }).catch((err) => {
          logger.debug({ err }, "Failed to update L1 cache");
        });
      }

      return user;
    } catch (error) {
      // Handle duplicate key constraint violation (race condition)
      // Another concurrent request may have created this user between our check and create
      if (error instanceof Error && error.message.includes("unique constraint")) {
        logger.debug(
          { username: actor.preferredUsername, host },
          "Duplicate key on create, fetching existing user",
        );

        // Fetch the user that was created by the other request
        const raceWinner = await this.userRepository.findByUsername(actor.preferredUsername, host);
        if (raceWinner) {
          // Update L1 cache with the existing user
          if (this.cacheService?.isAvailable()) {
            this.cacheService.set(cacheKey, raceWinner, { ttl: CacheTTL.LONG }).catch((err) => {
              logger.debug({ err }, "Failed to update L1 cache");
            });
          }
          return raceWinner;
        }
      }

      // Re-throw if it's not a duplicate key error or we couldn't find the user
      throw error;
    }
  }

  /**
   * Fetch actor document from remote server
   *
   * Performs HTTP GET request with ActivityPub content negotiation,
   * automatic retries, and comprehensive error handling.
   *
   * @param actorUri - ActivityPub actor URI
   * @returns Actor document
   * @throws Error if fetch fails or response is invalid
   */
  private async fetchActor(actorUri: string): Promise<ActorDocument> {
    const result = await this.fetchService.fetchActivityPubObject<ActorDocument>(actorUri, {
      signature: this.signatureConfig,
    });

    if (!result.success) {
      logger.error({ err: result.error, actorUri }, "Failed to fetch actor");
      throw new Error(`Failed to fetch actor ${actorUri}: ${result.error?.message}`);
    }

    const actor = result.data!;

    // Validate actor document
    if (!actor.id || !actor.type || !actor.preferredUsername || !actor.inbox) {
      logger.error({ actorUri }, "Invalid actor document: missing required fields");
      throw new Error("Invalid actor document: missing required fields (id, type, preferredUsername, or inbox)");
    }

    return actor;
  }

  /**
   * Extract actor URI from activity
   *
   * Handles both string URIs and nested actor objects.
   *
   * @param actor - Actor field from activity (string URI or object)
   * @returns Actor URI
   */
  extractActorUri(actor: string | { id: string }): string {
    if (typeof actor === "string") {
      return actor;
    }
    return actor.id;
  }

  /**
   * Resolve remote actor by acct URI (WebFinger)
   *
   * Performs WebFinger lookup to discover actor URI, then resolves the actor.
   * Supports format: `acct:username@host` or `username@host`
   *
   * @param acct - Account identifier (e.g., "alice@mastodon.social" or "acct:alice@mastodon.social")
   * @returns User record
   * @throws Error if WebFinger lookup fails or actor not found
   *
   * @example
   * ```typescript
   * const remoteUser = await remoteActorService.resolveActorByAcct('alice@mastodon.social');
   * ```
   */
  async resolveActorByAcct(acct: string): Promise<User> {
    // Normalize acct (remove acct: prefix if present)
    const normalizedAcct = acct.startsWith("acct:") ? acct.slice(5) : acct;

    // Parse username and host
    const atIndex = normalizedAcct.indexOf("@");
    if (atIndex === -1) {
      throw new Error(`Invalid acct format: ${acct} (missing @host)`);
    }

    const username = normalizedAcct.slice(0, atIndex);
    const host = normalizedAcct.slice(atIndex + 1);

    if (!username || !host) {
      throw new Error(`Invalid acct format: ${acct}`);
    }

    // Check if local user
    const localHost = new URL(process.env.URL || "http://localhost:3000").hostname;
    if (host === localHost) {
      const localUser = await this.userRepository.findByUsername(username, null);
      if (!localUser) {
        throw new Error(`Local user not found: ${username}`);
      }
      return localUser;
    }

    // Check if user already exists in database
    const existingUser = await this.userRepository.findByUsername(username, host);
    if (existingUser) {
      logger.debug({ username, host }, "Found cached remote user");
      return existingUser;
    }

    // Perform WebFinger lookup
    const webfingerUrl = `https://${host}/.well-known/webfinger?resource=acct:${encodeURIComponent(normalizedAcct)}`;
    logger.debug({ webfingerUrl }, "Performing WebFinger lookup");

    const webfingerResult = await this.fetchService.fetchActivityPubObject<WebFingerResponse>(
      webfingerUrl,
      {
        headers: {
          Accept: "application/jrd+json, application/json",
        },
      },
    );

    if (!webfingerResult.success) {
      throw new Error(`WebFinger lookup failed for ${acct}: ${webfingerResult.error?.message}`);
    }

    const webfinger = webfingerResult.data!;

    // Find ActivityPub actor link
    const actorLink = webfinger.links?.find(
      (link) =>
        link.rel === "self" &&
        (link.type === "application/activity+json" ||
          link.type === 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'),
    );

    if (!actorLink?.href) {
      throw new Error(`No ActivityPub actor link found in WebFinger response for ${acct}`);
    }

    logger.debug({ actorUri: actorLink.href }, "Found actor URI via WebFinger");

    // Resolve actor from URI
    return this.resolveActor(actorLink.href);
  }
}

/**
 * WebFinger response structure
 */
interface WebFingerResponse {
  subject: string;
  aliases?: string[];
  links?: Array<{
    rel: string;
    type?: string;
    href?: string;
    template?: string;
  }>;
}
