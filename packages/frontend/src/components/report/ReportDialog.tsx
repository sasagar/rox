'use client';

/**
 * Report Dialog Component
 *
 * A modal dialog for reporting users or notes.
 */

import { useState } from 'react';
import { useAtom } from 'jotai';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { AlertTriangle, X } from 'lucide-react';
import { tokenAtom } from '../../lib/atoms/auth';
import { apiClient } from '../../lib/api/client';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { addToastAtom } from '../../lib/atoms/toast';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'user' | 'note';
  targetUserId?: string;
  targetNoteId?: string;
  targetUsername?: string;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'violence', label: 'Violence' },
  { value: 'nsfw', label: 'NSFW Content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'copyright', label: 'Copyright Violation' },
  { value: 'other', label: 'Other' },
] as const;

export function ReportDialog({
  isOpen,
  onClose,
  targetType,
  targetUserId,
  targetNoteId,
  targetUsername,
}: ReportDialogProps) {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [reason, setReason] = useState<string>('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!token || !reason) return;

    setIsSubmitting(true);
    try {
      apiClient.setToken(token);
      await apiClient.post('/api/reports', {
        targetUserId: targetUserId || undefined,
        targetNoteId: targetNoteId || undefined,
        reason,
        comment: comment.trim() || undefined,
      });

      addToast({
        type: 'success',
        message: t`Report submitted. Thank you for helping keep our community safe.`,
      });

      // Reset and close
      setReason('');
      setComment('');
      onClose();
    } catch (err: any) {
      if (err.message?.includes('already reported')) {
        addToast({
          type: 'error',
          message: t`You have already reported this`,
        });
      } else {
        addToast({
          type: 'error',
          message: err.message || t`Failed to submit report`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-(--bg-primary) rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-bold text-(--text-primary)">
                {targetType === 'user' ? (
                  <Trans>Report User</Trans>
                ) : (
                  <Trans>Report Note</Trans>
                )}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onPress={onClose}
              aria-label={t`Close`}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Target info */}
          {targetUsername && (
            <div className="mb-4 p-3 rounded-lg bg-(--bg-secondary) border border-(--border-color)">
              <p className="text-sm text-(--text-secondary)">
                <Trans>Reporting</Trans>:{' '}
                <span className="font-medium text-(--text-primary)">@{targetUsername}</span>
              </p>
            </div>
          )}

          {/* Reason selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-(--text-secondary) mb-2">
              <Trans>Reason</Trans> <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                    reason === r.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'border-(--border-color) bg-(--bg-primary) text-(--text-secondary) hover:bg-(--bg-secondary)'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Additional comment */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-(--text-secondary) mb-2">
              <Trans>Additional Details (optional)</Trans>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t`Provide more context about your report...`}
              className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-(--text-muted) mt-1">
              {comment.length}/1000
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onPress={onClose}
              className="flex-1"
              isDisabled={isSubmitting}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              variant="danger"
              onPress={handleSubmit}
              className="flex-1"
              isDisabled={isSubmitting || !reason}
            >
              {isSubmitting ? (
                <Spinner size="sm" />
              ) : (
                <Trans>Submit Report</Trans>
              )}
            </Button>
          </div>

          {/* Privacy note */}
          <p className="text-xs text-(--text-muted) mt-4 text-center">
            <Trans>
              Reports are reviewed by moderators. Your report will remain
              confidential.
            </Trans>
          </p>
        </div>
      </div>
    </div>
  );
}
