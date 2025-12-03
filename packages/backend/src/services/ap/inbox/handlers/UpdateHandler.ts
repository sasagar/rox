/**
 * Update Activity Handler
 *
 * Processes Update activities for existing objects.
 *
 * @module services/ap/inbox/handlers/UpdateHandler
 */

import type { Activity, HandlerContext, HandlerResult } from "../types.js";
import { BaseHandler } from "./BaseHandler.js";

/**
 * Handler for Update activities
 *
 * Currently handles:
 * - Update Person: Profile updates from remote users
 * - Update Note: Note edits from remote users
 */
export class UpdateHandler extends BaseHandler {
  readonly activityType = "Update";

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c } = context;

    try {
      const object = activity.object;

      if (!object || typeof object !== "object") {
        this.warn("Invalid Update activity: missing or invalid object");
        return this.failure("Invalid Update activity: missing or invalid object");
      }

      const actorUri = this.getActorUri(activity);
      const remoteActor = await this.resolveActor(actorUri, c);
      const objectType = (object as { type?: string }).type;

      // Handle Person update (profile update)
      if (objectType === "Person" || objectType === "Service" || objectType === "Application") {
        return this.handlePersonUpdate(object, actorUri, remoteActor, c);
      }

      // Handle Note update (note edit)
      if (objectType === "Note") {
        return this.handleNoteUpdate(object, remoteActor, c);
      }

      this.log("ℹ️", `Unsupported Update object type: ${objectType}`);
      return this.success(`Unsupported Update object type: ${objectType}`);
    } catch (error) {
      this.error("Failed to handle Update activity:", error as Error);
      return this.failure("Failed to handle Update activity", error as Error);
    }
  }

  /**
   * Handle Person/Service/Application update (profile update)
   */
  private async handlePersonUpdate(
    object: any,
    actorUri: string,
    remoteActor: any,
    c: any,
  ): Promise<HandlerResult> {
    const objectUri = object.id;

    if (!objectUri) {
      this.warn("Invalid Update Person: missing object id");
      return this.failure("Invalid Update Person: missing object id");
    }

    // Verify the actor is updating their own profile
    if (objectUri !== actorUri) {
      this.warn(`Actor ${actorUri} cannot update another actor ${objectUri}`);
      return this.failure("Cannot update another actor");
    }

    this.log("📥", `Update Person: ${remoteActor.username}@${remoteActor.host}`);

    // Extract profile fields from the Person object
    const updateData: Record<string, any> = {};

    if (object.name !== undefined) {
      updateData.name = object.name || null;
    }
    if (object.summary !== undefined) {
      updateData.description = object.summary || null;
    }
    if (object.icon && typeof object.icon === "object" && object.icon.url) {
      updateData.avatarUrl = object.icon.url;
    } else if (object.icon && typeof object.icon === "string") {
      updateData.avatarUrl = object.icon;
    }
    if (object.image && typeof object.image === "object" && object.image.url) {
      updateData.bannerUrl = object.image.url;
    } else if (object.image && typeof object.image === "string") {
      updateData.bannerUrl = object.image;
    }
    if (object.publicKey && object.publicKey.publicKeyPem) {
      updateData.publicKey = object.publicKey.publicKeyPem;
    }

    if (Object.keys(updateData).length > 0) {
      const userRepository = this.getUserRepository(c);
      await userRepository.update(remoteActor.id, updateData);
      this.log(
        "✅",
        `Profile updated: ${remoteActor.username}@${remoteActor.host} ${JSON.stringify(Object.keys(updateData))}`,
      );
      return this.success(`Profile updated: ${Object.keys(updateData).join(", ")}`);
    }

    this.log("ℹ️", `No profile fields to update for ${remoteActor.username}@${remoteActor.host}`);
    return this.success("No profile fields to update");
  }

  /**
   * Handle Note update (note edit)
   */
  private async handleNoteUpdate(object: any, remoteActor: any, c: any): Promise<HandlerResult> {
    const noteUri = object.id;

    if (!noteUri) {
      this.warn("Invalid Update Note: missing object id");
      return this.failure("Invalid Update Note: missing object id");
    }

    this.log("📥", `Update Note: ${remoteActor.username}@${remoteActor.host} → ${noteUri}`);

    const noteRepository = this.getNoteRepository(c);
    const note = await noteRepository.findByUri(noteUri);

    if (!note) {
      this.warn(`Note not found: ${noteUri}`);
      return this.failure(`Note not found: ${noteUri}`);
    }

    // Verify the actor owns the note
    if (note.userId !== remoteActor.id) {
      this.warn(`Actor ${remoteActor.id} does not own note ${note.id}`);
      return this.failure("Cannot update note owned by another user");
    }

    // Extract note fields
    const updateData: Record<string, any> = {};

    if (object.content !== undefined) {
      updateData.text = object.content || "";
    }
    if (object.summary !== undefined) {
      updateData.cw = object.summary || null;
    }

    if (Object.keys(updateData).length > 0) {
      await noteRepository.update(note.id, updateData);
      this.log("✅", `Note updated: ${note.id} ${JSON.stringify(Object.keys(updateData))}`);
      return this.success(`Note updated: ${note.id}`);
    }

    this.log("ℹ️", `No note fields to update for ${note.id}`);
    return this.success("No note fields to update");
  }
}
