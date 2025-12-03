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
import { clearInstanceInfoCache } from "../../hooks/useInstanceInfo";
import { AdminNav } from "../../components/admin/AdminNav";
import { AssetUploadCard } from "../../components/admin/AssetUploadCard";

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
  };
  theme: {
    primaryColor: string;
    darkMode: "light" | "dark" | "system";
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
  const [activeTab, setActiveTab] = useState<"instance" | "registration" | "theme" | "assets">("instance");
  const [assets, setAssets] = useState<{ icon: string | null; banner: string | null; favicon: string | null }>({
    icon: null,
    banner: null,
    favicon: null,
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
          apiClient.get<{ icon: string | null; banner: string | null; favicon: string | null }>("/api/admin/assets"),
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

  const handleAssetUpload = async (assetType: "icon" | "banner" | "favicon", file: File) => {
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

  const handleAssetDelete = async (assetType: "icon" | "banner" | "favicon") => {
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

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-(--text-primary)">
          <Trans>Admin Settings</Trans>
        </h1>
        <p className="mt-2 text-(--text-secondary)">
          <Trans>Configure your instance settings</Trans>
        </p>
      </div>

      {/* Admin Navigation */}
      <AdminNav currentPath="/admin/settings" />

      {/* Tab Navigation */}
      <div className="border-b border-(--border-color) mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab("instance")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "instance"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-(--text-muted) hover:text-(--text-primary)"
            }`}
          >
            <Trans>Instance</Trans>
          </button>
          <button
            onClick={() => setActiveTab("registration")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "registration"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-(--text-muted) hover:text-(--text-primary)"
            }`}
          >
            <Trans>Registration</Trans>
          </button>
          <button
            onClick={() => setActiveTab("theme")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "theme"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-(--text-muted) hover:text-(--text-primary)"
            }`}
          >
            <Trans>Theme</Trans>
          </button>
          <button
            onClick={() => setActiveTab("assets")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "assets"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-(--text-muted) hover:text-(--text-primary)"
            }`}
          >
            <Trans>Assets</Trans>
          </button>
        </nav>
      </div>

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

            <div className="grid md:grid-cols-2 gap-4">
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
                  placeholder="https://..."
                  className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={isSaving}
                />
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
                  placeholder="https://..."
                  className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={isSaving}
                />
              </div>
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
              <label className="block text-sm font-medium text-(--text-primary) mb-3">
                <Trans>Primary Color</Trans>
              </label>

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
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
