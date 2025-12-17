/**
 * Column state management atoms using atomFamily
 *
 * Each column has its own isolated state identified by columnId.
 * This allows multiple columns of the same type to coexist with independent data.
 */
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { Note } from "../types/note";
import type { Notification } from "../types/notification";

/**
 * Column state for timeline-like columns (timeline, mentions, list)
 */
export interface ColumnNotesState {
  notes: Note[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor: string | null;
}

/**
 * Column state for notification columns
 */
export interface ColumnNotificationsState {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor: string | null;
}

/**
 * Default state for notes-based columns
 */
const defaultNotesState: ColumnNotesState = {
  notes: [],
  loading: false,
  error: null,
  hasMore: true,
  cursor: null,
};

/**
 * Default state for notification columns
 */
const defaultNotificationsState: ColumnNotificationsState = {
  notifications: [],
  loading: false,
  error: null,
  hasMore: true,
  cursor: null,
};

// ============================================
// Base atom families for column state
// ============================================

/**
 * Atom family for column notes state.
 * Each column has its own independent state.
 * The columnId parameter is used by atomFamily to create unique atoms per column.
 */
export const columnNotesStateAtomFamily = atomFamily((_columnId: string) =>
  atom<ColumnNotesState>({ ...defaultNotesState })
);

/**
 * Atom family for column notifications state.
 */
export const columnNotificationsStateAtomFamily = atomFamily(
  (_columnId: string) =>
    atom<ColumnNotificationsState>({ ...defaultNotificationsState })
);

// ============================================
// Derived atoms for notes columns
// ============================================

/**
 * Derived atom family: Get notes for a column
 */
export const columnNotesAtomFamily = atomFamily((columnId: string) =>
  atom((get) => get(columnNotesStateAtomFamily(columnId)).notes)
);

/**
 * Derived atom family: Get loading state for a column
 */
export const columnLoadingAtomFamily = atomFamily((columnId: string) =>
  atom((get) => get(columnNotesStateAtomFamily(columnId)).loading)
);

/**
 * Derived atom family: Get error state for a column
 */
export const columnErrorAtomFamily = atomFamily((columnId: string) =>
  atom((get) => get(columnNotesStateAtomFamily(columnId)).error)
);

/**
 * Derived atom family: Get hasMore state for a column
 */
export const columnHasMoreAtomFamily = atomFamily((columnId: string) =>
  atom((get) => get(columnNotesStateAtomFamily(columnId)).hasMore)
);

/**
 * Derived atom family: Get cursor for a column
 */
export const columnCursorAtomFamily = atomFamily((columnId: string) =>
  atom((get) => get(columnNotesStateAtomFamily(columnId)).cursor)
);

// ============================================
// Action atoms for notes columns
// ============================================

/**
 * Action atom family: Set notes for a column
 */
export const setColumnNotesAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, notes: Note[]) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    set(columnNotesStateAtomFamily(columnId), { ...state, notes });
  })
);

/**
 * Action atom family: Append notes to a column (for pagination)
 */
export const appendColumnNotesAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, newNotes: Note[]) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    // Filter duplicates by ID
    const existingIds = new Set(state.notes.map((n) => n.id));
    const uniqueNewNotes = newNotes.filter((n) => !existingIds.has(n.id));
    set(columnNotesStateAtomFamily(columnId), {
      ...state,
      notes: [...state.notes, ...uniqueNewNotes],
    });
  })
);

/**
 * Action atom family: Prepend notes to a column (for new items)
 */
export const prependColumnNotesAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, newNotes: Note[]) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    // Filter duplicates by ID
    const existingIds = new Set(state.notes.map((n) => n.id));
    const uniqueNewNotes = newNotes.filter((n) => !existingIds.has(n.id));
    set(columnNotesStateAtomFamily(columnId), {
      ...state,
      notes: [...uniqueNewNotes, ...state.notes],
    });
  })
);

/**
 * Action atom family: Remove a note from a column
 */
export const removeColumnNoteAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, noteId: string) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    set(columnNotesStateAtomFamily(columnId), {
      ...state,
      notes: state.notes.filter((n) => n.id !== noteId),
    });
  })
);

/**
 * Action atom family: Set loading state for a column
 */
export const setColumnLoadingAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, loading: boolean) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    set(columnNotesStateAtomFamily(columnId), { ...state, loading });
  })
);

/**
 * Action atom family: Set error state for a column
 */
export const setColumnErrorAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, error: string | null) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    set(columnNotesStateAtomFamily(columnId), { ...state, error });
  })
);

