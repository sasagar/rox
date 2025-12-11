"use client";

import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Layout } from "../layout/Layout";
import { PageHeader } from "../ui/PageHeader";
import { NoteCard } from "../note/NoteCard";
import { Spinner } from "../ui/Spinner";
import { InlineError } from "../ui/ErrorMessage";
import { notesApi } from "../../lib/api/notes";
import { useAtom } from "jotai";
import { addToastAtom } from "../../lib/atoms/toast";
import type { Note } from "../../lib/types/note";

/**
 * Note detail page client component
 *
 * Displays a note with its conversation thread:
 * - Ancestor notes (parent chain)
 * - The target note (highlighted)
 * - Descendant notes (replies)
 */
export function NoteDetailPageClient({ noteId }: { noteId: string }) {
  const [, addToast] = useAtom(addToastAtom);
  const [note, setNote] = useState<Note | null>(null);
  const [ancestors, setAncestors] = useState<Note[]>([]);
  const [descendants, setDescendants] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch the main note
        const fetchedNote = await notesApi.getNote(noteId);
        setNote(fetchedNote);

        // Fetch conversation thread
        const { ancestors: fetchedAncestors, descendants: fetchedDescendants } =
          await notesApi.getConversation(noteId);

        setAncestors(fetchedAncestors);
        setDescendants(fetchedDescendants);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t`Failed to load note`;
        setError(errorMessage);
        addToast({
          type: "error",
          message: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [noteId, addToast]);

  const handleNoteDeleted = () => {
    addToast({
      type: "success",
      message: t`Note deleted`,
    });
    // Redirect to timeline using standard navigation
    window.location.href = "/timeline";
  };

  const handleReplyCreated = async () => {
    // Refresh descendants when a new reply is created
    try {
      const { descendants: fetchedDescendants } = await notesApi.getConversation(noteId);
      setDescendants(fetchedDescendants);
    } catch (err) {
      console.error("Failed to refresh replies:", err);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error || !note || !note.user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <InlineError message={error || t`Note not found`} />
          <a href="/timeline" className="mt-4 inline-block text-primary-600 hover:underline">
            <Trans>Back to timeline</Trans>
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title={<Trans>Note</Trans>}
          backHref="/timeline"
          backLabel={<Trans>Back</Trans>}
        />

        {/* Ancestor notes (conversation context) */}
        {ancestors.length > 0 && (
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
              <Trans>Conversation thread</Trans>
            </div>
            {ancestors.map((ancestorNote) => (
              <div key={ancestorNote.id} className="border-b border-gray-100 dark:border-gray-700">
                <NoteCard note={ancestorNote} onNoteDeleted={handleNoteDeleted} />
              </div>
            ))}
          </div>
        )}

        {/* Main note (highlighted) */}
        <NoteCard
          note={note}
          onNoteDeleted={handleNoteDeleted}
          onReplyCreated={handleReplyCreated}
          showDetailedTimestamp
          isHighlighted
        />

        {/* Descendant notes (replies) */}
        {descendants.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <Trans>Replies ({descendants.length})</Trans>
            </div>
            {descendants.map((descendantNote) => (
              <div
                key={descendantNote.id}
                className="border-b border-gray-100 dark:border-gray-700"
              >
                <NoteCard
                  note={descendantNote}
                  onNoteDeleted={handleNoteDeleted}
                  onReplyCreated={handleReplyCreated}
                />
              </div>
            ))}
          </div>
        )}

        {/* No replies message */}
        {descendants.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            <Trans>No replies yet</Trans>
          </div>
        )}
      </div>
    </Layout>
  );
}
