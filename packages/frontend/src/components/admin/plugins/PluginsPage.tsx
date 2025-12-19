"use client";

/**
 * Plugins Admin Page Component
 *
 * Main page for managing installed plugins.
 *
 * @module components/admin/plugins/PluginsPage
 */

import { useState, useEffect, useCallback } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Package, Plus, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../../ui/Button";
import { AdminLayout } from "../AdminLayout";
import { PluginCard } from "./PluginCard";
import { PluginInstallDialog } from "./PluginInstallDialog";
import { PluginConfigDialog } from "./PluginConfigDialog";
import { pluginApi } from "../../../lib/api/plugins";
import type { PluginListEntry } from "shared";
import type { PluginConfig } from "../../../lib/api/plugins";

interface PluginsPageProps {
  currentPath: string;
}

/**
 * Admin page for managing plugins
 */
export function PluginsPage({ currentPath }: PluginsPageProps) {
  const { t } = useLingui();
  const [plugins, setPlugins] = useState<PluginListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Config dialog state
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const loadPlugins = useCallback(async (showReloading = false) => {
    if (showReloading) {
      setIsReloading(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await pluginApi.list();
      setPlugins(response.plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plugins");
    } finally {
      setIsLoading(false);
      setIsReloading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const showMessage = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleEnable = async (id: string) => {
    try {
      const result = await pluginApi.enable(id);
      if (result.success) {
        showMessage("success", t`Plugin enabled. Restart required to apply changes.`);
        await loadPlugins(true);
      } else {
        showMessage("error", result.error || t`Failed to enable plugin`);
      }
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : t`Unknown error`);
    }
  };

  const handleDisable = async (id: string) => {
    try {
      const result = await pluginApi.disable(id);
      if (result.success) {
        showMessage("success", t`Plugin disabled. Restart required to apply changes.`);
        await loadPlugins(true);
      } else {
        showMessage("error", result.error || t`Failed to disable plugin`);
      }
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : t`Unknown error`);
    }
  };

  const handleUninstall = async (id: string) => {
    if (!confirm(t`Are you sure you want to uninstall this plugin?`)) {
      return;
    }

    try {
      const result = await pluginApi.uninstall(id);
      if (result.success) {
        showMessage("success", t`Plugin uninstalled. Restart required to apply changes.`);
        await loadPlugins(true);
      } else {
        showMessage("error", result.error || t`Failed to uninstall plugin`);
      }
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : t`Unknown error`);
    }
  };

  const handleInstall = async (
    source: string,
    force?: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await pluginApi.install(source, force);
      if (result.success) {
        await loadPlugins(true);
      }
      return { success: result.success, error: result.error };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  };

  const handleConfigure = (id: string) => {
    const plugin = plugins.find((p) => p.id === id);
    if (plugin) {
      setSelectedPlugin({ id: plugin.id, name: plugin.name });
      setConfigDialogOpen(true);
    }
  };

  const handleLoadConfig = async (id: string): Promise<PluginConfig> => {
    return pluginApi.getConfig(id);
  };

  const handleSaveConfig = async (
    id: string,
    config: PluginConfig
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await pluginApi.setConfig(id, config);
      return { success: result.success, error: result.error };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  };

  return (
    <AdminLayout
      currentPath={currentPath}
      title={<Trans>Plugins</Trans>}
      subtitle={<Trans>Manage installed plugins</Trans>}
      showReload
      onReload={() => loadPlugins(true)}
      isReloading={isReloading}
      actions={[
        {
          key: "reload",
          icon: <RefreshCw className={`w-4 h-4 ${isReloading ? "animate-spin" : ""}`} />,
          label: <Trans>Reload</Trans>,
          onPress: () => loadPlugins(true),
          variant: "secondary",
        },
      ]}
    >
      <div className="space-y-6">
        {/* Install Button */}
        <div className="flex justify-end">
          <PluginInstallDialog
            trigger={
              <Button variant="primary" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <Trans>Install Plugin</Trans>
              </Button>
            }
            onInstall={handleInstall}
          />
        </div>

        {/* Action Message */}
        {actionMessage && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              actionMessage.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}
          >
            {actionMessage.type === "success" ? (
              <Package className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-(--text-muted)" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-(--text-secondary) mb-4">{error}</p>
            <Button variant="secondary" onPress={() => loadPlugins()}>
              <Trans>Try Again</Trans>
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && plugins.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-(--text-muted) mb-4" />
            <h3 className="text-lg font-medium text-(--text-primary) mb-2">
              <Trans>No plugins installed</Trans>
            </h3>
            <p className="text-(--text-secondary) mb-4">
              <Trans>Install plugins to extend Rox functionality.</Trans>
            </p>
          </div>
        )}

        {/* Plugin List */}
        {!isLoading && !error && plugins.length > 0 && (
          <div className="grid gap-4">
            {plugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onEnable={handleEnable}
                onDisable={handleDisable}
                onUninstall={handleUninstall}
                onConfigure={handleConfigure}
              />
            ))}
          </div>
        )}

        {/* Config Dialog */}
        {selectedPlugin && (
          <PluginConfigDialog
            isOpen={configDialogOpen}
            pluginId={selectedPlugin.id}
            pluginName={selectedPlugin.name}
            onClose={() => {
              setConfigDialogOpen(false);
              setSelectedPlugin(null);
            }}
            onLoadConfig={handleLoadConfig}
            onSaveConfig={handleSaveConfig}
          />
        )}
      </div>
    </AdminLayout>
  );
}
