import { atom } from "jotai";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import type { User } from "../types/user";

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
