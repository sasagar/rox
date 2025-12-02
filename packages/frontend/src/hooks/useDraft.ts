import { useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { NoteVisibility } from "../lib/api/notes";

/**
 * Draft data structure
 */
export interface DraftData {
  id: string;
  text: string;
  cw: string;
  showCw: boolean;
  visibility: NoteVisibility;
  timestamp: number;
  title?: string;
}

/**
 * Generate a unique ID for drafts
 */
function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Atom for storing multiple drafts in localStorage
 */
const draftsAtom = atomWithStorage<DraftData[]>("note-composer-drafts", []);

/**
 * Atom for current working draft (auto-save target)
 */
const currentDraftIdAtom = atomWithStorage<string | null>("note-composer-current-draft-id", null);

/**
 * Maximum number of drafts to keep
 */
const MAX_DRAFTS = 10;

/**
 * Hook for managing note composer drafts
 *
 * Features:
 * - Save multiple drafts to localStorage
 * - Load draft on mount
 * - Clear draft when note is posted
 * - Manual save with custom title
 *
 * @returns Draft management functions
 */
export function useDraft() {
  const [drafts, setDrafts] = useAtom(draftsAtom);
  const [currentDraftId, setCurrentDraftId] = useAtom(currentDraftIdAtom);

  /**
   * Get current working draft
   */
  const currentDraft = drafts.find((d) => d.id === currentDraftId) || null;

  /**
   * Save or update current working draft (for auto-save)
   */
  const saveDraft = useCallback(
    (data: Omit<DraftData, "id" | "timestamp" | "title">) => {
      // Only save if there's actual content
      if (!data.text.trim() && !data.cw.trim()) {
        // If current draft exists and is now empty, remove it
        if (currentDraftId) {
          setDrafts((prev) => prev.filter((d) => d.id !== currentDraftId));
          setCurrentDraftId(null);
        }
        return;
      }

      setDrafts((prev) => {
        if (currentDraftId) {
          // Update existing draft
          return prev.map((d) =>
            d.id === currentDraftId
              ? { ...d, ...data, timestamp: Date.now() }
              : d
          );
        } else {
          // Create new draft
          const newId = generateDraftId();
          setCurrentDraftId(newId);
          const newDraft: DraftData = {
            ...data,
            id: newId,
            timestamp: Date.now(),
          };
          // Keep only MAX_DRAFTS
          const updated = [newDraft, ...prev].slice(0, MAX_DRAFTS);
          return updated;
        }
      });
    },
    [currentDraftId, setDrafts, setCurrentDraftId],
  );

  /**
   * Save as new draft with optional title (manual save)
   */
  const saveAsNewDraft = useCallback(
    (data: Omit<DraftData, "id" | "timestamp">, title?: string) => {
      if (!data.text.trim() && !data.cw.trim()) {
        return null;
      }

      const newId = generateDraftId();
      const newDraft: DraftData = {
        ...data,
        id: newId,
        timestamp: Date.now(),
        title: title || `Draft ${new Date().toLocaleString()}`,
      };

      setDrafts((prev) => {
        // Remove current working draft if it exists
        const filtered = currentDraftId
          ? prev.filter((d) => d.id !== currentDraftId)
          : prev;
        // Add new draft at the beginning
        const updated = [newDraft, ...filtered].slice(0, MAX_DRAFTS);
        return updated;
      });

      // Set new draft as current
      setCurrentDraftId(newId);
      return newId;
    },
    [currentDraftId, setDrafts, setCurrentDraftId],
  );

  /**
   * Load a specific draft by ID
   */
  const loadDraftById = useCallback(
    (id: string): DraftData | null => {
      const draft = drafts.find((d) => d.id === id);
      if (draft) {
        setCurrentDraftId(id);
      }
      return draft || null;
    },
    [drafts, setCurrentDraftId],
  );

  /**
   * Load current working draft
   */
  const loadDraft = useCallback(() => {
    return currentDraft;
  }, [currentDraft]);

  /**
   * Clear current draft from localStorage
   */
  const clearDraft = useCallback(() => {
    if (currentDraftId) {
      setDrafts((prev) => prev.filter((d) => d.id !== currentDraftId));
    }
    setCurrentDraftId(null);
  }, [currentDraftId, setDrafts, setCurrentDraftId]);

  /**
   * Delete a specific draft by ID
   */
  const deleteDraft = useCallback(
    (id: string) => {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      if (currentDraftId === id) {
        setCurrentDraftId(null);
      }
    },
    [currentDraftId, setDrafts, setCurrentDraftId],
  );

  /**
   * Start a new draft (clear current selection)
   */
  const startNewDraft = useCallback(() => {
    setCurrentDraftId(null);
  }, [setCurrentDraftId]);

  /**
   * Check if there's a draft available
   */
  const hasDraft =
    currentDraft !== null &&
    (currentDraft.text.trim() !== "" || currentDraft.cw.trim() !== "");

  return {
    saveDraft,
    saveAsNewDraft,
    loadDraft,
    loadDraftById,
    clearDraft,
    deleteDraft,
    startNewDraft,
    hasDraft,
    draft: currentDraft,
    drafts,
    currentDraftId,
  };
}

/**
 * Hook for auto-saving drafts with debounce
 *
 * @param data - Draft data to save
 * @param delay - Debounce delay in milliseconds
 */
export function useAutosaveDraft(data: Omit<DraftData, "id" | "timestamp" | "title">, delay = 1000) {
  const { saveDraft } = useDraft();

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(data);
    }, delay);

    return () => clearTimeout(timer);
  }, [data.text, data.cw, data.showCw, data.visibility, delay, saveDraft]);
}
