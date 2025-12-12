/**
 * ActivityPub Delivery Service
 *
 * Handles ActivityPub activity delivery to remote inboxes.
 * Uses ActivityBuilder for activity construction and ActivityDeliveryQueue for async delivery.
 *
 * @module services/ap/ActivityPubDeliveryService
 */

import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { IFollowRepository } from "../../interfaces/repositories/IFollowRepository.js";
import type { IInstanceBlockRepository } from "../../interfaces/repositories/IInstanceBlockRepository.js";
import type { ICustomEmojiRepository } from "../../interfaces/repositories/ICustomEmojiRepository.js";
import type { IDriveFileRepository } from "../../interfaces/repositories/IDriveFileRepository.js";
import type { Note } from "shared";
import type { User } from "../../db/schema/pg.js";
import { ActivityDeliveryQueue, JobPriority } from "./ActivityDeliveryQueue.js";
import {
  ActivityBuilder,
  type Activity,
  type AttachmentObject,
  type CustomEmojiInfo,
  type EmojiTag,
} from "./delivery/ActivityBuilder.js";
import { logger } from "../../lib/logger.js";

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
    private readonly customEmojiRepository?: ICustomEmojiRepository,
    private readonly driveFileRepository?: IDriveFileRepository,
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
      follows.map((follow) => this.userRepository.findById(follow.followerId)),
    );

    return followers.filter((f): f is User => f !== null && f.host !== null);
  }

  /**
   * Enqueue activity delivery to a single inbox
   */
  private async enqueueDelivery(options: DeliveryOptions): Promise<void> {
    const { activity, inboxUrl, actor, priority = JobPriority.NORMAL } = options;

    if (!actor.privateKey) {
      logger.warn({ actorId: actor.id }, "Cannot deliver: actor has no private key");
      return;
    }

    // Check if the target instance is blocked
    if (await this.isHostBlocked(inboxUrl)) {
      logger.debug({ inboxUrl }, "Skipping delivery to blocked instance");
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
    priority: JobPriority = JobPriority.NORMAL,
  ): Promise<void> {
    const deliveryPromises = Array.from(inboxUrls).map((inboxUrl) =>
      this.enqueueDelivery({ activity, inboxUrl, actor, priority }),
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
      logger.debug({ noteId: note.id }, "No followers to deliver Create activity to");
      return;
    }

    // Build emoji tags from note's emojis
    const emojiTags = await this.buildEmojiTags(note.emojis);

    // Build file attachments from note's fileIds
    const attachments = await this.buildAttachments(note.fileIds);

    const activity = this.builder.createNote(note, author, emojiTags, attachments);
    const inboxUrls = this.getUniqueInboxUrls(remoteFollowers);

    await this.deliverToInboxes(activity, inboxUrls, author);
    logger.debug(
      { noteId: note.id, inboxCount: inboxUrls.size, attachmentCount: attachments.length },
      "Enqueued Create activity",
    );
  }

  /**
   * Build emoji tags for ActivityPub delivery from emoji shortcodes
   */
  private async buildEmojiTags(emojiNames: string[]): Promise<EmojiTag[]> {
    if (!this.customEmojiRepository || emojiNames.length === 0) {
      return [];
    }

    const emojiTags: EmojiTag[] = [];
    const baseUrl = process.env.URL || "http://localhost:3000";

    for (const name of emojiNames) {
      // Look up local custom emoji
      const emoji = await this.customEmojiRepository.findByName(name);
      if (emoji && !emoji.host) {
        // Only include local emojis (remote emojis should not be re-shared)
        emojiTags.push({
          type: "Emoji",
          name: `:${emoji.name}:`,
          icon: {
            type: "Image",
            mediaType: this.getEmojiMediaType(emoji.url),
            url: emoji.url.startsWith("http") ? emoji.url : `${baseUrl}${emoji.url}`,
          },
        });
      }
    }

    return emojiTags;
  }

  /**
   * Get media type from emoji URL
   */
  private getEmojiMediaType(url: string): string {
    const ext = url.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      case "svg":
        return "image/svg+xml";
      default:
        return "image/png";
    }
  }

  /**
   * Build file attachments for ActivityPub delivery
   *
   * Fetches file metadata from drive_files table and converts to ActivityPub Document format.
   */
  private async buildAttachments(fileIds: string[]): Promise<AttachmentObject[]> {
    if (!this.driveFileRepository || fileIds.length === 0) {
      return [];
    }

    const files = await this.driveFileRepository.findByIds(fileIds);

    return files.map((file) => ({
      type: "Document" as const,
      mediaType: file.type,
      url: file.url,
      name: file.name || undefined,
    }));
  }

  /**
   * Deliver Like activity to note author
   *
   * @param noteId - ID of the note being reacted to
   * @param noteUri - ActivityPub URI of the note
   * @param noteAuthorInbox - Inbox URL of the note author
   * @param reactor - User creating the reaction
   * @param reaction - Reaction emoji (e.g., "👍", ":custom_emoji:")
   * @param customEmoji - Optional custom emoji info (name and URL) for the tag
   */
  async deliverLikeActivity(
    noteId: string,
    noteUri: string,
    noteAuthorInbox: string,
    reactor: User,
    reaction?: string,
    customEmoji?: CustomEmojiInfo,
  ): Promise<void> {
    if (reactor.host) return;

    const activity = this.builder.like(noteId, noteUri, reactor, reaction, customEmoji);
    await this.enqueueDelivery({
      activity,
      inboxUrl: noteAuthorInbox,
      actor: reactor,
    });

    logger.debug({ noteId, reaction: reaction || "❤️", inboxUrl: noteAuthorInbox }, "Enqueued Like activity");
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

    logger.debug(
      { follower: follower.username, followee: `${followee.username}@${followee.host}`, inboxUrl: followee.inbox },
      "Enqueued Follow activity",
    );
    return activity.id;
  }

  /**
   * Deliver Undo Follow activity to remote user
   */
  async deliverUndoFollow(
    follower: User,
    followee: User,
    originalFollowId?: string,
  ): Promise<void> {
    if (follower.host || !followee.host || !followee.inbox) return;

    const followeeUri = followee.uri || `https://${followee.host}/users/${followee.username}`;
    const activity = this.builder.undoFollow(follower, followeeUri, originalFollowId);

    await this.enqueueDelivery({
      activity,
      inboxUrl: followee.inbox,
      actor: follower,
      priority: JobPriority.URGENT,
    });

    logger.debug(
      { follower: follower.username, followee: `${followee.username}@${followee.host}`, inboxUrl: followee.inbox },
      "Enqueued Undo Follow activity",
    );
  }

  /**
   * Deliver Undo Like activity to note author
   */
  async deliverUndoLike(reactor: User, note: Note, noteAuthor: User): Promise<void> {
    if (reactor.host) return;
    if (!noteAuthor.host || !noteAuthor.inbox) return;

    const noteUri = note.uri || `https://${noteAuthor.host}/notes/${note.id}`;
    const activity = this.builder.undoLike(note.id, noteUri, reactor);

    await this.enqueueDelivery({
      activity,
      inboxUrl: noteAuthor.inbox,
      actor: reactor,
    });

    logger.debug({ noteId: note.id, inboxUrl: noteAuthor.inbox }, "Enqueued Undo Like activity");
  }

  /**
   * Deliver Delete activity to followers
   */
  async deliverDelete(note: Note, author: User): Promise<void> {
    if (author.host || note.localOnly) return;

    const remoteFollowers = await this.getRemoteFollowers(author.id);
    if (remoteFollowers.length === 0) return;

    const noteUri = note.uri || `${process.env.URL || "http://localhost:3000"}/notes/${note.id}`;
    const activity = this.builder.delete(noteUri, author);
    const inboxUrls = this.getUniqueInboxUrls(remoteFollowers);

    await this.deliverToInboxes(activity, inboxUrls, author, JobPriority.LOW);
    logger.debug({ noteId: note.id, inboxCount: inboxUrls.size }, "Enqueued Delete activity");
  }

  /**
   * Deliver Update activity for actor profile
   */
  async deliverUpdate(actor: User): Promise<void> {
    if (actor.host) return;

    const remoteFollowers = await this.getRemoteFollowers(actor.id);
    if (remoteFollowers.length === 0) {
      logger.debug({ username: actor.username }, "No followers to deliver Update activity to");
      return;
    }

    const activity = this.builder.updateActor(actor);
    const inboxUrls = this.getUniqueInboxUrls(remoteFollowers);

    await this.deliverToInboxes(activity, inboxUrls, actor, JobPriority.LOW);
    logger.debug({ username: actor.username, inboxCount: inboxUrls.size }, "Enqueued Update activity");
  }

  /**
   * Deliver Announce activity (boost/renote) to all followers
   *
   * Following ActivityPub spec, Announce activities are sent to all followers,
   * plus the target note's author if they're remote (so they can increment their renote count).
   */
  async deliverAnnounceActivity(noteId: string, targetNote: Note, actor: User): Promise<void> {
    if (actor.host) return;

    const remoteFollowers = await this.getRemoteFollowers(actor.id);

    // Get target note author to include in delivery (if remote and not already a follower)
    const targetNoteAuthor = await this.userRepository.findById(targetNote.userId);

    // Get all inbox URLs from followers
    const inboxUrls = this.getUniqueInboxUrls(remoteFollowers);

    // Add target note author's inbox if they're remote
    if (targetNoteAuthor?.host && targetNoteAuthor.inbox) {
      const authorInbox = targetNoteAuthor.sharedInbox || targetNoteAuthor.inbox;
      inboxUrls.add(authorInbox);
    }

    if (inboxUrls.size === 0) {
      logger.debug({ noteId }, "No inboxes to deliver Announce activity to");
      return;
    }

    // Build the target note URI
    const targetNoteUri =
      targetNote.uri ||
      (targetNoteAuthor?.host
        ? `https://${targetNoteAuthor.host}/notes/${targetNote.id}`
        : `${process.env.URL || "http://localhost:3000"}/notes/${targetNote.id}`);

    const activity = this.builder.announce(noteId, targetNoteUri, actor);

    await this.deliverToInboxes(activity, inboxUrls, actor);
    logger.debug({ noteId, inboxCount: inboxUrls.size }, "Enqueued Announce activity");
  }

  /**
   * Deliver Delete activity for actor (account deletion)
   *
   * This sends a Delete activity to all remote followers when an account is deleted.
   * The activity must be sent BEFORE the actor's private key is cleared.
   *
   * @param actor - The actor being deleted (must still have privateKey)
   * @returns Number of inboxes the activity was enqueued to
   */
  async deliverDeleteActor(actor: User): Promise<number> {
    if (actor.host) return 0; // Can't send delete for remote users

    const remoteFollowers = await this.getRemoteFollowers(actor.id);
    if (remoteFollowers.length === 0) {
      logger.debug({ username: actor.username }, "No remote followers to notify about deletion");
      return 0;
    }

    const activity = this.builder.deleteActor(actor);
    const inboxUrls = this.getUniqueInboxUrls(remoteFollowers);

    await this.deliverToInboxes(activity, inboxUrls, actor, JobPriority.URGENT);
    logger.info(
      { username: actor.username, inboxCount: inboxUrls.size },
      "Enqueued Delete actor activity",
    );

    return inboxUrls.size;
  }

  /**
   * Deliver Direct Message to specific recipients
   *
   * Sends a Create activity with direct message visibility to specified users.
   * Only delivers to remote users (local users receive the message via database).
   *
   * @param note - The direct message note
   * @param author - The note author
   * @param recipientIds - User IDs of the DM recipients
   */
  async deliverDirectMessage(note: Note, author: User, recipientIds: string[]): Promise<void> {
    logger.debug(
      { noteId: note.id, recipientIds, authorHost: author.host, localOnly: note.localOnly },
      "deliverDirectMessage called",
    );

    if (author.host || note.localOnly) {
      logger.debug({ noteId: note.id }, "Skipping DM delivery: author is remote or note is local-only");
      return;
    }
    if (recipientIds.length === 0) {
      logger.debug({ noteId: note.id }, "Skipping DM delivery: no recipient IDs");
      return;
    }

    // Fetch all recipients
    const recipients = await Promise.all(
      recipientIds.map((id) => this.userRepository.findById(id)),
    );

    // Log recipient details for debugging
    logger.debug(
      {
        noteId: note.id,
        recipients: recipients.map((r) =>
          r ? { id: r.id, username: r.username, host: r.host, inbox: r.inbox, uri: r.uri } : null,
        ),
      },
      "Fetched DM recipients",
    );

    // Filter to remote users only
    const remoteRecipients = recipients.filter(
      (r): r is User => r !== null && r.host !== null && r.inbox !== null,
    );

    if (remoteRecipients.length === 0) {
      logger.debug({ noteId: note.id }, "No remote recipients for direct message");
      return;
    }

    // Build activity with direct message addressing
    const activity = this.builder.createDirectMessage(note, author, remoteRecipients);
    const inboxUrls = this.getUniqueInboxUrls(remoteRecipients);

    logger.info(
      {
        noteId: note.id,
        inboxUrls: Array.from(inboxUrls),
        recipientUris: remoteRecipients.map((r) => r.uri),
        activityTo: (activity.object as { to?: string[] })?.to,
      },
      "Delivering Direct Message activity",
    );

    await this.deliverToInboxes(activity, inboxUrls, author);
    logger.debug(
      { noteId: note.id, inboxCount: inboxUrls.size, recipientCount: remoteRecipients.length },
      "Enqueued Direct Message activity",
    );
  }
}
