"use client";

/**
 * Account Deletion Section Component
 *
 * Allows users to permanently delete their account.
 * Requires password confirmation for security.
 *
 * @module components/settings/AccountDeletionSection
 */

import { useState } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { AlertTriangle, Trash2 } from "lucide-react";
import { tokenAtom, logoutAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { addToastAtom } from "../../lib/atoms/toast";

export function AccountDeletionSection() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);
  const [, logout] = useAtom(logoutAtom);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CONFIRM_TEXT = "DELETE";

  const handleDelete = async () => {
    if (!token) return;
    if (confirmText !== CONFIRM_TEXT) {
      setError(t`Please type "${CONFIRM_TEXT}" to confirm`);
      return;
    }
    if (!password) {
      setError(t`Please enter your password`);
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      apiClient.setToken(token);
      await apiClient.post("/api/users/@me/delete", { password });

      addToast({
        type: "success",
        message: t`Account deleted successfully`,
      });

      // Log out and redirect
      await logout();
    } catch (err: any) {
      setError(err.message || t`Failed to delete account`);
      addToast({
        type: "error",
        message: err.message || t`Failed to delete account`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setPassword("");
    setConfirmText("");
    setError(null);
  };

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <Trans>Danger Zone</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        {!showConfirmation ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Trans>
                Once you delete your account, there is no going back. This action is permanent and
                will delete all your data, including notes, followers, and profile information.
              </Trans>
            </p>
            <Button
              variant="danger"
              onPress={() => setShowConfirmation(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              <Trans>Delete Account</Trans>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                <Trans>Are you absolutely sure?</Trans>
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                <Trans>
                  This action cannot be undone. This will permanently delete your account and remove
                  all your data from our servers.
                </Trans>
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmText"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                <Trans>Type "{CONFIRM_TEXT}" to confirm</Trans>
              </label>
              <input
                type="text"
                id="confirmText"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isDeleting}
                placeholder={CONFIRM_TEXT}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                <Trans>Enter your password</Trans>
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isDeleting}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex items-center gap-3">
              <Button
                variant="danger"
                onPress={handleDelete}
                isDisabled={isDeleting || confirmText !== CONFIRM_TEXT || !password}
              >
                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="xs" variant="white" />
                    <span>
                      <Trans>Deleting...</Trans>
                    </span>
                  </div>
                ) : (
                  <Trans>Permanently Delete Account</Trans>
                )}
              </Button>
              <Button variant="secondary" onPress={handleCancel} isDisabled={isDeleting}>
                <Trans>Cancel</Trans>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
