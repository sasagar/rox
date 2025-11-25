/**
 * ActivityPub Delivery Service
 *
 * Handles ActivityPub activity delivery to followers' inboxes.
 * Creates activities and enqueues delivery jobs.
 *
 * @module services/ap/ActivityPubDeliveryService
 */

import type { IUserRepository } from '../../interfaces/repositories/IUserRepository.js';
import type { IFollowRepository } from '../../interfaces/repositories/IFollowRepository.js';
import type { Note, User } from 'shared';
import { ActivityDeliveryQueue, JobPriority } from './ActivityDeliveryQueue.js';

/**
 * ActivityPub Delivery Service
 *
 * Provides methods to deliver ActivityPub activities to followers.
 *
 * @example
 * ```typescript
 * const deliveryService = new ActivityPubDeliveryService(userRepo, followRepo);
 * await deliveryService.deliverCreateNote(note, author);
 * ```
 */
export class ActivityPubDeliveryService {
  private queue: ActivityDeliveryQueue;

  /**
   * Constructor
   *
   * @param userRepository - User repository
   * @param followRepository - Follow repository
   * @param activityDeliveryQueue - Activity delivery queue
   */
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly followRepository: IFollowRepository,
    activityDeliveryQueue: ActivityDeliveryQueue,
  ) {
    this.queue = activityDeliveryQueue;
  }

  /**
   * Deliver Create activity for a note to all followers
   *
   * @param note - The created note
   * @param author - The note author
   *
   * @example
   * ```typescript
   * await deliveryService.deliverCreateNote(note, author);
   * ```
   */
  async deliverCreateNote(note: Note, author: User): Promise<void> {
    // Skip delivery for remote notes or localOnly notes
    if (author.host || note.localOnly) {
      return;
    }

    const baseUrl = process.env.URL || 'http://localhost:3000';

    // Get author's followers
    const follows = await this.followRepository.findByFolloweeId(author.id);
    if (follows.length === 0) {
      console.log(`📭 No followers to deliver to for note ${note.id}`);
      return;
    }

    // Create ActivityPub Create activity
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Create',
      id: `${baseUrl}/activities/create/${note.id}`,
      actor: `${baseUrl}/users/${author.username}`,
      published: note.createdAt.toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${baseUrl}/users/${author.username}/followers`],
      object: {
        id: note.uri || `${baseUrl}/notes/${note.id}`,
        type: 'Note',
        attributedTo: `${baseUrl}/users/${author.username}`,
        content: note.text || '',
        published: note.createdAt.toISOString(),
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [`${baseUrl}/users/${author.username}/followers`],
      },
    };

    // Get unique inbox URLs
    const inboxUrls = new Set<string>();
    for (const follow of follows) {
      const follower = await this.userRepository.findById(follow.followerId);
      if (follower && follower.host && follower.inbox) {
        inboxUrls.add(follower.inbox);
      }
    }

    // Skip delivery if author has no private key
    if (!author.privateKey) {
      console.log(`⚠️  Cannot deliver note ${note.id}: author has no private key`);
      return;
    }

    // Enqueue delivery to each inbox with normal priority
    const deliveryPromises = Array.from(inboxUrls).map((inboxUrl) =>
      this.queue.enqueue({
        activity,
        inboxUrl,
        keyId: `${baseUrl}/users/${author.username}#main-key`,
        privateKey: author.privateKey as string,
        priority: JobPriority.NORMAL,
      })
    );

    await Promise.all(deliveryPromises);

    console.log(`📤 Enqueued Create activity delivery to ${inboxUrls.size} inboxes for note ${note.id}`);
  }

  /**
   * Deliver Like activity for a reaction to the note author
   *
   * @param noteId - Target note ID
   * @param noteUri - Target note URI
   * @param noteAuthorInbox - Note author's inbox URL
   * @param reactor - User who created the reaction
   *
   * @example
   * ```typescript
   * await deliveryService.deliverLikeActivity(noteId, noteUri, authorInbox, reactor);
   * ```
   */
  async deliverLikeActivity(
    noteId: string,
    noteUri: string,
    noteAuthorInbox: string,
    reactor: User,
  ): Promise<void> {
    // Skip delivery for remote users
    if (reactor.host) {
      return;
    }

    // Skip delivery if reactor has no private key
    if (!reactor.privateKey) {
      console.log(`⚠️  Cannot deliver Like for note ${noteId}: reactor has no private key`);
      return;
    }

    const baseUrl = process.env.URL || 'http://localhost:3000';

    // Create ActivityPub Like activity
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Like',
      id: `${baseUrl}/activities/like/${noteId}/${Date.now()}`,
      actor: `${baseUrl}/users/${reactor.username}`,
      object: noteUri,
    };

    // Enqueue delivery with normal priority
    await this.queue.enqueue({
      activity,
      inboxUrl: noteAuthorInbox,
      keyId: `${baseUrl}/users/${reactor.username}#main-key`,
      privateKey: reactor.privateKey,
      priority: JobPriority.NORMAL,
    });

    console.log(`📤 Enqueued Like activity delivery to ${noteAuthorInbox} for note ${noteId}`);
  }

  /**
   * Deliver Undo Follow activity when unfollowing a remote user
   *
   * @param follower - Local user who is unfollowing
   * @param followee - Remote user being unfollowed
   * @param originalFollowId - ID of the original Follow activity (optional)
   *
   * @example
   * ```typescript
   * await deliveryService.deliverUndoFollow(follower, followee);
   * ```
   */
  async deliverUndoFollow(
    follower: User,
    followee: User,
    originalFollowId?: string,
  ): Promise<void> {
    // Skip delivery for remote follower (shouldn't happen, but safety check)
    if (follower.host) {
      console.log(`⚠️  Skipping Undo Follow delivery: follower is remote`);
      return;
    }

    // Skip if followee is not remote
    if (!followee.host || !followee.inbox) {
      return;
    }

    // Skip delivery if follower has no private key
    if (!follower.privateKey) {
      console.log(`⚠️  Cannot deliver Undo Follow: follower has no private key`);
      return;
    }

    const baseUrl = process.env.URL || 'http://localhost:3000';
    const followActivityId = originalFollowId || `${baseUrl}/activities/follow/${follower.id}/${followee.id}`;

    // Create ActivityPub Undo { Follow } activity
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Undo',
      id: `${baseUrl}/activities/undo/${Date.now()}`,
      actor: `${baseUrl}/users/${follower.username}`,
      object: {
        type: 'Follow',
        id: followActivityId,
        actor: `${baseUrl}/users/${follower.username}`,
        object: `${followee.uri}`,
      },
    };

    // Enqueue delivery to followee's inbox with normal priority
    await this.queue.enqueue({
      activity,
      inboxUrl: followee.inbox,
      keyId: `${baseUrl}/users/${follower.username}#main-key`,
      privateKey: follower.privateKey,
      priority: JobPriority.NORMAL,
    });

    console.log(`📤 Enqueued Undo Follow delivery to ${followee.inbox} (${follower.username} unfollowed ${followee.username}@${followee.host})`);
  }

  /**
   * Delivers an Undo Like activity to a remote user's inbox
   *
   * @param reactor - The user who is removing their like (must be local)
   * @param note - The note being unliked
   * @param noteAuthor - The author of the note (must be remote)
   * @param originalLikeId - Optional ID of the original Like activity
   */
  async deliverUndoLike(
    reactor: User,
    note: Note,
    noteAuthor: User,
    originalLikeId?: string,
  ): Promise<void> {
    // Skip delivery for remote reactor
    if (reactor.host) {
      console.log(`⚠️  Skipping Undo Like delivery: reactor is remote`);
      return;
    }

    // Skip if note author is not remote
    if (!noteAuthor.host || !noteAuthor.inbox) {
      return;
    }

    // Skip delivery if reactor has no private key
    if (!reactor.privateKey) {
      console.log(`⚠️  Cannot deliver Undo Like: reactor has no private key`);
      return;
    }

    const baseUrl = process.env.URL || 'http://localhost:3000';
    const noteUrl = note.uri || `${baseUrl}/notes/${note.id}`;
    const likeActivityId = originalLikeId || `${baseUrl}/activities/like/${reactor.id}/${note.id}`;

    // Create ActivityPub Undo { Like } activity
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Undo',
      id: `${baseUrl}/activities/undo/${Date.now()}`,
      actor: `${baseUrl}/users/${reactor.username}`,
      object: {
        type: 'Like',
        id: likeActivityId,
        actor: `${baseUrl}/users/${reactor.username}`,
        object: noteUrl,
      },
    };

    // Enqueue delivery to note author's inbox with normal priority
    await this.queue.enqueue({
      activity,
      inboxUrl: noteAuthor.inbox,
      keyId: `${baseUrl}/users/${reactor.username}#main-key`,
      privateKey: reactor.privateKey,
      priority: JobPriority.NORMAL,
    });

    console.log(`📤 Enqueued Undo Like delivery to ${noteAuthor.inbox} (${reactor.username} unliked note by ${noteAuthor.username}@${noteAuthor.host})`);
  }

  /**
   * Delivers a Delete activity to remote followers when a note is deleted
   *
   * @param note - The note being deleted
   * @param author - The author of the note (must be local)
   */
  async deliverDelete(note: Note, author: User): Promise<void> {
    // Skip delivery for remote author
    if (author.host) {
      console.log(`⚠️  Skipping Delete delivery: author is remote`);
      return;
    }

    // Skip delivery if author has no private key
    if (!author.privateKey) {
      console.log(`⚠️  Cannot deliver Delete: author has no private key`);
      return;
    }

    const baseUrl = process.env.URL || 'http://localhost:3000';
    const noteUrl = note.uri || `${baseUrl}/notes/${note.id}`;

    // Create ActivityPub Delete activity
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Delete',
      id: `${baseUrl}/activities/delete/${note.id}`,
      actor: `${baseUrl}/users/${author.username}`,
      object: noteUrl,
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${baseUrl}/users/${author.username}/followers`],
    };

    // Get all remote followers to deliver to
    const followRelations = await this.followRepository.findByFolloweeId(author.id);
    const remoteFollowers = await Promise.all(
      followRelations.map(async relation => {
        const follower = await this.userRepository.findById(relation.followerId);
        return follower;
      })
    );

    // Enqueue delivery to each remote follower's inbox (filter for remote users only)
    const deliveryPromises = remoteFollowers
      .filter((follower): follower is User =>
        follower !== null &&
        follower.host !== null && // Remote user
        follower.inbox !== null
      )
      .map(async follower => {
        await this.queue.enqueue({
          activity,
          inboxUrl: follower.inbox!,
          keyId: `${baseUrl}/users/${author.username}#main-key`,
          privateKey: author.privateKey!,
          priority: JobPriority.LOW, // Delete activities have lower priority
        });
        console.log(`📤 Enqueued Delete delivery to ${follower.inbox} (${author.username}'s note deleted)`);
      });

    await Promise.all(deliveryPromises);

    if (deliveryPromises.length === 0) {
      console.log(`ℹ️  No remote followers to deliver Delete activity for note ${note.id}`);
    }
  }

  /**
   * Delivers an Update activity to remote followers when a user updates their profile
   *
   * @param user - The user whose profile was updated (must be local)
   */
  async deliverUpdate(user: User): Promise<void> {
    // Skip delivery for remote user
    if (user.host) {
      console.log(`⚠️  Skipping Update delivery: user is remote`);
      return;
    }

    // Skip delivery if user has no private key
    if (!user.privateKey) {
      console.log(`⚠️  Cannot deliver Update: user has no private key`);
      return;
    }

    const baseUrl = process.env.URL || 'http://localhost:3000';
    const actorUrl = `${baseUrl}/users/${user.username}`;

    // Create complete Actor representation (Person object)
    const actorObject = {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1',
      ],
      type: 'Person',
      id: actorUrl,
      url: actorUrl,
      preferredUsername: user.username,
      name: user.displayName || user.username,
      summary: user.bio || '',
      inbox: `${baseUrl}/users/${user.username}/inbox`,
      outbox: `${baseUrl}/users/${user.username}/outbox`,
      followers: `${baseUrl}/users/${user.username}/followers`,
      following: `${baseUrl}/users/${user.username}/following`,
      icon: user.avatarUrl ? {
        type: 'Image',
        mediaType: 'image/jpeg',
        url: user.avatarUrl,
      } : undefined,
      image: user.bannerUrl ? {
        type: 'Image',
        mediaType: 'image/jpeg',
        url: user.bannerUrl,
      } : undefined,
      publicKey: {
        id: `${actorUrl}#main-key`,
        owner: actorUrl,
        publicKeyPem: user.publicKey,
      },
    };

    // Create ActivityPub Update activity
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Update',
      id: `${baseUrl}/activities/update/${user.id}/${Date.now()}`,
      actor: actorUrl,
      object: actorObject,
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${baseUrl}/users/${user.username}/followers`],
    };

    // Get all remote followers to deliver to
    const followRelations = await this.followRepository.findByFolloweeId(user.id);
    const remoteFollowers = await Promise.all(
      followRelations.map(async relation => {
        const follower = await this.userRepository.findById(relation.followerId);
        return follower;
      })
    );

    // Enqueue delivery to each remote follower's inbox (filter for remote users only)
    const deliveryPromises = remoteFollowers
      .filter((follower): follower is User =>
        follower !== null &&
        follower.host !== null && // Remote user
        follower.inbox !== null
      )
      .map(async follower => {
        await this.queue.enqueue({
          activity,
          inboxUrl: follower.inbox!,
          keyId: `${baseUrl}/users/${user.username}#main-key`,
          privateKey: user.privateKey!,
          priority: JobPriority.LOW, // Update activities have lower priority
        });
        console.log(`📤 Enqueued Update delivery to ${follower.inbox} (${user.username}'s profile updated)`);
      });

    await Promise.all(deliveryPromises);

    if (deliveryPromises.length === 0) {
      console.log(`ℹ️  No remote followers to deliver Update activity for user ${user.id}`);
    }
  }
}
