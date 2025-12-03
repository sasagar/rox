import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import type { User } from "../types/user";
import { apiClient } from "../api/client";

/**
 * Custom storage that handles SSR gracefully
 * Returns null on server, uses localStorage on client
 */
const createClientStorage = <T>() => {
  const storage = createJSONStorage<T>(() => {
    if (typeof window === "undefined") {
      // Return a dummy storage for SSR that does nothing
      return {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      };
    }
    return localStorage;
  });
  return storage;
};

/**
 * Authentication token atom with localStorage sync
 * Uses atomWithStorage for proper SSR hydration handling
 */
export const tokenAtom = atomWithStorage<string | null>(
  "token",
  null,
  createClientStorage<string | null>(),
  { getOnInit: true },
);

/**
 * Current user atom with localStorage sync
 * Uses atomWithStorage to persist user data across page navigations
 * This ensures sidebar and other user-dependent UI elements render correctly
 * even before the auth session is re-validated
 */
export const currentUserAtom = atomWithStorage<User | null>(
  "currentUser",
  null,
  createClientStorage<User | null>(),
  { getOnInit: true },
);

/**
 * Derived atom: is user authenticated?
 */
export const isAuthenticatedAtom = atom((get) => {
  return get(tokenAtom) !== null && get(currentUserAtom) !== null;
});

/**
 * Write-only atom for logout action
 * Calls API to invalidate session, then clears local state
 */
export const logoutAtom = atom(null, async (get, set) => {
  const token = get(tokenAtom);

  // Call logout API to invalidate session on server
  if (token) {
    try {
      apiClient.setToken(token);
      await apiClient.delete("/api/auth/session");
    } catch (error) {
      // Even if API call fails, we still want to clear local state
      console.error("Logout API call failed:", error);
    }
  }

  // Clear local state
  set(tokenAtom, null);
  set(currentUserAtom, null);

  // Clear API client token
  apiClient.setToken(null);

  // Redirect to login page
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
});
