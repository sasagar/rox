/**
 * Deck state management atoms
 *
 * Manages deck profiles, active profile, and deck mode settings.
 */
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { DeckProfile, DeckColumn } from "../types/deck";

// Re-export deckEnabledAtom from uiSettings for convenience
// This atom is synced with server settings via UISettings
export { deckEnabledAtom } from "./uiSettings";

/**
 * All deck profiles for the current user
 */
export const deckProfilesAtom = atom<DeckProfile[]>([]);

/**
 * Loading state for deck profiles
 */
export const deckProfilesLoadingAtom = atom<boolean>(false);

/**
 * Error state for deck profiles
 */
export const deckProfilesErrorAtom = atom<string | null>(null);

/**
 * ID of the currently active deck profile.
 * Stored in localStorage for persistence across sessions.
 */
export const activeDeckProfileIdAtom = atomWithStorage<string | null>(
  "rox_active_deck_profile_id",
  null,
  undefined,
  { getOnInit: true }
);

/**
 * Derived atom: Currently active deck profile
 */
export const activeDeckProfileAtom = atom((get) => {
  const profiles = get(deckProfilesAtom);
  const activeId = get(activeDeckProfileIdAtom);

  if (activeId) {
    const profile = profiles.find((p) => p.id === activeId);
    if (profile) return profile;
  }

  // Fall back to default profile or first profile
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
});

/**
 * Derived atom: Columns in the active deck profile
 */
export const activeDeckColumnsAtom = atom((get) => {
  const profile = get(activeDeckProfileAtom);
  return profile?.columns ?? [];
});

/**
 * Action atom: Set active profile by ID
 */
export const setActiveDeckProfileAtom = atom(
  null,
  (get, set, profileId: string) => {
    const profiles = get(deckProfilesAtom);
    if (profiles.some((p) => p.id === profileId)) {
      set(activeDeckProfileIdAtom, profileId);
    }
  }
);

/**
 * Action atom: Add a new profile to the list
 */
export const addDeckProfileAtom = atom(
  null,
  (get, set, profile: DeckProfile) => {
    const profiles = get(deckProfilesAtom);
    set(deckProfilesAtom, [...profiles, profile]);
  }
);

/**
 * Action atom: Update an existing profile
 */
export const updateDeckProfileAtom = atom(
  null,
  (get, set, updatedProfile: DeckProfile) => {
    const profiles = get(deckProfilesAtom);
    set(
      deckProfilesAtom,
      profiles.map((p) => (p.id === updatedProfile.id ? updatedProfile : p))
    );
  }
);

/**
 * Action atom: Remove a profile by ID
 */
export const removeDeckProfileAtom = atom(
  null,
  (get, set, profileId: string) => {
    const profiles = get(deckProfilesAtom);
    const activeId = get(activeDeckProfileIdAtom);

    set(
      deckProfilesAtom,
      profiles.filter((p) => p.id !== profileId)
    );

    // If we removed the active profile, clear the selection
    if (activeId === profileId) {
      set(activeDeckProfileIdAtom, null);
    }
  }
);

/**
 * Action atom: Update columns in the active profile
 */
export const updateActiveDeckColumnsAtom = atom(
  null,
  (get, set, columns: DeckColumn[]) => {
    const profile = get(activeDeckProfileAtom);
    if (!profile) return;

    const updatedProfile: DeckProfile = {
      ...profile,
      columns,
      updatedAt: new Date().toISOString(),
    };

    set(updateDeckProfileAtom, updatedProfile);
  }
);

/**
 * Action atom: Add a column to the active profile
 */
export const addDeckColumnAtom = atom(null, (get, set, column: DeckColumn) => {
  const columns = get(activeDeckColumnsAtom);
  set(updateActiveDeckColumnsAtom, [...columns, column]);
});

/**
 * Action atom: Remove a column from the active profile by ID
 */
export const removeDeckColumnAtom = atom(
  null,
  (get, set, columnId: string) => {
    const columns = get(activeDeckColumnsAtom);
    set(
      updateActiveDeckColumnsAtom,
      columns.filter((c: DeckColumn) => c.id !== columnId)
    );
  }
);

/**
 * Action atom: Update a specific column in the active profile
 */
export const updateDeckColumnAtom = atom(
  null,
  (get, set, columnId: string, updates: Partial<DeckColumn>) => {
    const columns = get(activeDeckColumnsAtom);
    set(
      updateActiveDeckColumnsAtom,
      columns.map((c: DeckColumn) =>
        c.id === columnId ? { ...c, ...updates } : c
      )
    );
  }
);

/**
 * Action atom: Reorder columns in the active profile
 */
export const reorderDeckColumnsAtom = atom(
  null,
  (get, set, fromIndex: number, toIndex: number) => {
    const columns = [...get(activeDeckColumnsAtom)];
    const [removed] = columns.splice(fromIndex, 1);
    if (removed) {
      columns.splice(toIndex, 0, removed);
      set(updateActiveDeckColumnsAtom, columns);
    }
  }
);

/**
 * Mobile: Currently visible column index for swipe navigation
 */
export const mobileActiveColumnIndexAtom = atom<number>(0);

/**
 * Action atom: Navigate to specific column on mobile
 */
export const setMobileActiveColumnAtom = atom(
  null,
  (get, set, index: number) => {
    const columns = get(activeDeckColumnsAtom);
    if (index >= 0 && index < columns.length) {
      set(mobileActiveColumnIndexAtom, index);
    }
  }
);
