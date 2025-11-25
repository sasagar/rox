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
  constructor(private userRepository: IUserRepository) {}

  /**
   * Resolve remote actor by URI
   *
   * Fetches actor document from remote server and saves/updates in database.
   * Results are cached in the database.
   *
   * @param actorUri - ActivityPub actor URI (e.g., "https://remote.example.com/users/alice")
   * @returns User record (either existing or newly created)
   *
   * @example
   * ```typescript
   * const remoteUser = await remoteActorService.resolveActor(
   *   'https://mastodon.social/users/alice'
   * );
   * ```
   */
  async resolveActor(actorUri: string): Promise<User> {
    // Check if actor already exists in database
    const existing = await this.userRepository.findByUri(actorUri);
    if (existing) {
      // TODO: Implement refresh logic (refresh if older than 24 hours)
      return existing;
    }

    // Fetch actor document from remote server
    const actor = await this.fetchActor(actorUri);

    // Extract host from actor URI
    const host = new URL(actorUri).hostname;

    // Create user record
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
   * Performs HTTP GET request with ActivityPub content negotiation.
   *
   * @param actorUri - ActivityPub actor URI
   * @returns Actor document
   * @throws Error if fetch fails or response is invalid
   */
  private async fetchActor(actorUri: string): Promise<ActorDocument> {
    try {
      const response = await fetch(actorUri, {
        headers: {
          Accept: 'application/activity+json, application/ld+json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch actor: ${response.status} ${response.statusText}`);
      }

      const actor = (await response.json()) as {
        id?: string;
        type?: string;
        preferredUsername?: string;
        inbox?: string;
      };

      // Validate actor document
      if (!actor.id || !actor.type || !actor.preferredUsername || !actor.inbox) {
        throw new Error('Invalid actor document: missing required fields');
      }

      return actor as ActorDocument;
    } catch (error) {
      console.error(`Failed to fetch actor ${actorUri}:`, error);
      throw error;
    }
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
