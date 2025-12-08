/**
 * Delete Activity Handler
 *
 * Processes Delete activities for object deletion.
 *
 * @module services/ap/inbox/handlers/DeleteHandler
 */

import type { Activity, HandlerContext, HandlerResult } from "../types.js";
import { getObjectUri } from "../types.js";
import { BaseHandler } from "./BaseHandler.js";
import type { UserDeletionService } from "../../../UserDeletionService.js";

/**
 * Handler for Delete activities
 *
 * Handles:
 * - Delete Note: Removes remote posts from local database
 * - Delete Actor: Marks remote actors as deleted (account deletion)
 */
export class DeleteHandler extends BaseHandler {
  readonly activityType = "Delete";

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c } = context;

    try {
      const objectUri = getObjectUri(activity.object);

      if (!objectUri) {
        this.warn("Invalid Delete activity: missing object URI");
        return this.failure("Invalid Delete activity: missing object URI");
      }

      const actorUri = this.getActorUri(activity);

      this.log("📥", `Delete activity received: actor=${actorUri} object=${objectUri}`);

      // Check if this is an actor self-deletion (actor URI == object URI)
      if (actorUri === objectUri) {
        return this.handleActorDeletion(actorUri, c);
      }

      // Otherwise, try to resolve the actor and handle note deletion
      const remoteActor = await this.resolveActor(actorUri, c);

      this.log("📥", `Delete: ${remoteActor.username}@${remoteActor.host} → ${objectUri}`);

      // Try to find and delete the note
      const noteRepository = this.getNoteRepository(c);
      const note = await noteRepository.findByUri(objectUri);

      if (note) {
        // Verify the actor owns this note
        if (note.userId !== remoteActor.id) {
          this.warn(`Actor ${remoteActor.id} does not own note ${note.id}`);
          return this.failure("Cannot delete note owned by another user");
        }

        // Delete the note
        await noteRepository.delete(note.id);
        this.log(
          "✅",
          `Note deleted: ${remoteActor.username}@${remoteActor.host} deleted note ${note.id}`,
        );
        return this.success(`Note deleted: ${note.id}`);
      }

      // If not a note, check if the object is a known user (actor deletion)
      const userRepository = this.getUserRepository(c);
      const targetUser = await userRepository.findByUri(objectUri);

      if (targetUser && targetUser.host !== null) {
        // This is a remote user - check if the actor is the same
        if (targetUser.uri === actorUri) {
          return this.handleActorDeletion(actorUri, c);
        }
      }

      this.log("ℹ️", `Delete target not found: ${objectUri}`);
      return this.success("Delete target not found");
    } catch (error) {
      this.error("Failed to handle Delete activity:", error as Error);
      return this.failure("Failed to handle Delete activity", error as Error);
    }
  }

  /**
   * Handle deletion of a remote actor (account deletion)
   *
   * When a remote server sends a Delete activity for an actor,
   * we mark that actor as deleted in our database.
   */
  private async handleActorDeletion(actorUri: string, c: HandlerContext["c"]): Promise<HandlerResult> {
    const userRepository = this.getUserRepository(c);

    // Find the user by their ActivityPub URI
    const user = await userRepository.findByUri(actorUri);

    if (!user) {
      this.log("ℹ️", `Actor not found for deletion: ${actorUri}`);
      return this.success("Actor not found, nothing to delete");
    }

    // Only delete remote users (shouldn't happen for local users, but safety check)
    if (user.host === null) {
      this.warn(`Received Delete activity for local user ${user.username}, ignoring`);
      return this.failure("Cannot delete local user via incoming Delete activity");
    }

    // Check if already deleted
    if (user.isDeleted) {
      this.log("ℹ️", `Actor already deleted: ${user.username}@${user.host}`);
      return this.success("Actor already deleted");
    }

    // Use UserDeletionService to mark the remote user as deleted
    const userDeletionService = c.get("userDeletionService") as UserDeletionService;
    const result = await userDeletionService.deleteRemoteUser(user.id);

    if (result.success) {
      this.log("✅", `Remote actor deleted: ${user.username}@${user.host}`);
      return this.success(`Remote actor deleted: ${user.username}@${user.host}`);
    }
    this.warn(`Failed to delete remote actor: ${result.message}`);
    return this.failure(result.message);
  }
}
