/**
 * Announce Activity Handler
 *
 * Processes Announce activities (boosts/reblogs/renotes).
 *
 * @module services/ap/inbox/handlers/AnnounceHandler
 */

import type { Activity, HandlerContext, HandlerResult } from "../types.js";
import { getObjectUri } from "../types.js";
import { BaseHandler } from "./BaseHandler.js";
import { RemoteFetchService } from "../../RemoteFetchService.js";

/**
 * Handler for Announce activities
 *
 * Creates renotes/boosts of existing notes.
 * Will fetch remote notes if not already in local database.
 */
export class AnnounceHandler extends BaseHandler {
  readonly activityType = "Announce";

  async handle(activity: Activity, context: HandlerContext): Promise<HandlerResult> {
    const { c } = context;

    try {
      const objectUri = getObjectUri(activity.object);

      if (!objectUri) {
        this.warn("Invalid Announce activity: missing object");
        return this.failure("Invalid Announce activity: missing object");
      }

      this.log("📥", `Announce: ${activity.actor} → ${objectUri}`);

      // Resolve remote actor
      const actorUri = this.getActorUri(activity);
      const remoteActor = await this.resolveActor(actorUri, c);

      // Find or fetch the note being announced
      const noteRepository = this.getNoteRepository(c);
      const remoteNoteService = this.getRemoteNoteService(c);
      let targetNote = await noteRepository.findByUri(objectUri);

      // If note doesn't exist locally, fetch it from remote
      if (!targetNote) {
        this.log("ℹ️", `Target note not found locally, fetching: ${objectUri}`);

        const fetchService = new RemoteFetchService();

        // Fetch the remote note object with retry logic
        const result = await fetchService.fetchActivityPubObject(objectUri);

        if (!result.success) {
          this.warn(`Failed to fetch remote note: ${objectUri} - ${result.error}`);
          return this.failure(`Failed to fetch remote note: ${objectUri}`);
        }

        const noteObject = result.data as any;
        targetNote = await remoteNoteService.processNote(noteObject);
      }

      // Create a renote (quote without text = pure boost)
      const id = this.generateId();
      await noteRepository.create({
        id,
        userId: remoteActor.id,
        text: null, // No text = pure boost
        cw: null,
        visibility: "public",
        localOnly: false,
        replyId: null,
        renoteId: targetNote.id,
        fileIds: [],
        mentions: [],
        emojis: [],
        tags: [],
        uri: activity.id ?? null, // Use the Announce activity ID as the note URI
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      });

      this.log(
        "✅",
        `Renote created: ${remoteActor.username}@${remoteActor.host} announced note ${targetNote.id}`,
      );
      return this.success(`Renote created for note ${targetNote.id}`);
    } catch (error) {
      this.error("Failed to handle Announce activity:", error as Error);
      return this.failure("Failed to handle Announce activity", error as Error);
    }
  }
}
