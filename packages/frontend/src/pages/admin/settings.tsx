"use client";

/**
 * Admin Settings Page
 *
 * Allows administrators to configure instance settings:
 * - Instance metadata (name, description, contact)
 * - Registration settings (enabled, invite-only, approval)
 * - Theme settings (primary color, dark mode)
 */

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { clearInstanceInfoCache } from "../../hooks/useInstanceInfo";
import { AdminNav } from "../../components/admin/AdminNav";
import { AssetUploadCard } from "../../components/admin/AssetUploadCard";
import { Settings, Building, UserPlus, Palette, ImageIcon, Scale } from "lucide-react";

interface AdminSettings {
  registration: {
    enabled: boolean;
    inviteOnly: boolean;
    approvalRequired: boolean;
  };
  instance: {
    name: string;
    description: string;
    maintainerEmail: string;
    iconUrl: string | null;
    bannerUrl: string | null;
    faviconUrl: string | null;
    tosUrl: string | null;
    privacyPolicyUrl: string | null;
    sourceCodeUrl: string | null;
  };
  theme: {
    primaryColor: string;
    darkMode: "light" | "dark" | "system";
    nodeInfoThemeColor: string | null;
  };
}

/**
 * Color presets for quick selection
 */
const COLOR_PRESETS = [
  { name: "Blue", color: "#3b82f6" },
  { name: "Purple", color: "#8b5cf6" },
  { name: "Pink", color: "#ec4899" },
  { name: "Red", color: "#ef4444" },
  { name: "Orange", color: "#f97316" },
  { name: "Green", color: "#22c55e" },
  { name: "Teal", color: "#14b8a6" },
  { name: "Cyan", color: "#06b6d4" },
];

