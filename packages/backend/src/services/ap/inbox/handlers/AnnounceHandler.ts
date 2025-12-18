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
import { RemoteFetchService, type SignatureConfig } from "../../RemoteFetchService.js";
import { logger } from "../../../../lib/logger.js";

/**
 * Handler for Announce activities
 *
 * Creates renotes/boosts of existing notes.
 * Will fetch remote notes if not already in local database.
 */
export class AnnounceHandler extends BaseHandler {
  readonly activityType = "Announce";

  /**
   * Get signature configuration for authenticated fetches
   * Uses a local admin user's credentials for signing requests
   */
  private async getSignatureConfig(
    c: import("hono").Context,
    baseUrl: string,
  ): Promise<SignatureConfig | null> {
    try {
      const userRepository = this.getUserRepository(c);

      // Find a local admin user with a private key
      const adminUser = await userRepository.findFirstLocalAdmin();

      if (!adminUser || !adminUser.privateKey) {
        logger.warn("No admin user with private key found for signed fetch");
        return null;
      }

      const keyId = `${baseUrl}/users/${adminUser.username}#main-key`;

      return {
        keyId,
        privateKey: adminUser.privateKey,
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to get signature config");
      return null;
    }
  }

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

        // Try unsigned fetch first
        let result = await fetchService.fetchActivityPubObject(objectUri);

        // If failed with 401/403/404, try with HTTP Signature (Authorized Fetch)
        if (
          !result.success &&
          result.error?.statusCode &&
          [401, 403, 404].includes(result.error.statusCode)
        ) {
          logger.debug(
            { noteUri: objectUri, statusCode: result.error.statusCode },
            "Unsigned fetch failed, retrying with HTTP Signature",
          );

          // Get a local user's credentials for signing
          const signatureConfig = await this.getSignatureConfig(c, context.baseUrl);

          if (signatureConfig) {
            result = await fetchService.fetchActivityPubObject(objectUri, {
              signature: signatureConfig,
            });
          }
        }

        if (!result.success) {
          // 404 errors are common (deleted notes) - log at debug level
          // Other errors (network issues, auth failures) are logged at warn level
          const is404 = result.error?.statusCode === 404;
          const logLevel = is404 ? "debug" : "warn";
          logger[logLevel](
            { noteUri: objectUri, err: result.error },
            is404 ? "Remote note not found (possibly deleted)" : "Failed to fetch remote note",
          );
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
        // Counters use database defaults
      });

      // Increment renote count on target note
      await noteRepository.incrementRenoteCount(targetNote.id);

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
