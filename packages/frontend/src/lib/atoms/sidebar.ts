/**
 * Sidebar state atoms
 *
 * Manages sidebar collapsed state globally for layout coordination.
 * Uses atomWithStorage with getOnInit to prevent flash on page load.
 */

import { atomWithStorage, createJSONStorage } from "jotai/utils";

const SIDEBAR_COLLAPSED_KEY = "rox_sidebar_collapsed";

/**
 * Custom storage that reads synchronously on init to prevent flash
 * Falls back to a no-op storage during SSR when localStorage is not available
 */
const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

const storage = createJSONStorage<boolean>(() =>
  typeof window !== "undefined" ? localStorage : noopStorage
);

/**
 * Sidebar collapsed state atom with localStorage persistence
 * getOnInit: true ensures the value is read synchronously during initialization,
 * preventing the flash where sidebar briefly shows expanded then collapses
 */
export const sidebarCollapsedAtom = atomWithStorage<boolean>(
  SIDEBAR_COLLAPSED_KEY,
  false,
  storage,
  { getOnInit: true }
);

/**
 * Alias for backward compatibility
 * The atom now handles persistence automatically
 */
export const sidebarCollapsedWithPersistenceAtom = sidebarCollapsedAtom;
