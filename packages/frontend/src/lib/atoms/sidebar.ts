/**
 * Sidebar state atoms
 *
 * Manages sidebar collapsed state globally for layout coordination.
 * Uses atomWithStorage for proper SSR/hydration handling.
 */

import { atomWithStorage } from "jotai/utils";

const SIDEBAR_COLLAPSED_KEY = "rox_sidebar_collapsed";

/**
 * Sidebar collapsed state atom with localStorage persistence
 * atomWithStorage handles SSR gracefully by using the default value
 * until hydration is complete, avoiding layout flicker
 */
export const sidebarCollapsedAtom = atomWithStorage<boolean>(SIDEBAR_COLLAPSED_KEY, false);

/**
 * Alias for backward compatibility
 * The atom now handles persistence automatically
 */
export const sidebarCollapsedWithPersistenceAtom = sidebarCollapsedAtom;
