/**
 * Like Activity Handler
 *
 * Processes Like activities (reactions to posts).
 * Supports Misskey custom emoji reactions.
 *
 * @module services/ap/inbox/handlers/LikeHandler
 */

import type { Activity, HandlerContext, HandlerResult } from "../types.js";
import { getObjectUri } from "../types.js";
import { BaseHandler } from "./BaseHandler.js";
import { extractReactionFromLike } from "../../../../utils/activitypub/reaction.js";

/**
 * Handler for Like activities
 *
 * Creates reactions/likes on local notes from remote users.
 * Supports Misskey _misskey_reaction extension for custom emoji.
 */
export class LikeHandler extends BaseHandler {
  readonly activityType = "Like";

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c } = context;

    try {
      const objectUri = getObjectUri(activity.object);

      if (!objectUri) {
        this.warn("Invalid Like activity: missing object");
        return this.failure("Invalid Like activity: missing object");
      }

      // Debug: Log received activity for custom emoji troubleshooting
      if (activity._misskey_reaction || activity.content) {
        console.log(`📥 Like activity received:`, JSON.stringify({
          actor: activity.actor,
          object: objectUri,
          content: activity.content,
          _misskey_reaction: activity._misskey_reaction,
          tag: activity.tag,
        }, null, 2));
      }

      // Extract reaction (supports Misskey custom emoji)
      const { reaction, customEmojiUrl, emojiName, emojiHost } = extractReactionFromLike(
        activity,
        this.getActorUri(activity),
      );

      this.log(
        "📥",
        `Like: ${activity.actor} → ${objectUri} (reaction: ${reaction}${customEmojiUrl ? ", custom emoji URL: " + customEmojiUrl : ""}${emojiName ? ", name: " + emojiName : ""}${emojiHost ? ", host: " + emojiHost : ""})`,
      );

      // Resolve remote actor
      const actorUri = this.getActorUri(activity);
      const remoteActor = await this.resolveActor(actorUri, c);

      // Find the note being liked
      const noteRepository = this.getNoteRepository(c);
      const note = await noteRepository.findByUri(objectUri);

      if (!note) {
        this.warn(`Note not found: ${objectUri}`);
        return this.failure(`Note not found: ${objectUri}`);
      }

      // Save remote custom emoji to database if present
      if (customEmojiUrl && emojiName && emojiHost) {
        console.log(`💾 Saving remote emoji: :${emojiName}:@${emojiHost} -> ${customEmojiUrl}`);
        await this.saveRemoteEmoji(c, emojiName, emojiHost, customEmojiUrl);
      } else if (emojiName) {
        console.log(`⚠️ Cannot save remote emoji :${emojiName}: - missing: ${!customEmojiUrl ? 'URL' : ''} ${!emojiHost ? 'host' : ''}`);
      }

      // Check if reaction already exists
      const reactionRepository = this.getReactionRepository(c);
      const existingReaction = await reactionRepository.findByUserNoteAndReaction(
        remoteActor.id,
        note.id,
        reaction,
      );

      if (existingReaction) {
        this.log("⚠️", "Reaction already exists, skipping");
        return this.success("Reaction already exists");
      }

      // Create reaction with custom emoji URL if available
      const id = this.generateId();
      await reactionRepository.create({
        id,
        userId: remoteActor.id,
        noteId: note.id,
        reaction,
        ...(customEmojiUrl && { customEmojiUrl }),
      });

      this.log(
        "✅",
        `Reaction created: ${remoteActor.username}@${remoteActor.host} ${reaction} note ${note.id}`,
      );

      // Create notification for the note author (fire-and-forget)
      try {
        const notificationService = this.getNotificationService(c);
        if (notificationService) {
          await notificationService.createReactionNotification(
            note.userId,
            remoteActor.id,
            note.id,
            reaction,
          );
        }
      } catch (notifError) {
        this.warn(`Failed to create reaction notification: ${notifError}`);
      }

      return this.success(`Reaction created: ${reaction}`);
    } catch (error) {
      this.error("Failed to handle Like activity:", error as Error);
      return this.failure("Failed to handle Like activity", error as Error);
    }
  }

  /**
   * Save remote custom emoji to database for future use
   *
   * This allows users to use remote emojis when reacting to notes
   * from that remote server.
   */
  private async saveRemoteEmoji(
    c: any,
    name: string,
    host: string,
    url: string,
  ): Promise<void> {
    try {
      const customEmojiRepository = this.getCustomEmojiRepository(c);

      // Check if emoji already exists
      const existing = await customEmojiRepository.findByName(name, host);

      if (existing) {
        // Update URL if it changed
        if (existing.url !== url) {
          await customEmojiRepository.update(existing.id, { url, updatedAt: new Date() });
          this.log("🔄", `Updated remote emoji: :${name}:@${host}`);
        }
        return;
      }

      // Create new remote emoji entry
      await customEmojiRepository.create({
        id: this.generateId(),
        name,
        host,
        url,
        publicUrl: url,
        aliases: [],
        isSensitive: false,
        localOnly: false,
      });

      this.log("✨", `Saved remote emoji: :${name}:@${host}`);
    } catch (error) {
      // Don't fail the reaction if emoji saving fails
      this.warn(`Failed to save remote emoji :${name}:@${host}: ${error}`);
    }
  }
}
