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
import type { Note } from '../../../shared/src/types/note.js';
import type { User } from '../../../shared/src/types/user.js';
import { ActivityDeliveryQueue } from './ActivityDeliveryQueue.js';

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

    // Enqueue delivery to each inbox
    const deliveryPromises = Array.from(inboxUrls).map((inboxUrl) =>
      this.queue.enqueue({
        activity,
        inboxUrl,
        keyId: `${baseUrl}/users/${author.username}#main-key`,
        privateKey: author.privateKey,
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

    const baseUrl = process.env.URL || 'http://localhost:3000';

    // Create ActivityPub Like activity
    const activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Like',
      id: `${baseUrl}/activities/like/${noteId}/${Date.now()}`,
      actor: `${baseUrl}/users/${reactor.username}`,
      object: noteUri,
    };

    // Enqueue delivery
    await this.queue.enqueue({
      activity,
      inboxUrl: noteAuthorInbox,
      keyId: `${baseUrl}/users/${reactor.username}#main-key`,
      privateKey: reactor.privateKey,
    });

    console.log(`📤 Enqueued Like activity delivery to ${noteAuthorInbox} for note ${noteId}`);
  }
}