export default function AdminSettingsPage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"instance" | "registration" | "theme" | "assets" | "legal">("instance");
  const [assets, setAssets] = useState<{
    icon: string | null;
    darkIcon: string | null;
    banner: string | null;
    favicon: string | null;
    pwaIcon192: string | null;
    pwaIcon512: string | null;
    pwaMaskableIcon192: string | null;
    pwaMaskableIcon512: string | null;
  }>({
    icon: null,
    darkIcon: null,
    banner: null,
    favicon: null,
    pwaIcon192: null,
    pwaIcon512: null,
    pwaMaskableIcon192: null,
    pwaMaskableIcon512: null,
  });
  const [isUploadingAsset, setIsUploadingAsset] = useState<string | null>(null);

  // Check admin access and load settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        apiClient.setToken(token);

        // Check if user is admin and restore session
        const sessionResponse = await apiClient.get<{ user: any }>("/api/auth/session");
        if (!sessionResponse.user?.isAdmin) {
          window.location.href = "/timeline";
          return;
        }

        // Update currentUser atom to ensure sidebar shows
        setCurrentUser(sessionResponse.user);

        // Load admin settings and assets
        const [settingsResponse, assetsResponse] = await Promise.all([
          apiClient.get<AdminSettings>("/api/admin/settings"),
          apiClient.get<{
            icon: string | null;
            darkIcon: string | null;
            banner: string | null;
            favicon: string | null;
            pwaIcon192: string | null;
            pwaIcon512: string | null;
            pwaMaskableIcon192: string | null;
            pwaMaskableIcon512: string | null;
          }>("/api/admin/assets"),
        ]);
        setSettings(settingsResponse);
        setAssets(assetsResponse);
      } catch (err) {
        console.error("Failed to load settings:", err);
        setError("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [token, setCurrentUser]);

  const handleSaveInstance = async () => {
    if (!settings) return;

    setIsSaving(true);
    setError(null);

    try {
      await apiClient.patch("/api/admin/settings/instance", settings.instance);
      clearInstanceInfoCache();
      addToast({ type: "success", message: t`Instance settings saved` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      addToast({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRegistration = async () => {
    if (!settings) return;

    setIsSaving(true);
    setError(null);

    try {
      await apiClient.patch("/api/admin/settings/registration", settings.registration);
      clearInstanceInfoCache();
      addToast({ type: "success", message: t`Registration settings saved` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      addToast({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!settings) return;

    setIsSaving(true);
    setError(null);

    try {
      await apiClient.patch("/api/admin/settings/theme", settings.theme);
      clearInstanceInfoCache();
      addToast({ type: "success", message: t`Theme settings saved` });
      // Reload page to apply new theme
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      addToast({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssetUpload = async (assetType: "icon" | "darkIcon" | "banner" | "favicon" | "pwaIcon192" | "pwaIcon512" | "pwaMaskableIcon192" | "pwaMaskableIcon512", file: File) => {
    setIsUploadingAsset(assetType);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", assetType);

      const response = await fetch("/api/admin/assets/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      setAssets((prev) => ({ ...prev, [assetType]: result.url }));
      clearInstanceInfoCache();
      addToast({ type: "success", message: t`${assetType} uploaded successfully` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      addToast({ type: "error", message });
    } finally {
      setIsUploadingAsset(null);
    }
  };

  const handleAssetDelete = async (assetType: "icon" | "darkIcon" | "banner" | "favicon" | "pwaIcon192" | "pwaIcon512" | "pwaMaskableIcon192" | "pwaMaskableIcon512") => {
    setIsUploadingAsset(assetType);
    setError(null);

    try {
      await apiClient.delete(`/api/admin/assets/${assetType}`);
      setAssets((prev) => ({ ...prev, [assetType]: null }));
      clearInstanceInfoCache();
      addToast({ type: "success", message: t`${assetType} removed` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove";
      setError(message);
      addToast({ type: "error", message });
    } finally {
      setIsUploadingAsset(null);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!currentUser?.isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  const pageHeader = (
    <PageHeader
      title={<Trans>Admin Settings</Trans>}
      subtitle={<Trans>Configure your instance settings</Trans>}
      icon={<Settings className="w-6 h-6" />}
      tabs={[
        { key: "instance", label: <Trans>Instance</Trans>, icon: <Building className="w-4 h-4" /> },
        { key: "registration", label: <Trans>Registration</Trans>, icon: <UserPlus className="w-4 h-4" /> },
        { key: "theme", label: <Trans>Theme</Trans>, icon: <Palette className="w-4 h-4" /> },
        { key: "assets", label: <Trans>Assets</Trans>, icon: <ImageIcon className="w-4 h-4" /> },
        { key: "legal", label: <Trans>Legal</Trans>, icon: <Scale className="w-4 h-4" /> },
      ]}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as "instance" | "registration" | "theme" | "assets" | "legal")}
    />
  );

  return (
    <Layout header={pageHeader}>
      {/* Admin Navigation */}
      <AdminNav currentPath="/admin/settings" />

      {error && <InlineError message={error} className="mb-4" />}

      {/* Instance Settings */}
      {activeTab === "instance" && settings && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Instance Information</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-2">
                <Trans>Instance Name</Trans>
              </label>
              <input
                type="text"
                value={settings.instance.name}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    instance: { ...settings.instance, name: e.target.value },
                  })
                }
                className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-2">
                <Trans>Description</Trans>
              </label>
              <textarea
                value={settings.instance.description}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    instance: { ...settings.instance, description: e.target.value },
                  })
                }
                rows={3}
                className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-2">
                <Trans>Maintainer Email</Trans>
              </label>
              <input
                type="email"
                value={settings.instance.maintainerEmail}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    instance: { ...settings.instance, maintainerEmail: e.target.value },
                  })
                }
                className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSaving}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-2">
                  <Trans>Icon URL</Trans>
                </label>
                <input
                  type="url"
                  value={settings.instance.iconUrl || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      instance: { ...settings.instance, iconUrl: e.target.value || null },
                    })
                  }
                  placeholder="https://..."
                  className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text-primary) mb-2">
                  <Trans>Banner URL</Trans>
                </label>
                <input
                  type="url"
                  value={settings.instance.bannerUrl || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      instance: { ...settings.instance, bannerUrl: e.target.value || null },
                    })
                  }
                  placeholder="https://..."
                  className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-2">
                <Trans>Favicon URL</Trans>
              </label>
              <input
                type="url"
                value={settings.instance.faviconUrl || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    instance: { ...settings.instance, faviconUrl: e.target.value || null },
                  })
                }
                placeholder="https://..."
                className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSaving}
              />
              <p className="mt-1 text-sm text-(--text-muted)">
                <Trans>Browser tab icon (recommended: 32x32 PNG or ICO)</Trans>
              </p>
            </div>

            <div className="pt-4">
              <Button variant="primary" onPress={handleSaveInstance} isDisabled={isSaving}>
                {isSaving ? (
                  <Spinner size="xs" variant="white" />
                ) : (
                  <Trans>Save Instance Settings</Trans>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration Settings */}
      {activeTab === "registration" && settings && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Registration Settings</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.registration.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    registration: { ...settings.registration, enabled: e.target.checked },
                  })
                }
                className="w-5 h-5 rounded border-(--border-color) text-primary-600 focus:ring-primary-500"
                disabled={isSaving}
              />
              <div>
                <span className="font-medium text-(--text-primary)">
                  <Trans>Enable Registration</Trans>
                </span>
                <p className="text-sm text-(--text-muted)">
                  <Trans>Allow new users to register accounts</Trans>
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.registration.inviteOnly}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    registration: { ...settings.registration, inviteOnly: e.target.checked },
                  })
                }
                className="w-5 h-5 rounded border-(--border-color) text-primary-600 focus:ring-primary-500"
                disabled={isSaving || !settings.registration.enabled}
              />
              <div>
                <span className="font-medium text-(--text-primary)">
                  <Trans>Invite Only</Trans>
                </span>
                <p className="text-sm text-(--text-muted)">
                  <Trans>Require an invitation code to register</Trans>
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.registration.approvalRequired}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    registration: { ...settings.registration, approvalRequired: e.target.checked },
                  })
                }
                className="w-5 h-5 rounded border-(--border-color) text-primary-600 focus:ring-primary-500"
                disabled={isSaving || !settings.registration.enabled}
              />
              <div>
                <span className="font-medium text-(--text-primary)">
                  <Trans>Require Approval</Trans>
                </span>
                <p className="text-sm text-(--text-muted)">
                  <Trans>New accounts require admin approval</Trans>
                </p>
              </div>
            </label>

            <div className="pt-4">
              <Button variant="primary" onPress={handleSaveRegistration} isDisabled={isSaving}>
                {isSaving ? (
                  <Spinner size="xs" variant="white" />
                ) : (
                  <Trans>Save Registration Settings</Trans>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme Settings */}
      {activeTab === "theme" && settings && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Theme Settings</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-1">
                <Trans>Primary Color</Trans>
              </label>
              <p className="text-sm text-(--text-muted) mb-3">
                <Trans>
                  This color represents your server's brand identity. It will be used for buttons, links, and UI accents across the instance, and shared with other federated servers.
                </Trans>
              </p>

              {/* Color Presets */}
              <div className="flex flex-wrap gap-2 mb-4">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        theme: { ...settings.theme, primaryColor: preset.color },
                      })
                    }
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      settings.theme.primaryColor === preset.color
                        ? "border-(--text-primary) scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                    disabled={isSaving}
                  />
                ))}
              </div>

              {/* Custom Color Picker */}
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.theme.primaryColor}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      theme: { ...settings.theme, primaryColor: e.target.value },
                    })
                  }
                  className="w-12 h-10 rounded cursor-pointer"
                  disabled={isSaving}
                />
                <input
                  type="text"
                  value={settings.theme.primaryColor}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(value)) {
                      setSettings({
                        ...settings,
                        theme: { ...settings.theme, primaryColor: value },
                      });
                    }
                  }}
                  placeholder="#3b82f6"
                  className="w-28 rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-3">
                <Trans>Default Color Mode</Trans>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="darkMode"
                    value="system"
                    checked={settings.theme.darkMode === "system"}
                    onChange={() =>
                      setSettings({
                        ...settings,
                        theme: { ...settings.theme, darkMode: "system" },
                      })
                    }
                    className="w-4 h-4 text-primary-600"
                    disabled={isSaving}
                  />
                  <span className="text-(--text-primary)">
                    <Trans>System</Trans>
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="darkMode"
                    value="light"
                    checked={settings.theme.darkMode === "light"}
                    onChange={() =>
                      setSettings({
                        ...settings,
                        theme: { ...settings.theme, darkMode: "light" },
                      })
                    }
                    className="w-4 h-4 text-primary-600"
                    disabled={isSaving}
                  />
                  <span className="text-(--text-primary)">
                    <Trans>Light</Trans>
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="darkMode"
                    value="dark"
                    checked={settings.theme.darkMode === "dark"}
                    onChange={() =>
                      setSettings({
                        ...settings,
                        theme: { ...settings.theme, darkMode: "dark" },
                      })
                    }
                    className="w-4 h-4 text-primary-600"
                    disabled={isSaving}
                  />
                  <span className="text-(--text-primary)">
                    <Trans>Dark</Trans>
                  </span>
                </label>
              </div>
              <p className="mt-2 text-sm text-(--text-muted)">
                <Trans>Users can still override this with their own preference</Trans>
              </p>
            </div>

            {/* External Theme Color */}
            <div className="border-t border-(--border-color) pt-4">
              <label className="block text-sm font-medium text-(--text-primary) mb-1">
                <Trans>External Theme Color</Trans>
              </label>
              <p className="text-sm text-(--text-muted) mb-3">
                <Trans>
                  This color is shown on external services like Misskey when displaying your instance info.
                  Leave empty to use the primary color.
                </Trans>
              </p>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.theme.nodeInfoThemeColor !== null}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        theme: {
                          ...settings.theme,
                          nodeInfoThemeColor: e.target.checked ? settings.theme.primaryColor : null,
                        },
                      })
                    }
                    className="w-4 h-4 rounded border-(--border-color) text-primary-600 focus:ring-primary-500"
                    disabled={isSaving}
                  />
                  <span className="text-sm text-(--text-primary)">
                    <Trans>Use different color</Trans>
                  </span>
                </label>
              </div>

              {settings.theme.nodeInfoThemeColor !== null && (
                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="color"
                    value={settings.theme.nodeInfoThemeColor}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        theme: { ...settings.theme, nodeInfoThemeColor: e.target.value },
                      })
                    }
                    className="w-12 h-10 rounded cursor-pointer"
                    disabled={isSaving}
                  />
                  <input
                    type="text"
                    value={settings.theme.nodeInfoThemeColor}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(value)) {
                        setSettings({
                          ...settings,
                          theme: { ...settings.theme, nodeInfoThemeColor: value },
                        });
                      }
                    }}
                    placeholder="#ff6b6b"
                    className="w-28 rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="border border-(--border-color) rounded-lg p-4">
              <h4 className="text-sm font-medium text-(--text-primary) mb-3">
                <Trans>Preview</Trans>
              </h4>
              <div className="flex gap-3">
                <button
                  className="px-4 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: settings.theme.primaryColor }}
                >
                  <Trans>Primary Button</Trans>
                </button>
                <button
                  className="px-4 py-2 rounded-lg font-medium border-2"
                  style={{
                    borderColor: settings.theme.primaryColor,
                    color: settings.theme.primaryColor,
                  }}
                >
                  <Trans>Secondary</Trans>
                </button>
              </div>
            </div>

            <div className="pt-4">
              <Button variant="primary" onPress={handleSaveTheme} isDisabled={isSaving}>
                {isSaving ? (
                  <Spinner size="xs" variant="white" />
                ) : (
                  <Trans>Save Theme Settings</Trans>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets Settings */}
      {activeTab === "assets" && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Server Assets</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-(--text-muted)">
              <Trans>Upload images for your instance branding. Files are automatically converted to WebP format.</Trans>
            </p>

            <AssetUploadCard
              type="icon"
              title={<Trans>Instance Icon</Trans>}
              description={<Trans>Used for push notifications and instance branding (max 2MB)</Trans>}
              currentUrl={assets.icon}
              isUploading={isUploadingAsset === "icon"}
              onUpload={(file) => handleAssetUpload("icon", file)}
              onDelete={() => handleAssetDelete("icon")}
              previewClassName="w-16 h-16 rounded-lg"
            />

            <AssetUploadCard
              type="darkIcon"
              title={<Trans>Dark Mode Icon</Trans>}
              description={<Trans>Icon for dark mode. Falls back to standard icon if not set (max 2MB)</Trans>}
              currentUrl={assets.darkIcon}
              isUploading={isUploadingAsset === "darkIcon"}
              onUpload={(file) => handleAssetUpload("darkIcon", file)}
              onDelete={() => handleAssetDelete("darkIcon")}
              previewClassName="w-16 h-16 rounded-lg bg-gray-800"
            />

            <AssetUploadCard
              type="banner"
              title={<Trans>Instance Banner</Trans>}
              description={<Trans>Header image for your instance (max 5MB)</Trans>}
              currentUrl={assets.banner}
              isUploading={isUploadingAsset === "banner"}
              onUpload={(file) => handleAssetUpload("banner", file)}
              onDelete={() => handleAssetDelete("banner")}
              previewClassName="w-full max-w-md h-32 rounded-lg"
            />

            <AssetUploadCard
              type="favicon"
              title={<Trans>Favicon</Trans>}
              description={<Trans>Browser tab icon, recommended 32x32 or 64x64 (max 512KB)</Trans>}
              currentUrl={assets.favicon}
              isUploading={isUploadingAsset === "favicon"}
              onUpload={(file) => handleAssetUpload("favicon", file)}
              onDelete={() => handleAssetDelete("favicon")}
              previewClassName="w-8 h-8 rounded"
            />

            <AssetUploadCard
              type="pwaIcon192"
              title={<Trans>PWA Icon (192x192)</Trans>}
              description={<Trans>Icon for Progressive Web App, 192x192 pixels (max 1MB). Falls back to instance icon if not set.</Trans>}
              currentUrl={assets.pwaIcon192}
              isUploading={isUploadingAsset === "pwaIcon192"}
              onUpload={(file) => handleAssetUpload("pwaIcon192", file)}
              onDelete={() => handleAssetDelete("pwaIcon192")}
              previewClassName="w-12 h-12 rounded-lg"
            />

            <AssetUploadCard
              type="pwaIcon512"
              title={<Trans>PWA Icon (512x512)</Trans>}
              description={<Trans>High-res icon for PWA splash screen, 512x512 pixels (max 2MB). Falls back to instance icon if not set.</Trans>}
              currentUrl={assets.pwaIcon512}
              isUploading={isUploadingAsset === "pwaIcon512"}
              onUpload={(file) => handleAssetUpload("pwaIcon512", file)}
              onDelete={() => handleAssetDelete("pwaIcon512")}
              previewClassName="w-16 h-16 rounded-lg"
            />

            {/* Maskable Icons Section */}
            <div className="border-t border-(--border-color) pt-6 mt-6">
              <h3 className="text-lg font-medium text-(--text-primary) mb-2">
                <Trans>Maskable Icons (Optional)</Trans>
              </h3>
              <p className="text-sm text-(--text-muted) mb-4">
                <Trans>
                  Maskable icons are designed to be cropped by the OS into different shapes (circles, rounded squares, etc.).
                  These should have important content within a "safe zone" (centered 80% of the icon).
                  If not set, only standard icons will be used.
                </Trans>
              </p>

              <div className="space-y-6">
                <AssetUploadCard
                  type="pwaMaskableIcon192"
                  title={<Trans>PWA Maskable Icon (192x192)</Trans>}
                  description={<Trans>Maskable icon for PWA with safe zone padding, 192x192 pixels (max 1MB).</Trans>}
                  currentUrl={assets.pwaMaskableIcon192}
                  isUploading={isUploadingAsset === "pwaMaskableIcon192"}
                  onUpload={(file) => handleAssetUpload("pwaMaskableIcon192", file)}
                  onDelete={() => handleAssetDelete("pwaMaskableIcon192")}
                  previewClassName="w-12 h-12 rounded-full"
                />

                <AssetUploadCard
                  type="pwaMaskableIcon512"
                  title={<Trans>PWA Maskable Icon (512x512)</Trans>}
                  description={<Trans>High-res maskable icon for PWA with safe zone padding, 512x512 pixels (max 2MB).</Trans>}
                  currentUrl={assets.pwaMaskableIcon512}
                  isUploading={isUploadingAsset === "pwaMaskableIcon512"}
                  onUpload={(file) => handleAssetUpload("pwaMaskableIcon512", file)}
                  onDelete={() => handleAssetDelete("pwaMaskableIcon512")}
                  previewClassName="w-16 h-16 rounded-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Settings */}
      {activeTab === "legal" && settings && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Legal Documents</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-(--text-muted)">
              <Trans>Configure links to your Terms of Service and Privacy Policy pages. These links will be displayed in the site footer and during registration.</Trans>
            </p>

            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-2">
                <Trans>Terms of Service URL</Trans>
              </label>
              <input
                type="url"
                value={settings.instance.tosUrl || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    instance: { ...settings.instance, tosUrl: e.target.value || null },
                  })
                }
                placeholder="https://example.com/terms"
                className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSaving}
              />
              <p className="mt-1 text-sm text-(--text-muted)">
                <Trans>Enter a URL to your Terms of Service page, or leave empty to use the default template at /legal/terms</Trans>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-(--text-primary) mb-2">
                <Trans>Privacy Policy URL</Trans>
              </label>
              <input
                type="url"
                value={settings.instance.privacyPolicyUrl || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    instance: { ...settings.instance, privacyPolicyUrl: e.target.value || null },
                  })
                }
                placeholder="https://example.com/privacy"
                className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSaving}
              />
              <p className="mt-1 text-sm text-(--text-muted)">
                <Trans>Enter a URL to your Privacy Policy page, or leave empty to use the default template at /legal/privacy</Trans>
              </p>
            </div>

            <div className="border-t border-(--border-color) pt-4 mt-4">
              <h4 className="text-sm font-medium text-(--text-primary) mb-2">
                <Trans>Source Code URL (AGPL-3.0 Compliance)</Trans>
              </h4>
              <p className="text-sm text-(--text-muted) mb-3">
                <Trans>Under the AGPL-3.0 license, you must provide access to the source code of this instance. If you have modified the code, enter the URL to your fork.</Trans>
              </p>
              <input
                type="url"
                value={settings.instance.sourceCodeUrl || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    instance: { ...settings.instance, sourceCodeUrl: e.target.value || null },
                  })
                }
                placeholder="https://github.com/Love-Rox/rox"
                className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isSaving}
              />
              <p className="mt-1 text-sm text-(--text-muted)">
                <Trans>Default: https://github.com/Love-Rox/rox. Change this if you are running a modified version.</Trans>
              </p>
            </div>

            <div className="border-t border-(--border-color) pt-4 mt-4">
              <h4 className="text-sm font-medium text-(--text-primary) mb-2">
                <Trans>Default Legal Pages</Trans>
              </h4>
              <p className="text-sm text-(--text-muted) mb-3">
                <Trans>If no custom URLs are set, visitors will see the default legal pages:</Trans>
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline"
                >
                  <Trans>View Default Terms</Trans>
                </a>
                <a
                  href="/legal/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline"
                >
                  <Trans>View Default Privacy Policy</Trans>
                </a>
                <a
                  href="/legal/licenses"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline"
                >
                  <Trans>View Open Source Licenses</Trans>
                </a>
              </div>
            </div>

            <div className="pt-4">
              <Button variant="primary" onPress={handleSaveInstance} isDisabled={isSaving}>
                {isSaving ? (
                  <Spinner size="xs" variant="white" />
                ) : (
                  <Trans>Save Legal Settings</Trans>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
