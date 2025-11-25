/**
 * Remote Actor Service
 *
 * Handles fetching and caching of remote ActivityPub actors.
 * Resolves actor URIs to user records in the database.
 *
 * @module services/ap/RemoteActorService
 */

import type { IUserRepository } from '../../interfaces/repositories/IUserRepository.js';
import type { User } from 'shared';
import { generateId } from 'shared';
import { RemoteFetchService } from './RemoteFetchService.js';

/**
 * ActivityPub Actor document
 */
interface ActorDocument {
  '@context'?: string | string[];
  id: string;
  type: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  inbox: string;
  outbox?: string;
  followers?: string;
  following?: string;
  icon?: {
    type: string;
    url: string;
  };
  image?: {
    type: string;
    url: string;
  };
  publicKey?: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
}

/**
 * Remote Actor Service
 *
 * Manages remote ActivityPub actors (users from other servers).
 */
export class RemoteActorService {
  private fetchService: RemoteFetchService;

  constructor(private userRepository: IUserRepository) {
    this.fetchService = new RemoteFetchService();
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
    // Check if actor already exists in database
    const existing = await this.userRepository.findByUri(actorUri);

    if (existing && !forceRefresh) {
      // Check if cache is fresh (< 24 hours old)
      const cacheAge = Date.now() - existing.updatedAt.getTime();
      const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge < CACHE_TTL) {
        console.log(`📦 Using cached actor: ${existing.username}@${existing.host}`);
        return existing;
      }

      console.log(`🔄 Actor cache expired, refreshing: ${existing.username}@${existing.host}`);
    }

    // Fetch actor document from remote server
    const actor = await this.fetchActor(actorUri);

    // Extract host from actor URI
    const host = new URL(actorUri).hostname;

    // Update existing user or create new one
    if (existing) {
      const updated = await this.userRepository.update(existing.id, {
        displayName: actor.name || actor.preferredUsername,
        avatarUrl: actor.icon?.url || null,
        bannerUrl: actor.image?.url || null,
        bio: actor.summary || null,
        publicKey: actor.publicKey?.publicKeyPem || null,
        inbox: actor.inbox,
        outbox: actor.outbox || null,
        followersUrl: actor.followers || null,
        followingUrl: actor.following || null,
      });

      console.log(`✅ Refreshed remote user: ${actor.preferredUsername}@${host}`);
      return updated;
    }

    // Create new user record
    const user = await this.userRepository.create({
      id: generateId(),
      username: actor.preferredUsername,
      email: `${actor.preferredUsername}@${host}`, // Placeholder (not used for remote users)
      passwordHash: '', // Not used for remote users
      displayName: actor.name || actor.preferredUsername,
      host, // Non-null host indicates remote user
      avatarUrl: actor.icon?.url || null,
      bannerUrl: actor.image?.url || null,
      bio: actor.summary || null,
      isAdmin: false,
      isSuspended: false,
      publicKey: actor.publicKey?.publicKeyPem || null,
      privateKey: null, // Remote users don't have private keys
      inbox: actor.inbox,
      outbox: actor.outbox || null,
      followersUrl: actor.followers || null,
      followingUrl: actor.following || null,
      uri: actorUri,
    });

    console.log(`✅ Created remote user: ${actor.preferredUsername}@${host}`);

    return user;
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
    const result = await this.fetchService.fetchActivityPubObject<ActorDocument>(actorUri);

    if (!result.success) {
      const errorMsg = `Failed to fetch actor ${actorUri}: ${result.error?.message}`;
      console.error(errorMsg, result.error);
      throw new Error(errorMsg);
    }

    const actor = result.data!;

    // Validate actor document
    if (!actor.id || !actor.type || !actor.preferredUsername || !actor.inbox) {
      const errorMsg = `Invalid actor document: missing required fields (id, type, preferredUsername, or inbox)`;
      console.error(errorMsg, actor);
      throw new Error(errorMsg);
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
    if (typeof actor === 'string') {
      return actor;
    }
    return actor.id;
  }
}
