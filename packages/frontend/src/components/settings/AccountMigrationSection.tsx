'use client';

/**
 * Account Migration Section Component
 *
 * Allows users to manage account aliases and initiate account migration.
 * Supports both moving to a new account and importing followers from an old account.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  ArrowRightLeft,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { tokenAtom } from '../../lib/atoms/auth';
import { apiClient } from '../../lib/api/client';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { addToastAtom } from '../../lib/atoms/toast';
import { TextField } from '../ui/TextField';

interface MigrationStatus {
  aliases: string[];
  movedTo: string | null;
  movedAt: string | null;
  canMigrate: boolean;
  cooldownEndsAt: string | null;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  targetAccount?: {
    uri: string;
    username: string;
    host: string;
    hasReverseAlias: boolean;
  };
}

export function AccountMigrationSection() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newAliasUri, setNewAliasUri] = useState('');
  const [isAddingAlias, setIsAddingAlias] = useState(false);
  const [targetAccountUri, setTargetAccountUri] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  // Load migration status
  const loadStatus = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<MigrationStatus>('/api/i/migration');
      setStatus(response);
    } catch (err) {
      console.error('Failed to load migration status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleAddAlias = async () => {
    if (!token || !newAliasUri.trim()) return;

    setIsAddingAlias(true);
    try {
      apiClient.setToken(token);
      await apiClient.post('/api/i/migration/aliases', {
        uri: newAliasUri.trim(),
      });

      setNewAliasUri('');
      await loadStatus();
      addToast({
        type: 'success',
        message: t`Alias added successfully`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || t`Failed to add alias`,
      });
    } finally {
      setIsAddingAlias(false);
    }
  };

  const handleRemoveAlias = async (uri: string) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      await apiClient.delete('/api/i/migration/aliases', { uri });

      await loadStatus();
      addToast({
        type: 'success',
        message: t`Alias removed successfully`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || t`Failed to remove alias`,
      });
    }
  };

  const handleValidateTarget = async () => {
    if (!token || !targetAccountUri.trim()) return;

    setIsValidating(true);
    setValidation(null);
    try {
      apiClient.setToken(token);
      const result = await apiClient.post<ValidationResult>('/api/i/migration/validate', {
        targetUri: targetAccountUri.trim(),
      });

      setValidation(result);
    } catch (err: any) {
      setValidation({
        valid: false,
        error: err.message || t`Validation failed`,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleInitiateMigration = async () => {
    if (!token || !targetAccountUri.trim() || !validation?.valid) return;

    const confirmed = window.confirm(
      t`Are you sure you want to migrate your account? This action cannot be undone. Your followers will be notified and transferred to the new account.`
    );

    if (!confirmed) return;

    setIsMigrating(true);
    try {
      apiClient.setToken(token);
      await apiClient.post('/api/i/migration/initiate', {
        targetUri: targetAccountUri.trim(),
      });

      await loadStatus();
      setTargetAccountUri('');
      setValidation(null);
      addToast({
        type: 'success',
        message: t`Migration initiated successfully. Your followers will be transferred to the new account.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || t`Failed to initiate migration`,
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Already migrated
  if (status?.movedTo) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            <Trans>Account Migration</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  <Trans>Account has been migrated</Trans>
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  <Trans>This account was migrated to:</Trans>
                </p>
                <code className="block mt-2 text-sm bg-yellow-100 dark:bg-yellow-800/50 px-2 py-1 rounded">
                  {status.movedTo}
                </code>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  <Trans>Migrated on: {formatDate(status.movedAt)}</Trans>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5" />
          <Trans>Account Migration</Trans>
        </CardTitle>
        <Button variant="ghost" size="sm" onPress={loadStatus} aria-label={t`Refresh`}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-6">
        {/* Account Aliases Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            <Trans>Account Aliases</Trans>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <Trans>
              Add aliases to link this account with your accounts on other servers. This allows
              followers from those accounts to find you here.
            </Trans>
          </p>

          {/* Add alias form */}
          <div className="flex gap-2 mb-4">
            <TextField
              value={newAliasUri}
              onChange={setNewAliasUri}
              placeholder={t`https://example.com/users/username`}
              className="flex-1"
            />
            <Button onPress={handleAddAlias} isDisabled={isAddingAlias || !newAliasUri.trim()}>
              {isAddingAlias ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {/* Aliases list */}
          {status?.aliases && status.aliases.length > 0 ? (
            <div className="space-y-2">
              {status.aliases.map((alias) => (
                <div
                  key={alias}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <code className="text-sm text-gray-900 dark:text-gray-100 truncate">{alias}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => handleRemoveAlias(alias)}
                    aria-label={t`Remove alias`}
                    className="text-red-500 hover:text-red-700 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
              <Trans>No aliases configured</Trans>
            </p>
          )}
        </div>

        {/* Migration Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            <Trans>Move to a Different Account</Trans>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <Trans>
              Migrate your account to a new server. Your followers will be automatically transferred
              to the new account. This action is irreversible.
            </Trans>
          </p>

          {/* Cooldown warning */}
          {!status?.canMigrate && status?.cooldownEndsAt && (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <Trans>Migration cooldown active until {formatDate(status.cooldownEndsAt)}</Trans>
              </div>
            </div>
          )}

          {/* Migration form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Trans>Target Account URI</Trans>
              </label>
              <div className="flex gap-2">
                <TextField
                  value={targetAccountUri}
                  onChange={(val) => {
                    setTargetAccountUri(val);
                    setValidation(null);
                  }}
                  placeholder={t`https://newserver.com/users/newusername`}
                  className="flex-1"
                  isDisabled={!status?.canMigrate}
                />
                <Button
                  onPress={handleValidateTarget}
                  isDisabled={
                    isValidating || !targetAccountUri.trim() || !status?.canMigrate
                  }
                >
                  {isValidating ? (
                    <Spinner size="sm" />
                  ) : (
                    <Trans>Validate</Trans>
                  )}
                </Button>
              </div>
            </div>

            {/* Validation result */}
            {validation && (
              <div
                className={`rounded-lg p-3 ${
                  validation.valid
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {validation.valid ? (
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                  )}
                  <div className="flex-1">
                    {validation.valid ? (
                      <>
                        <p className="text-sm font-medium text-green-800">
                          <Trans>Target account is valid</Trans>
                        </p>
                        {validation.targetAccount && (
                          <p className="text-sm text-green-700 mt-1">
                            @{validation.targetAccount.username}@{validation.targetAccount.host}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-red-800">{validation.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Migration button */}
            <Button
              onPress={handleInitiateMigration}
              isDisabled={!validation?.valid || isMigrating || !status?.canMigrate}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {isMigrating ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  <Trans>Initiate Migration</Trans>
                </>
              )}
            </Button>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              <Trans>
                Before migrating, make sure to add this account as an alias on your target account.
              </Trans>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
