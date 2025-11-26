/**
 * ActivityPub Delivery Service
 *
 * Handles ActivityPub activity delivery to remote inboxes.
 * Uses ActivityBuilder for activity construction and ActivityDeliveryQueue for async delivery.
 *
 * @module services/ap/ActivityPubDeliveryService
 */

import type { IUserRepository } from '../../interfaces/repositories/IUserRepository.js';
import type { IFollowRepository } from '../../interfaces/repositories/IFollowRepository.js';
import type { IInstanceBlockRepository } from '../../interfaces/repositories/IInstanceBlockRepository.js';
import type { Note } from 'shared';
import type { User } from '../../db/schema/pg.js';
import { ActivityDeliveryQueue, JobPriority } from './ActivityDeliveryQueue.js';
import { ActivityBuilder, type Activity } from './delivery/ActivityBuilder.js';

/**
 * Delivery options for enqueuing activities
 */
interface DeliveryOptions {
  activity: Activity;
  inboxUrl: string;
  actor: User;
  priority?: JobPriority;
}

/**
 * ActivityPub Delivery Service
 *
 * Provides methods to deliver ActivityPub activities to remote servers.
 *
 * @example
 * ```typescript
 * const deliveryService = new ActivityPubDeliveryService(userRepo, followRepo, queue);
 * await deliveryService.deliverCreateNote(note, author);
 * ```
 */
