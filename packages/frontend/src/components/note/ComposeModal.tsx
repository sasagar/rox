"use client";

/**
 * Compose Modal Component
 *
 * A fullscreen modal for composing notes, primarily designed for mobile devices.
 * Opens when the user taps the compose button in the mobile app bar.
 *
 * @module components/note/ComposeModal
 */

import { useEffect, useCallback } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { X } from "lucide-react";
import { composeModalAtom, closeComposeModalAtom } from "../../lib/atoms/compose";
import { NoteComposer } from "./NoteComposer";

/**
 * Fullscreen compose modal component
 *
 * Provides a mobile-friendly note composition experience.
 * Uses React Aria's Modal for accessibility (focus trapping, escape key handling).
 */
export function ComposeModal() {
  const [modalState] = useAtom(composeModalAtom);
  const closeModal = useSetAtom(closeComposeModalAtom);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalState.isOpen) {
        closeModal();
      }
    },
    [modalState.isOpen, closeModal]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (modalState.isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalState.isOpen]);

  if (!modalState.isOpen) {
    return null;
  }

  const handleNoteCreated = () => {
    closeModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeModal();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-modal-title"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:mt-10 sm:rounded-lg bg-(--card-bg) shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--border-color)">
          <h2
            id="compose-modal-title"
            className="text-lg font-semibold text-(--text-primary)"
          >
            {modalState.initialVisibility === "specified" ? (
              <Trans>New Message</Trans>
            ) : (
              <Trans>New Note</Trans>
            )}
          </h2>
          <button
            onClick={() => closeModal()}
            className="p-2 -mr-2 rounded-full text-(--text-muted) hover:bg-(--hover-bg) hover:text-(--text-secondary) transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Composer */}
        <div className="flex-1 overflow-y-auto p-4">
          <NoteComposer
            onNoteCreated={handleNoteCreated}
            replyId={modalState.replyId}
            replyTo={modalState.initialText}
            initialVisibility={modalState.initialVisibility}
          />
        </div>
      </div>
    </div>
  );
}
