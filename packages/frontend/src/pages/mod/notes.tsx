'use client';

/**
 * Moderator Notes Page
 *
 * Allows moderators to view and manage deleted notes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  RefreshCw,
  FileText,
  Trash2,
  RotateCcw,
  User,
  AlertTriangle,
} from 'lucide-react';
import { tokenAtom } from '../../lib/atoms/auth';
import { apiClient } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { InlineError } from '../../components/ui/ErrorMessage';
import { addToastAtom } from '../../lib/atoms/toast';
import { Layout } from '../../components/layout/Layout';
import { ModeratorNav } from '../../components/moderator/ModeratorNav';

interface DeletedNote {
  id: string;
  userId: string;
  text: string | null;
  cw: string | null;
  visibility: string;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedById: string | null;
  deletionReason: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    host: string | null;
  };
}

interface DeletedNotesResponse {
  notes: DeletedNote[];
  total: number;
}

export default function ModeratorNotesPage() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [notes, setNotes] = useState<DeletedNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const loadDeletedNotes = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<DeletedNotesResponse>('/api/mod/notes/deleted');
      setNotes(response.notes);
    } catch (err) {
      console.error('Failed to load deleted notes:', err);
      setError('Failed to load deleted notes');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!token) {
        window.location.href = '/login';
        return;
      }

      try {
        apiClient.setToken(token);
        await loadDeletedNotes();
      } catch (err: any) {
        console.error('Access check failed:', err);
        if (err.status === 403) {
          setError('Moderator access required');
        } else {
          setError('Access denied');
        }
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadDeletedNotes]);

  const handleRestore = async (noteId: string) => {
    if (!token) return;

    setIsRestoring(noteId);
    try {
      apiClient.setToken(token);
      await apiClient.post(`/api/mod/notes/${noteId}/restore`, {});

      addToast({
        type: 'success',
        message: t`Note restored successfully`,
      });

      await loadDeletedNotes();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || t`Failed to restore note`,
      });
    } finally {
      setIsRestoring(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <InlineError message={error} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-(--text-primary)">
            <Trans>Note Moderation</Trans>
          </h1>
          <p className="text-(--text-secondary) mt-2">
            <Trans>View and restore deleted notes</Trans>
          </p>
        </div>

        <ModeratorNav currentPath="/mod/notes" />

        <div className="grid grid-cols-1 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-(--text-primary)">{notes.length}</div>
                  <div className="text-sm text-(--text-muted)">
                    <Trans>Deleted Notes</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <Trans>Deleted Notes</Trans>
            </CardTitle>
            <Button variant="ghost" size="sm" onPress={loadDeletedNotes}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
                <p className="text-(--text-muted)">
                  <Trans>No deleted notes</Trans>
                </p>
                <p className="text-sm text-(--text-muted) mt-1">
                  <Trans>Notes deleted by moderators will appear here</Trans>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 rounded-lg border border-(--border-color) bg-(--bg-primary)"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* User info */}
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-(--text-muted)" />
                          {note.user ? (
                            <a
                              href={`/@${note.user.username}${note.user.host ? `@${note.user.host}` : ''}`}
                              className="text-sm text-(--text-primary) hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {note.user.displayName || note.user.username}
                              <span className="text-(--text-muted)">
                                @{note.user.username}
                                {note.user.host && `@${note.user.host}`}
                              </span>
                            </a>
                          ) : (
                            <span className="text-sm text-(--text-muted)">
                              <Trans>Unknown User</Trans>
                            </span>
                          )}
                        </div>

                        {/* Note content */}
                        {note.cw && (
                          <div className="mb-2 px-3 py-2 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm">
                            <AlertTriangle className="w-4 h-4 inline mr-1" />
                            CW: {note.cw}
                          </div>
                        )}
                        <div className="p-3 rounded-lg bg-(--bg-secondary) border border-(--border-color)">
                          <p className="text-(--text-primary) whitespace-pre-wrap break-words">
                            {note.text || (
                              <span className="text-(--text-muted) italic">
                                <Trans>No text content</Trans>
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Deletion info */}
                        <div className="mt-3 text-xs text-(--text-muted) space-y-1">
                          <p>
                            <Trans>Created: {formatDate(note.createdAt)}</Trans>
                          </p>
                          <p>
                            <Trans>Deleted: {formatDate(note.deletedAt)}</Trans>
                          </p>
                          {note.deletionReason && (
                            <p className="text-red-600 dark:text-red-400">
                              <Trans>Reason: {note.deletionReason}</Trans>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Restore button */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => handleRestore(note.id)}
                        isDisabled={isRestoring === note.id}
                      >
                        {isRestoring === note.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4 mr-1" />
                            <Trans>Restore</Trans>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
