"use client";

/**
 * Plugin Install Dialog Component
 *
 * Dialog for installing new plugins from Git URL or local path.
 *
 * @module components/admin/plugins/PluginInstallDialog
 */

import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
  Heading,
  TextField,
  Label,
  Input,
  Button as AriaButton,
  Checkbox,
} from "react-aria-components";
import { X, Download, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "../../ui/Button";

interface PluginInstallDialogProps {
  trigger: React.ReactNode;
  onInstall: (source: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Dialog for installing plugins from Git URL or local path
 */
export function PluginInstallDialog({ trigger, onInstall }: PluginInstallDialogProps) {
  const { t } = useLingui();
  const [source, setSource] = useState("");
  const [force, setForce] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInstall = async (close: () => void) => {
    if (!source.trim()) {
      setError(t`Please enter a plugin source`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await onInstall(source.trim(), force);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          close();
          // Reset state
          setSource("");
          setForce(false);
          setSuccess(false);
        }, 1500);
      } else {
        setError(result.error || t`Installation failed`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Unknown error occurred`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSource("");
    setForce(false);
    setError(null);
    setSuccess(false);
  };

  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <Modal className="w-full max-w-md rounded-lg bg-(--card-bg) shadow-xl border border-(--border-color)">
          <AriaDialog className="p-6 outline-none">
            {({ close }) => (
              <>
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <Heading className="text-xl font-bold text-(--text-primary) flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    <Trans>Install Plugin</Trans>
                  </Heading>
                  <AriaButton
                    className="rounded-md p-1 text-(--text-muted) hover:bg-(--bg-tertiary) hover:text-(--text-primary) cursor-pointer"
                    onPress={() => {
                      close();
                      handleClose();
                    }}
                    aria-label={t`Close dialog`}
                  >
                    <X className="h-5 w-5" />
                  </AriaButton>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  {/* Success Message */}
                  {success && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <Trans>Plugin installed successfully! Restart required.</Trans>
                    </div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-5 h-5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Source Input */}
                  <TextField isDisabled={isLoading || success}>
                    <Label className="block text-sm font-medium text-(--text-secondary) mb-1">
                      <Trans>Plugin Source</Trans>
                    </Label>
                    <Input
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="https://github.com/user/plugin or ./local/path"
                      className="w-full px-3 py-2 rounded-lg border border-(--border-color) bg-(--bg-primary) text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="mt-1 text-xs text-(--text-muted)">
                      <Trans>
                        Enter a Git repository URL (GitHub, GitLab) or a local path to the plugin
                        directory.
                      </Trans>
                    </p>
                  </TextField>

                  {/* Force Reinstall Checkbox */}
                  <Checkbox
                    isSelected={force}
                    onChange={setForce}
                    isDisabled={isLoading || success}
                    className="group flex items-center gap-2 text-sm text-(--text-secondary)"
                  >
                    <div className="w-4 h-4 shrink-0 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 group-data-selected:bg-primary-600 group-data-selected:border-primary-600 flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white hidden group-data-selected:block"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <Trans>Force reinstall if already installed</Trans>
                  </Checkbox>
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onPress={() => {
                      close();
                      handleClose();
                    }}
                    isDisabled={isLoading}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button
                    variant="primary"
                    onPress={() => handleInstall(close)}
                    isDisabled={isLoading || success || !source.trim()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <Trans>Installing...</Trans>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        <Trans>Install</Trans>
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
