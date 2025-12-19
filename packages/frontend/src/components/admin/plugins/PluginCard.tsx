"use client";

/**
 * Plugin Card Component
 *
 * Displays plugin information with actions for enable/disable/uninstall.
 *
 * @module components/admin/plugins/PluginCard
 */

import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Power,
  PowerOff,
  Trash2,
  Settings,
  Package,
  Code,
  Palette,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "react-aria-components";
import type { PluginListEntry } from "shared";

interface PluginCardProps {
  plugin: PluginListEntry;
  onEnable: (id: string) => Promise<void>;
  onDisable: (id: string) => Promise<void>;
  onUninstall: (id: string) => Promise<void>;
  onConfigure: (id: string) => void;
}

/**
 * Card component for displaying plugin information
 */
export function PluginCard({
  plugin,
  onEnable,
  onDisable,
  onUninstall,
  onConfigure,
}: PluginCardProps) {
  const { t } = useLingui();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setIsLoading(true);
    setLoadingAction(action);
    try {
      await fn();
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-(--card-bg) border border-(--border-color) rounded-lg p-4 hover:border-primary-400 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-(--bg-tertiary)">
            <Package className="w-5 h-5 text-(--text-secondary)" />
          </div>
          <div>
            <h3 className="font-medium text-(--text-primary) flex items-center gap-2">
              {plugin.name}
              {plugin.enabled ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <Trans>Enabled</Trans>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-(--text-muted)">
                  <PowerOff className="w-3 h-3" />
                  <Trans>Disabled</Trans>
                </span>
              )}
            </h3>
            <p className="text-sm text-(--text-muted)">v{plugin.version}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {plugin.enabled ? (
            <Button
              onPress={() => handleAction("disable", () => onDisable(plugin.id))}
              isDisabled={isLoading}
              className="p-2 rounded-lg text-(--text-secondary) hover:bg-(--bg-tertiary) hover:text-amber-600 transition-colors disabled:opacity-50"
              aria-label={t`Disable plugin`}
            >
              {loadingAction === "disable" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PowerOff className="w-4 h-4" />
              )}
            </Button>
          ) : (
            <Button
              onPress={() => handleAction("enable", () => onEnable(plugin.id))}
              isDisabled={isLoading}
              className="p-2 rounded-lg text-(--text-secondary) hover:bg-(--bg-tertiary) hover:text-green-600 transition-colors disabled:opacity-50"
              aria-label={t`Enable plugin`}
            >
              {loadingAction === "enable" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
            </Button>
          )}

          <Button
            onPress={() => onConfigure(plugin.id)}
            isDisabled={isLoading}
            className="p-2 rounded-lg text-(--text-secondary) hover:bg-(--bg-tertiary) hover:text-primary-600 transition-colors disabled:opacity-50"
            aria-label={t`Configure plugin`}
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            onPress={() => handleAction("uninstall", () => onUninstall(plugin.id))}
            isDisabled={isLoading}
            className="p-2 rounded-lg text-(--text-secondary) hover:bg-(--bg-tertiary) hover:text-red-600 transition-colors disabled:opacity-50"
            aria-label={t`Uninstall plugin`}
          >
            {loadingAction === "uninstall" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Description */}
      {plugin.description && (
        <p className="mt-3 text-sm text-(--text-secondary)">{plugin.description}</p>
      )}

      {/* Metadata */}
      <div className="mt-3 flex items-center gap-4 text-xs text-(--text-muted)">
        {plugin.hasBackend && (
          <span className="inline-flex items-center gap-1">
            <Code className="w-3 h-3" />
            <Trans>Backend</Trans>
          </span>
        )}
        {plugin.hasFrontend && (
          <span className="inline-flex items-center gap-1">
            <Palette className="w-3 h-3" />
            <Trans>Frontend</Trans>
          </span>
        )}
        <span className="text-(--text-muted) truncate max-w-48" title={plugin.source}>
          {plugin.source}
        </span>
      </div>
    </div>
  );
}