/**
 * Action atom family: Set hasMore state for a column
 */
export const setColumnHasMoreAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, hasMore: boolean) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    set(columnNotesStateAtomFamily(columnId), { ...state, hasMore });
  })
);

/**
 * Action atom family: Set cursor for a column
 */
export const setColumnCursorAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, cursor: string | null) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    set(columnNotesStateAtomFamily(columnId), { ...state, cursor });
  })
);

/**
 * Action atom family: Update entire column state at once
 */
export const updateColumnStateAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, updates: Partial<ColumnNotesState>) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    set(columnNotesStateAtomFamily(columnId), { ...state, ...updates });
  })
);

/**
 * Action atom family: Reset column state to default
 */
export const resetColumnStateAtomFamily = atomFamily((columnId: string) =>
  atom(null, (_get, set) => {
    set(columnNotesStateAtomFamily(columnId), { ...defaultNotesState });
  })
);

/**
 * Action atom family: Update a note in the column (e.g., reactions update)
 */
export const updateColumnNoteAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, noteId: string, updates: Partial<Note>) => {
    const state = get(columnNotesStateAtomFamily(columnId));
    set(columnNotesStateAtomFamily(columnId), {
      ...state,
      notes: state.notes.map((n) =>
        n.id === noteId ? { ...n, ...updates } : n
      ),
    });
  })
);

// ============================================
// Derived atoms for notification columns
// ============================================

/**
 * Derived atom family: Get notifications for a column
 */
export const columnNotificationsAtomFamily = atomFamily((columnId: string) =>
  atom((get) => get(columnNotificationsStateAtomFamily(columnId)).notifications)
);

/**
 * Derived atom family: Get loading state for notification column
 */
export const columnNotificationsLoadingAtomFamily = atomFamily(
  (columnId: string) =>
    atom((get) => get(columnNotificationsStateAtomFamily(columnId)).loading)
);

/**
 * Derived atom family: Get error state for notification column
 */
export const columnNotificationsErrorAtomFamily = atomFamily(
  (columnId: string) =>
    atom((get) => get(columnNotificationsStateAtomFamily(columnId)).error)
);

// ============================================
// Action atoms for notification columns
// ============================================

/**
 * Action atom family: Set notifications for a column
 */
export const setColumnNotificationsAtomFamily = atomFamily((columnId: string) =>
  atom(null, (get, set, notifications: Notification[]) => {
    const state = get(columnNotificationsStateAtomFamily(columnId));
    set(columnNotificationsStateAtomFamily(columnId), {
      ...state,
      notifications,
    });
  })
);

/**
 * Action atom family: Append notifications to a column
 */
export const appendColumnNotificationsAtomFamily = atomFamily(
  (columnId: string) =>
    atom(null, (get, set, newNotifications: Notification[]) => {
      const state = get(columnNotificationsStateAtomFamily(columnId));
      const existingIds = new Set(state.notifications.map((n) => n.id));
      const uniqueNewNotifications = newNotifications.filter(
        (n) => !existingIds.has(n.id)
      );
      set(columnNotificationsStateAtomFamily(columnId), {
        ...state,
        notifications: [...state.notifications, ...uniqueNewNotifications],
      });
    })
);

/**
 * Action atom family: Prepend notifications to a column
 */
export const prependColumnNotificationsAtomFamily = atomFamily(
  (columnId: string) =>
    atom(null, (get, set, newNotifications: Notification[]) => {
      const state = get(columnNotificationsStateAtomFamily(columnId));
      const existingIds = new Set(state.notifications.map((n) => n.id));
      const uniqueNewNotifications = newNotifications.filter(
        (n) => !existingIds.has(n.id)
      );
      set(columnNotificationsStateAtomFamily(columnId), {
        ...state,
        notifications: [...uniqueNewNotifications, ...state.notifications],
      });
    })
);

/**
 * Action atom family: Update notification column state
 */
export const updateNotificationColumnStateAtomFamily = atomFamily(
  (columnId: string) =>
    atom(null, (get, set, updates: Partial<ColumnNotificationsState>) => {
      const state = get(columnNotificationsStateAtomFamily(columnId));
      set(columnNotificationsStateAtomFamily(columnId), {
        ...state,
        ...updates,
      });
    })
);

/**
 * Action atom family: Reset notification column state
 */
export const resetNotificationColumnStateAtomFamily = atomFamily(
  (columnId: string) =>
    atom(null, (_get, set) => {
      set(columnNotificationsStateAtomFamily(columnId), {
        ...defaultNotificationsState,
      });
    })
);
