"use client";

/**
 * Deck profile management hook
 *
 * Provides hooks for loading, creating, updating, and deleting deck profiles.
 * Syncs local state with server-side storage.
 *
 * @module hooks/useDeckProfiles
 */

import { useEffect, useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { isAuthenticatedAtom } from "../lib/atoms/auth";
import {
  deckProfilesAtom,
  deckProfilesLoadingAtom,
  deckProfilesErrorAtom,
  activeDeckProfileIdAtom,
  activeDeckProfileAtom,
  updateDeckProfileAtom,
  addDeckProfileAtom,
  removeDeckProfileAtom,
} from "../lib/atoms/deck";
import { deckApi } from "../lib/api/deck";
import type {
  DeckProfile,
  CreateDeckProfileInput,
  UpdateDeckProfileInput,
  DeckColumn,
} from "../lib/types/deck";

/**
 * Hook to manage deck profiles with server sync
 */
export function useDeckProfiles() {
  const [profiles, setProfiles] = useAtom(deckProfilesAtom);
  const [loading, setLoading] = useAtom(deckProfilesLoadingAtom);
  const [error, setError] = useAtom(deckProfilesErrorAtom);
  const activeProfile = useAtomValue(activeDeckProfileAtom);
  const setActiveProfileId = useSetAtom(activeDeckProfileIdAtom);
  const updateLocalProfile = useSetAtom(updateDeckProfileAtom);
  const addLocalProfile = useSetAtom(addDeckProfileAtom);
  const removeLocalProfile = useSetAtom(removeDeckProfileAtom);

  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const hasLoadedRef = useRef(false);

  /**
   * Fetch all profiles from server
   */
  const fetchProfiles = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const serverProfiles = await deckApi.getProfiles();
      setProfiles(serverProfiles);

      // If no active profile selected, select default or first
      if (serverProfiles.length > 0) {
        const defaultProfile = serverProfiles.find((p) => p.isDefault);
        if (defaultProfile) {
          setActiveProfileId(defaultProfile.id);
        } else if (serverProfiles[0]) {
          setActiveProfileId(serverProfiles[0].id);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load profiles";
      setError(message);
      console.error("Failed to fetch deck profiles:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setProfiles, setLoading, setError, setActiveProfileId]);

  /**
   * Create a new profile
   */
  const createProfile = useCallback(
    async (input: CreateDeckProfileInput): Promise<DeckProfile | null> => {
      if (!isAuthenticated) return null;

      setError(null);

      try {
        const newProfile = await deckApi.createProfile(input);
        addLocalProfile(newProfile);

        // If it's the first profile or set as default, make it active
        if (newProfile.isDefault || profiles.length === 0) {
          setActiveProfileId(newProfile.id);
        }

        return newProfile;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create profile";
        setError(message);
        console.error("Failed to create deck profile:", err);
        return null;
      }
    },
    [isAuthenticated, profiles.length, addLocalProfile, setActiveProfileId, setError]
  );

  /**
   * Update an existing profile
   */
  const updateProfile = useCallback(
    async (
      profileId: string,
      input: UpdateDeckProfileInput
    ): Promise<DeckProfile | null> => {
      if (!isAuthenticated) return null;

      setError(null);

      try {
        const updatedProfile = await deckApi.updateProfile(profileId, input);
        updateLocalProfile(updatedProfile);
        return updatedProfile;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update profile";
        setError(message);
        console.error("Failed to update deck profile:", err);
        return null;
      }
    },
    [isAuthenticated, updateLocalProfile, setError]
  );

  /**
   * Delete a profile
   */
  const deleteProfile = useCallback(
    async (profileId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;

      // Don't allow deleting the last profile
      if (profiles.length <= 1) {
        setError("Cannot delete the last profile");
        return false;
      }

      setError(null);

      try {
        await deckApi.deleteProfile(profileId);
        removeLocalProfile(profileId);

        // If we deleted the active profile, the activeDeckProfileAtom will auto-select another
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete profile";
        setError(message);
        console.error("Failed to delete deck profile:", err);
        return false;
      }
    },
    [isAuthenticated, profiles.length, removeLocalProfile, setError]
  );

  /**
   * Update columns in the active profile and sync to server
   */
  const updateActiveColumns = useCallback(
    async (columns: DeckColumn[]): Promise<boolean> => {
      if (!activeProfile) return false;

      // Optimistic update
      const updatedProfile: DeckProfile = {
        ...activeProfile,
        columns,
        updatedAt: new Date().toISOString(),
      };
      updateLocalProfile(updatedProfile);

      // Sync to server
      try {
        await deckApi.updateProfile(activeProfile.id, { columns });
        return true;
      } catch (err) {
        // Revert on failure
        updateLocalProfile(activeProfile);
        console.error("Failed to sync columns to server:", err);
        return false;
      }
    },
    [activeProfile, updateLocalProfile]
  );

  /**
   * Set active profile by ID
   */
  const setActiveProfile = useCallback(
    (profileId: string) => {
      if (profiles.some((p) => p.id === profileId)) {
        setActiveProfileId(profileId);
      }
    },
    [profiles, setActiveProfileId]
  );

  // Load profiles on mount when authenticated
  useEffect(() => {
    if (isAuthenticated && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      fetchProfiles();
    }
  }, [isAuthenticated, fetchProfiles]);

  // Reset state on logout
  useEffect(() => {
    if (!isAuthenticated) {
      hasLoadedRef.current = false;
      setProfiles([]);
      setError(null);
    }
  }, [isAuthenticated, setProfiles, setError]);

  return {
    profiles,
    activeProfile,
    loading,
    error,
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    updateActiveColumns,
    setActiveProfile,
  };
}

/**
 * Lightweight hook to just get active profile columns
 */
export function useActiveProfileColumns() {
  const activeProfile = useAtomValue(activeDeckProfileAtom);
  return activeProfile?.columns ?? [];
}
