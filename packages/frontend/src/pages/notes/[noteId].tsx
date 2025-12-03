import type { PageProps } from "waku/router";
import { NoteDetailPageClient } from "../../components/pages/NoteDetailPageClient";

/**
 * Note detail page (Server Component)
 * Renders the client component with dynamic routing configuration
 */
export default function NoteDetailPage({ noteId }: PageProps<"/notes/[noteId]">) {
  if (!noteId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Note not found</h1>
        </div>
      </div>
    );
  }

  return <NoteDetailPageClient noteId={noteId} />;
}

/**
 * Page configuration for Waku
 * Dynamic rendering for parameterized routes
 */
export const getConfig = async () => {
  return {
    render: "dynamic",
  } as const;
};
