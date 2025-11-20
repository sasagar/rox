import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { User } from 'rox_shared';

/**
 * Authentication token atom (persisted in localStorage)
 */
export const tokenAtom = atomWithStorage<string | null>('token', null);

/**
 * Current user atom
 */
export const currentUserAtom = atom<User | null>(null);

/**
 * Derived atom: is user authenticated?
 */
export const isAuthenticatedAtom = atom((get) => {
  return get(tokenAtom) !== null && get(currentUserAtom) !== null;
});