export class ActivityPubDeliveryService {
  private readonly queue: ActivityDeliveryQueue;
  private readonly builder: ActivityBuilder;

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly followRepository: IFollowRepository,
    activityDeliveryQueue: ActivityDeliveryQueue,
    private readonly instanceBlockRepository?: IInstanceBlockRepository,
  ) {
    this.queue = activityDeliveryQueue;
    this.builder = new ActivityBuilder();
  }

  /**
   * Check if an inbox URL's host is blocked
   */
  private async isHostBlocked(inboxUrl: string): Promise<boolean> {
    if (!this.instanceBlockRepository) return false;
    try {
      const host = new URL(inboxUrl).hostname;
      return await this.instanceBlockRepository.isBlocked(host);
    } catch {
      return false;
    }
  }

  /**
   * Get unique inbox URLs from users, preferring shared inbox when available
   */
  private getUniqueInboxUrls(users: User[]): Set<string> {
    const inboxUrls = new Set<string>();

    for (const user of users) {
      if (!user.host) continue;
      const inboxUrl = user.sharedInbox || user.inbox;
      if (inboxUrl) inboxUrls.add(inboxUrl);
    }

    return inboxUrls;
  }

  /**
   * Get remote followers for a user
   */
  private async getRemoteFollowers(userId: string): Promise<User[]> {
    const follows = await this.followRepository.findByFolloweeId(userId);
    if (follows.length === 0) return [];

    const followers = await Promise.all(
      follows.map((follow) => this.userRepository.findById(follow.followerId))
    );

    return followers.filter((f): f is User => f !== null && f.host !== null);
  }

  /**
   * Enqueue activity delivery to a single inbox
   */
  private async enqueueDelivery(options: DeliveryOptions): Promise<void> {
    const { activity, inboxUrl, actor, priority = JobPriority.NORMAL } = options;

    if (!actor.privateKey) {
      console.log(`⚠️  Cannot deliver: actor has no private key`);
      return;
    }

    // Check if the target instance is blocked
    if (await this.isHostBlocked(inboxUrl)) {
      console.log(`🚫 Skipping delivery to blocked instance: ${inboxUrl}`);
      return;
    }

    await this.queue.enqueue({
      activity,
      inboxUrl,
      keyId: this.builder.keyId(actor.username),
      privateKey: actor.privateKey,
      priority,
    });
  }

  /**
   * Deliver activity to multiple inboxes
   */
  private async deliverToInboxes(
    activity: Activity,
    inboxUrls: Set<string>,
    actor: User,
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<void> {
    const deliveryPromises = Array.from(inboxUrls).map((inboxUrl) =>
      this.enqueueDelivery({ activity, inboxUrl, actor, priority })
    );
    await Promise.all(deliveryPromises);
  }

  /**
   * Deliver Create activity for a note to all followers
   */
  async deliverCreateNote(note: Note, author: User): Promise<void> {
    if (author.host || note.localOnly) return;

    const remoteFollowers = await this.getRemoteFollowers(author.id);
    if (remoteFollowers.length === 0) {
      console.log(`📭 No followers to deliver to for note ${note.id}`);
      return;
    }

    const activity = this.builder.createNote(note, author);
    const inboxUrls = this.getUniqueInboxUrls(remoteFollowers);

    await this.deliverToInboxes(activity, inboxUrls, author);
    console.log(`📤 Enqueued Create activity to ${inboxUrls.size} inboxes for note ${note.id}`);
  }

  /**
   * Deliver Like activity to note author
   */
  async deliverLikeActivity(
    noteId: string,
    noteUri: string,
    noteAuthorInbox: string,
    reactor: User
  ): Promise<void> {
    if (reactor.host) return;

    const activity = this.builder.like(noteId, noteUri, reactor);
    await this.enqueueDelivery({
      activity,
      inboxUrl: noteAuthorInbox,
      actor: reactor,
    });

    console.log(`📤 Enqueued Like activity to ${noteAuthorInbox} for note ${noteId}`);
  }

  /**
   * Deliver Follow activity to remote user
   */
  async deliverFollow(follower: User, followee: User): Promise<string | null> {
    if (follower.host || !followee.host || !followee.inbox) return null;

    const followeeUri = followee.uri || `https://${followee.host}/users/${followee.username}`;
    const activity = this.builder.follow(follower, followeeUri);

    await this.enqueueDelivery({
      activity,
      inboxUrl: followee.inbox,
      actor: follower,
      priority: JobPriority.URGENT,
    });

    console.log(`📤 Enqueued Follow activity to ${followee.inbox} (${follower.username} → ${followee.username}@${followee.host})`);
    return activity.id;
  }

  /**
   * Deliver Undo Follow activity to remote user
   */
  async deliverUndoFollow(follower: User, followee: User, originalFollowId?: string): Promise<void> {
    if (follower.host || !followee.host || !followee.inbox) return;

    const followeeUri = followee.uri || `https://${followee.host}/users/${followee.username}`;
    const activity = this.builder.undoFollow(follower, followeeUri, originalFollowId);

    await this.enqueueDelivery({
      activity,
      inboxUrl: followee.inbox,
      actor: follower,
      priority: JobPriority.URGENT,
    });

    console.log(`📤 Enqueued Undo Follow activity to ${followee.inbox} (${follower.username} unfollowing ${followee.username}@${followee.host})`);
  }

  /**
   * Deliver Undo Like activity to note author
   */
  async deliverUndoLike(
    reactor: User,
    note: Note,
    noteAuthor: User
  ): Promise<void> {
    if (reactor.host) return;
    if (!noteAuthor.host || !noteAuthor.inbox) return;

    const noteUri = note.uri || `https://${noteAuthor.host}/notes/${note.id}`;
    const activity = this.builder.undoLike(note.id, noteUri, reactor);

    await this.enqueueDelivery({
      activity,
      inboxUrl: noteAuthor.inbox,
      actor: reactor,
    });

    console.log(`📤 Enqueued Undo Like activity to ${noteAuthor.inbox} for note ${note.id}`);
  }

  /**
   * Deliver Delete activity to followers
   */
  async deliverDelete(note: Note, author: User): Promise<void> {
    if (author.host || note.localOnly) return;

    const remoteFollowers = await this.getRemoteFollowers(author.id);
    if (remoteFollowers.length === 0) return;

    const noteUri = note.uri || `${process.env.URL || 'http://localhost:3000'}/notes/${note.id}`;
    const activity = this.builder.delete(noteUri, author);
    const inboxUrls = this.getUniqueInboxUrls(remoteFollowers);

    await this.deliverToInboxes(activity, inboxUrls, author, JobPriority.LOW);
    console.log(`📤 Enqueued Delete activity to ${inboxUrls.size} inboxes for note ${note.id}`);
  }

  /**
   * Deliver Update activity for actor profile
   */
  async deliverUpdate(actor: User): Promise<void> {
    if (actor.host) return;

    const remoteFollowers = await this.getRemoteFollowers(actor.id);
    if (remoteFollowers.length === 0) {
      console.log(`📭 No followers to deliver Update to for user ${actor.username}`);
      return;
    }

    const activity = this.builder.updateActor(actor);
    const inboxUrls = this.getUniqueInboxUrls(remoteFollowers);

    await this.deliverToInboxes(activity, inboxUrls, actor, JobPriority.LOW);
    console.log(`📤 Enqueued Update activity to ${inboxUrls.size} inboxes for user ${actor.username}`);
  }

  /**
   * Deliver Announce activity (boost/renote) to target note author
   */
  async deliverAnnounceActivity(
    noteId: string,
    targetNote: Note,
    actor: User,
    targetNoteAuthor: User
  ): Promise<void> {
    if (actor.host) return;
    if (!targetNoteAuthor.host || !targetNoteAuthor.inbox) return;

    const targetNoteUri = targetNote.uri || `https://${targetNoteAuthor.host}/notes/${targetNote.id}`;
    const activity = this.builder.announce(noteId, targetNoteUri, actor);

    await this.enqueueDelivery({
      activity,
      inboxUrl: targetNoteAuthor.inbox,
      actor,
    });

    console.log(`📤 Enqueued Announce activity to ${targetNoteAuthor.inbox} for note ${noteId}`);
  }
}
