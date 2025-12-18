"use client";

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { currentUserAtom, tokenAtom, logoutAtom } from "../lib/atoms/auth";
import { usersApi } from "../lib/api/users";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { InlineError } from "../components/ui/ErrorMessage";
import { addToastAtom } from "../lib/atoms/toast";
import { Layout } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/PageHeader";
import { InvitationCodeSection } from "../components/settings/InvitationCodeSection";
import { UISettingsSection } from "../components/settings/UISettingsSection";
import { AccountMigrationSection } from "../components/settings/AccountMigrationSection";
import { AboutSection } from "../components/settings/AboutSection";
import { PushNotificationSection } from "../components/settings/PushNotificationSection";
import { StorageSection } from "../components/settings/StorageSection";
import { ProfileImageSection } from "../components/settings/ProfileImageSection";
import { PasskeySection } from "../components/settings/PasskeySection";
import { AccountDeletionSection } from "../components/settings/AccountDeletionSection";
import { DataExportSection } from "../components/settings/DataExportSection";
import {
  User,
  Shield,
  Bell,
  HardDrive,
  Settings,
  UserCog,
} from "lucide-react";

type SettingsTab = "profile" | "security" | "notifications" | "storage" | "account" | "advanced";

/**
 * Settings page
 * Allows users to edit their profile information
 */
export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);
  const [, logout] = useAtom(logoutAtom);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      // No token at all, redirect to login
      if (!token) {
        window.location.href = "/login";
        return;
      }

      // Token exists but no user data, try to restore session
      if (!currentUser) {
        try {
          const { apiClient } = await import("../lib/api/client");
          apiClient.setToken(token);
          const response = await apiClient.get<{ user: any }>("/api/auth/session");
          setCurrentUser(response.user);
          setIsLoading(false);
        } catch (error) {
          console.error("Failed to restore session:", error);
          // Token is invalid, redirect to login
          window.location.href = "/login";
          return;
        }
      } else {
        // Already have user data, just stop loading
        setIsLoading(false);
      }
    };
    restoreSession();
  }, [token, currentUser, setCurrentUser]);

  // Initialize form with current user data
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || currentUser.name || "");
      setBio(currentUser.bio || "");
      setCustomCss((currentUser as any).customCss || "");
    }
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError(t`Please log in to update your profile`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updatedUser = await usersApi.updateMe({
        name: displayName.trim() || undefined,
        description: bio.trim() || undefined,
        customCss: customCss.trim() || undefined,
      });

      // Update current user in state
      setCurrentUser(updatedUser);

      // Show success toast
      addToast({
        type: "success",
        message: t`Profile updated successfully`,
      });

      // Redirect to profile page
      setTimeout(() => {
        window.location.href = `/${currentUser?.username}`;
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update profile";
      setError(errorMessage);

      // Show error toast
      addToast({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
  };

  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Spinner size="lg" />
      </div>
    );
  }

  const TABS = [
    { key: "profile", label: <Trans>Profile</Trans>, icon: <User className="w-4 h-4" /> },
    { key: "security", label: <Trans>Security</Trans>, icon: <Shield className="w-4 h-4" /> },
    { key: "notifications", label: <Trans>Notifications</Trans>, icon: <Bell className="w-4 h-4" /> },
    { key: "storage", label: <Trans>Storage</Trans>, icon: <HardDrive className="w-4 h-4" /> },
    { key: "account", label: <Trans>Account</Trans>, icon: <UserCog className="w-4 h-4" /> },
    { key: "advanced", label: <Trans>Advanced</Trans>, icon: <Settings className="w-4 h-4" /> },
  ];

  const pageHeader = (
    <PageHeader
      title={<Trans>Settings</Trans>}
      subtitle={<Trans>Manage your account settings</Trans>}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as SettingsTab)}
    />
  );

  return (
    <Layout header={pageHeader}>
      {/* Profile Tab */}
      {activeTab === "profile" && (
        <>
          {/* Profile Images Section */}
          <ProfileImageSection />

          <Card className="mt-6">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Display Name */}
                <div>
                  <label
                    htmlFor="displayName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <Trans>Display Name</Trans>
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={currentUser.username}
                    maxLength={50}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <Trans>Your public display name (max 50 characters)</Trans>
                  </p>
                </div>

                {/* Bio */}
                <div>
                  <label
                    htmlFor="bio"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <Trans>Bio</Trans>
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t`Tell us about yourself...`}
                    maxLength={500}
                    rows={4}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    disabled={isSubmitting}
                  />
                  <div className="mt-1 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      <Trans>Your bio (max 500 characters)</Trans>
                    </span>
                    <span className={bio.length > 450 ? "text-orange-600 font-medium" : ""}>
                      {bio.length}/500
                    </span>
                  </div>
                </div>

                {/* Username (read-only) */}
                <div>
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <Trans>Username</Trans>
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={currentUser.username}
                    readOnly
                    disabled
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <Trans>Username cannot be changed</Trans>
                  </p>
                </div>

                {/* Custom CSS */}
                <div>
                  <label
                    htmlFor="customCss"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    <Trans>Custom CSS</Trans>
                  </label>
                  <textarea
                    id="customCss"
                    value={customCss}
                    onChange={(e) => setCustomCss(e.target.value)}
                    placeholder="/* Custom CSS */\n.profile-header {\n  background: #333;\n}"
                    maxLength={10240}
                    rows={6}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-sm"
                    disabled={isSubmitting}
                  />
                  <div className="mt-1 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      <Trans>Custom CSS for your profile page (max 10KB)</Trans>
                    </span>
                    <span className={customCss.length > 9000 ? "text-orange-600 font-medium" : ""}>
                      {customCss.length.toLocaleString()}/10,240
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    <Trans>
                      Note: Custom CSS is sanitized and some properties may be restricted for security.
                    </Trans>
                  </p>
                </div>

                {/* Error message */}
                {error && <InlineError message={error} />}

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-4">
                  <Button type="submit" variant="primary" isDisabled={isSubmitting}>
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Spinner size="xs" variant="white" />
                        <span>
                          <Trans>Saving...</Trans>
                        </span>
                      </div>
                    ) : (
                      <Trans>Save Changes</Trans>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onPress={() => {
                      window.location.href = `/${currentUser.username}`;
                    }}
                    isDisabled={isSubmitting}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <PasskeySection />
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <PushNotificationSection />
      )}

      {/* Storage Tab */}
      {activeTab === "storage" && (
        <StorageSection />
      )}

      {/* Account Tab */}
      {activeTab === "account" && (
        <>
          {/* Logout Section */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                <Trans>Session</Trans>
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <Trans>Sign out of your account on this device.</Trans>
              </p>
              <Button
                variant="danger"
                onPress={handleLogout}
                isDisabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="xs" variant="white" />
                    <span>
                      <Trans>Logging out...</Trans>
                    </span>
                  </div>
                ) : (
                  <Trans>Logout</Trans>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Account Migration Section */}
          <div className="mt-6">
            <AccountMigrationSection />
          </div>

          {/* Data Export Section */}
          <div className="mt-6">
            <DataExportSection />
          </div>

          {/* Account Deletion Section */}
          <div className="mt-6">
            <AccountDeletionSection />
          </div>
        </>
      )}

      {/* Advanced Tab */}
      {activeTab === "advanced" && (
        <>
          {/* UI Settings Section */}
          <UISettingsSection />

          {/* Invitation Codes Section - only shown if user has permission */}
          <div className="mt-6">
            <InvitationCodeSection />
          </div>

          {/* About Section */}
          <div className="mt-6">
            <AboutSection />
          </div>
        </>
      )}
    </Layout>
  );
}
