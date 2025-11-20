'use client';

import { Trans } from '@lingui/react/macro';
import { useAtom } from 'jotai';
import { Timeline } from '../components/timeline/Timeline';
import { NoteComposer } from '../components/note/NoteComposer';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { currentUserAtom } from '../lib/atoms/auth';
import { timelineNotesAtom } from '../lib/atoms/timeline';

/**
 * Home page component
 * Displays the note composer and local timeline of notes
 */
export default function HomePage() {
  const [currentUser] = useAtom(currentUserAtom);
  const [, setTimelineNotes] = useAtom(timelineNotesAtom);

  const handleNoteCreated = () => {
    // Refresh timeline by clearing current notes
    // Timeline component will automatically reload
    setTimelineNotes([]);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">
            <Trans>Timeline</Trans>
          </h1>
          <p className="mt-2 text-gray-600">
            <Trans>Recent posts from your community</Trans>
          </p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Note Composer (only shown when logged in) */}
      {currentUser && <NoteComposer onNoteCreated={handleNoteCreated} />}

      {/* Timeline */}
      <Timeline type="local" />
    </div>
  );
}
