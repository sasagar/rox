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

      // Extract reaction (supports Misskey custom emoji)
      const { reaction, customEmojiUrl } = extractReactionFromLike(activity);

      this.log(
        "📥",
        `Like: ${activity.actor} → ${objectUri} (reaction: ${reaction}${customEmojiUrl ? ", custom emoji" : ""})`,
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
}
