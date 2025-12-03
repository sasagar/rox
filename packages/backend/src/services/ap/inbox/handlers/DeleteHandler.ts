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

/**
 * Handler for Delete activities
 *
 * Currently handles:
 * - Delete Note: Removes remote posts from local database
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

      // If not a note, it might be an actor deletion (account deletion)
      // For now, log and ignore actor deletions
      this.log("ℹ️", `Delete target not found or not supported: ${objectUri}`);
      return this.success("Delete target not found or not supported");
    } catch (error) {
      this.error("Failed to handle Delete activity:", error as Error);
      return this.failure("Failed to handle Delete activity", error as Error);
    }
  }
}
