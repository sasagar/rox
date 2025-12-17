/**
 * Deck API client
 *
 * Provides methods for deck profile management operations.
 * Supports server-side storage and sync of deck layouts.
 *
 * @module lib/api/deck
 */

import { apiClient } from "./client";
import type {
  DeckProfile,
  CreateDeckProfileInput,
  UpdateDeckProfileInput,
} from "shared";

export type { DeckProfile, CreateDeckProfileInput, UpdateDeckProfileInput };

/**
 * Deck API operations
 */
export const deckApi = {
  /**
   * Get all deck profiles for the current user
   *
   * @returns User's deck profiles
   */
  async getProfiles(): Promise<DeckProfile[]> {
    return apiClient.get<DeckProfile[]>("/api/deck/profiles");
  },

  /**
   * Get a specific deck profile
   *
   * @param profileId - Profile ID
   * @returns The deck profile
   */
  async getProfile(profileId: string): Promise<DeckProfile> {
    return apiClient.get<DeckProfile>(`/api/deck/profiles/${profileId}`);
  },

  /**
   * Create a new deck profile
   *
   * @param input - Profile creation data
   * @returns Created profile
   */
  async createProfile(input: CreateDeckProfileInput): Promise<DeckProfile> {
    return apiClient.post<DeckProfile>("/api/deck/profiles", input);
  },

  /**
   * Update an existing deck profile
   *
   * @param profileId - Profile ID to update
   * @param input - Profile update data
   * @returns Updated profile
   */
  async updateProfile(
    profileId: string,
    input: UpdateDeckProfileInput
  ): Promise<DeckProfile> {
    return apiClient.patch<DeckProfile>(`/api/deck/profiles/${profileId}`, input);
  },

  /**
   * Delete a deck profile
   *
   * @param profileId - Profile ID to delete
   * @returns Success status
   */
  async deleteProfile(profileId: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(
      `/api/deck/profiles/${profileId}`
    );
  },
};
