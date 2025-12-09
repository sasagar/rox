/**
 * Compose Modal State Atom
 *
 * Manages the state of the note composition modal,
 * primarily used for mobile devices where the composer
 * needs to be shown in a fullscreen modal.
 *
 * @module lib/atoms/compose
 */

import { atom } from "jotai";

/**
 * State for the compose modal
 */
export interface ComposeModalState {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Optional reply target note ID */
  replyId?: string;
  /** Optional initial text (for reply mentions) */
  initialText?: string;
}

/**
 * Atom for compose modal state
 */
export const composeModalAtom = atom<ComposeModalState>({
  isOpen: false,
  replyId: undefined,
  initialText: undefined,
});

/**
 * Atom to open the compose modal
 */
export const openComposeModalAtom = atom(
  null,
  (_get, set, payload?: { replyId?: string; initialText?: string }) => {
    set(composeModalAtom, {
      isOpen: true,
      replyId: payload?.replyId,
      initialText: payload?.initialText,
    });
  }
);

/**
 * Atom to close the compose modal
 */
export const closeComposeModalAtom = atom(null, (_get, set) => {
  set(composeModalAtom, {
    isOpen: false,
    replyId: undefined,
    initialText: undefined,
  });
});
