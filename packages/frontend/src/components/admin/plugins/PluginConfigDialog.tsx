"use client";

/**
 * Plugin Config Dialog Component
 *
 * Dialog for viewing and editing plugin configuration.
 *
 * @module components/admin/plugins/PluginConfigDialog
 */

import { useState, useEffect } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Dialog as AriaDialog,
  Modal,
  ModalOverlay,
  Heading,
} from "react-aria-components";
import { X, Settings, Loader2, AlertTriangle, CheckCircle, Save } from "lucide-react";
import { Button } from "../../ui/Button";
import type { PluginConfig } from "../../../lib/api/plugins";

interface PluginConfigDialogProps {
  isOpen: boolean;
  pluginId: string;
  pluginName: string;
  onClose: () => void;
  onLoadConfig: (id: string) => Promise<PluginConfig>;
  onSaveConfig: (id: string, config: PluginConfig) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Dialog for viewing and editing plugin configuration
 */
export function PluginConfigDialog({
  isOpen,
  pluginId,
  pluginName,
  onClose,
  onLoadConfig,
  onSaveConfig,
}: PluginConfigDialogProps) {
  const { t } = useLingui();
  const [configText, setConfigText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Load config when dialog opens
  useEffect(() => {
    if (isOpen && pluginId) {
      setIsLoading(true);
      setError(null);
      setSuccess(false);
      onLoadConfig(pluginId)
        .then((loadedConfig) => {
          setConfigText(JSON.stringify(loadedConfig, null, 2));
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : t`Failed to load configuration`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, pluginId, onLoadConfig, t]);

  const handleConfigChange = (text: string) => {
    setConfigText(text);
    setParseError(null);
    try {
      JSON.parse(text);
    } catch {
      setParseError(t`Invalid JSON format`);
    }
  };

  const handleSave = async () => {
    setParseError(null);
    let parsedConfig: PluginConfig;
    try {
      parsedConfig = JSON.parse(configText);
    } catch {
      setParseError(t`Invalid JSON format`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await onSaveConfig(pluginId, parsedConfig);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
        }, 2000);
      } else {
        setError(result.error || t`Failed to save configuration`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Unknown error occurred`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setConfigText("");
    setError(null);
    setSuccess(false);
    setParseError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <Modal className="w-full max-w-lg rounded-lg bg-(--card-bg) shadow-xl border border-(--border-color)">
        <AriaDialog className="p-6 outline-none">
          <>
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <Heading className="text-xl font-bold text-(--text-primary) flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <Trans>Configure {pluginName}</Trans>
              </Heading>
              <button
                className="rounded-md p-1 text-(--text-muted) hover:bg-(--bg-tertiary) hover:text-(--text-primary) cursor-pointer"
                onClick={handleClose}
                aria-label={t`Close dialog`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-(--text-muted)" />
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <Trans>Configuration saved successfully!</Trans>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Config Editor */}
              {!isLoading && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                      <Trans>Configuration (JSON)</Trans>
                    </label>
                    <textarea
                      value={configText}
                      onChange={(e) => handleConfigChange(e.target.value)}
                      rows={12}
                      className={`w-full px-3 py-2 rounded-lg border bg-(--bg-primary) text-(--text-primary) font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        parseError
                          ? "border-red-500 focus:ring-red-500"
                          : "border-(--border-color)"
                      }`}
                      placeholder="{}"
                    />
                    {parseError && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{parseError}</p>
                    )}
                    <p className="mt-1 text-xs text-(--text-muted)">
                      <Trans>
                        Edit the plugin configuration in JSON format. Changes require a server
                        restart to take effect.
                      </Trans>
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onPress={handleClose} isDisabled={isSaving}>
                <Trans>Close</Trans>
              </Button>
              <Button
                variant="primary"
                onPress={handleSave}
                isDisabled={isLoading || isSaving || !!parseError}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <Trans>Saving...</Trans>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    <Trans>Save</Trans>
                  </>
                )}
              </Button>
            </div>
          </>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
