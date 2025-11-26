/**
 * ActivityPub Activity Builder
 *
 * Provides a fluent interface for constructing ActivityPub activities.
 * Reduces duplication across delivery methods.
 *
 * @module services/ap/delivery/ActivityBuilder
 */

import type { Note } from '../../../../../shared/src/types/note.js';
import type { User } from '../../../../../shared/src/types/user.js';

/**
 * Base ActivityPub activity structure
 */
export interface Activity {
  '@context': string | string[];
  type: string;
  id: string;
  actor: string;
  object?: unknown;
  target?: string;
  published?: string;
  to?: string[];
  cc?: string[];
}

/**
 * ActivityPub Note object structure
 */
export interface NoteObject {
  id: string;
  type: 'Note';
  attributedTo: string;
  content: string;
  published: string;
  to: string[];
  cc: string[];
  inReplyTo?: string | null;
  attachment?: unknown[];
  tag?: unknown[];
  sensitive?: boolean;
  summary?: string | null;
}

/**
 * Actor object for Update activities
 */
export interface ActorObject {
  '@context': (string | Record<string, unknown>)[];
  type: 'Person';
  id: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  inbox: string;
  outbox: string;
  followers: string;
  following: string;
  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
  icon?: { type: 'Image'; url: string };
  image?: { type: 'Image'; url: string };
}

const AS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const AS_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

/**
 * ActivityPub Activity Builder
 *
 * Provides helper methods for constructing common ActivityPub activities.
 */
export class ActivityBuilder {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.URL || 'http://localhost:3000';
  }

  /**
   * Get actor URI for a local user
   */
  actorUri(username: string): string {
    return `${this.baseUrl}/users/${username}`;
  }

  /**
   * Get key ID for HTTP signatures
   */
  keyId(username: string): string {
    return `${this.baseUrl}/users/${username}#main-key`;
  }

  /**
   * Get followers collection URI
   */
  followersUri(username: string): string {
    return `${this.baseUrl}/users/${username}/followers`;
  }

  /**
   * Generate a unique activity ID
   */
  activityId(type: string, ...parts: (string | number)[]): string {
    const path = parts.join('/');
    return `${this.baseUrl}/activities/${type.toLowerCase()}/${path}`;
  }

  /**
   * Build a Create activity for a note
   */
  createNote(note: Note, author: User): Activity {
    const actorUri = this.actorUri(author.username);
    const followersUri = this.followersUri(author.username);
    const published = note.createdAt.toISOString();

    const noteObject: NoteObject = {
      id: note.uri || `${this.baseUrl}/notes/${note.id}`,
      type: 'Note',
      attributedTo: actorUri,
      content: note.text || '',
      published,
      to: [AS_PUBLIC],
      cc: [followersUri],
    };

    // Add optional fields
    if (note.cw) {
      noteObject.sensitive = true;
      noteObject.summary = note.cw;
    }
    if (note.replyId) {
      noteObject.inReplyTo = note.replyId;
    }

    return {
      '@context': AS_CONTEXT,
      type: 'Create',
      id: this.activityId('create', note.id),
      actor: actorUri,
      published,
      to: [AS_PUBLIC],
      cc: [followersUri],
      object: noteObject,
    };
  }

  /**
   * Build a Like activity
   */
  like(noteId: string, noteUri: string, reactor: User): Activity {
    return {
      '@context': AS_CONTEXT,
      type: 'Like',
      id: this.activityId('like', noteId, Date.now()),
      actor: this.actorUri(reactor.username),
      object: noteUri,
    };
  }

  /**
   * Build a Follow activity
   */
  follow(follower: User, followeeUri: string): Activity {
    return {
      '@context': AS_CONTEXT,
      type: 'Follow',
      id: this.activityId('follow', follower.id, Date.now()),
      actor: this.actorUri(follower.username),
      object: followeeUri,
    };
  }

  /**
   * Build an Undo activity wrapping another activity
   */
  undo(originalActivity: Activity, actor: User): Activity {
    return {
      '@context': AS_CONTEXT,
      type: 'Undo',
      id: this.activityId('undo', Date.now()),
      actor: this.actorUri(actor.username),
      object: originalActivity,
    };
  }

  /**
   * Build an Undo Follow activity
   */
  undoFollow(follower: User, followeeUri: string, originalFollowId?: string): Activity {
    const followActivity: Activity = {
      '@context': AS_CONTEXT,
      type: 'Follow',
      id: originalFollowId || this.activityId('follow', follower.id, 'original'),
      actor: this.actorUri(follower.username),
      object: followeeUri,
    };

    return this.undo(followActivity, follower);
  }

  /**
   * Build an Undo Like activity
   */
  undoLike(noteId: string, noteUri: string, reactor: User): Activity {
    const likeActivity: Activity = {
      '@context': AS_CONTEXT,
      type: 'Like',
      id: this.activityId('like', noteId, 'original'),
      actor: this.actorUri(reactor.username),
      object: noteUri,
    };

    return this.undo(likeActivity, reactor);
  }

  /**
   * Build a Delete activity
   */
  delete(objectUri: string, actor: User): Activity {
    return {
      '@context': AS_CONTEXT,
      type: 'Delete',
      id: this.activityId('delete', Date.now()),
      actor: this.actorUri(actor.username),
      object: {
        id: objectUri,
        type: 'Tombstone',
      },
    };
  }

  /**
   * Build an Update activity for an actor
   */
  updateActor(actor: User): Activity {
    const actorUri = this.actorUri(actor.username);

    const actorObject: ActorObject = {
      '@context': [
        AS_CONTEXT,
        'https://w3id.org/security/v1',
        { manuallyApprovesFollowers: 'as:manuallyApprovesFollowers' },
      ],
      type: 'Person',
      id: actorUri,
      preferredUsername: actor.username,
      name: actor.displayName || actor.username,
      summary: actor.bio || '',
      inbox: `${actorUri}/inbox`,
      outbox: `${actorUri}/outbox`,
      followers: this.followersUri(actor.username),
      following: `${actorUri}/following`,
      publicKey: {
        id: this.keyId(actor.username),
        owner: actorUri,
        publicKeyPem: actor.publicKey || '',
      },
    };

    // Add avatar if present
    if (actor.avatarUrl) {
      actorObject.icon = { type: 'Image', url: actor.avatarUrl };
    }

    // Add banner if present
    if (actor.bannerUrl) {
      actorObject.image = { type: 'Image', url: actor.bannerUrl };
    }

    return {
      '@context': AS_CONTEXT,
      type: 'Update',
      id: this.activityId('update', actor.id, Date.now()),
      actor: actorUri,
      object: actorObject,
      to: [AS_PUBLIC],
    };
  }

  /**
   * Build an Announce activity (boost/renote)
   */
  announce(noteId: string, targetNoteUri: string, actor: User): Activity {
    return {
      '@context': AS_CONTEXT,
      type: 'Announce',
      id: this.activityId('announce', noteId),
      actor: this.actorUri(actor.username),
      object: targetNoteUri,
      published: new Date().toISOString(),
      to: [AS_PUBLIC],
      cc: [this.followersUri(actor.username)],
    };
  }
}

/**
 * Get a singleton ActivityBuilder instance
 */
let builderInstance: ActivityBuilder | null = null;

export function getActivityBuilder(): ActivityBuilder {
  if (!builderInstance) {
    builderInstance = new ActivityBuilder();
  }
  return builderInstance;
}

/**
 * Reset builder instance (for testing)
 */
export function resetActivityBuilder(): void {
  builderInstance = null;
}
