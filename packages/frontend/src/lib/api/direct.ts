/**
 * Direct Messages API client
 *
 * Provides methods for retrieving direct messages (DMs) for the current user.
 */

import { apiClient } from "./client";
import type { Note, TimelineOptions } from "../types/note";

/**
 * Conversation partner information
 */
export interface ConversationPartner {
  partnerId: string;
  partnerUsername: string;
  partnerDisplayName: string | null;
  partnerAvatarUrl: string | null;
  partnerHost: string | null;
  partnerProfileEmojis: Array<{ name: string; url: string }> | null;
  lastNoteId: string;
  lastNoteText: string | null;
  lastNoteCreatedAt: string;
}

/**
 * Direct Messages API operations
 */
export const directApi = {
  /**
   * Get list of conversation partners
   *
   * Returns users the current user has DM conversations with,
   * along with the most recent message from each conversation.
   *
   * @param limit - Maximum number of conversations to return
   * @returns Array of conversation partners
   */
  async getConversations(limit = 20): Promise<ConversationPartner[]> {
    const params = new URLSearchParams();
    params.set("limit", limit.toString());

    return apiClient.get<ConversationPartner[]>(`/api/direct/conversations?${params.toString()}`);
  },

  /**
   * Get all direct messages for the current user
   *
   * @param options - Timeline options for pagination
   * @returns Array of direct message notes
   */
  async getMessages(options: TimelineOptions = {}): Promise<Note[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.sinceId) params.set("sinceId", options.sinceId);
    if (options.untilId) params.set("untilId", options.untilId);

    const query = params.toString();
    return apiClient.get<Note[]>(`/api/direct/messages${query ? `?${query}` : ""}`);
  },

  /**
   * Get DM thread with a specific user
   *
   * @param partnerId - User ID of the conversation partner
   * @param options - Timeline options for pagination
   * @returns Array of messages in the thread
   */
  async getThread(partnerId: string, options: TimelineOptions = {}): Promise<Note[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.sinceId) params.set("sinceId", options.sinceId);
    if (options.untilId) params.set("untilId", options.untilId);

    const query = params.toString();
    return apiClient.get<Note[]>(`/api/direct/thread/${partnerId}${query ? `?${query}` : ""}`);
  },
};
