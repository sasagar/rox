import { atom } from "jotai";
import type { Note } from "../types/note";

/**
 * Timeline notes atom
 * Stores the current timeline notes
 */
export const timelineNotesAtom = atom<Note[]>([]);

/**
 * Timeline loading state atom
 */
export const timelineLoadingAtom = atom<boolean>(false);

/**
 * Timeline error atom
 */
export const timelineErrorAtom = atom<string | null>(null);

/**
 * Timeline has more items indicator
 * Used for infinite scroll pagination
 */
export const timelineHasMoreAtom = atom<boolean>(true);

/**
 * Timeline cursor/pagination atom
 * Stores the ID of the last note for pagination
 */
export const timelineCursorAtom = atom<string | null>(null);

/**
 * Derived atom: Get the last note ID for pagination
 */
export const timelineLastNoteIdAtom = atom((get) => {
  const notes = get(timelineNotesAtom);
  return notes.length > 0 ? (notes[notes.length - 1]?.id ?? null) : null;
});
