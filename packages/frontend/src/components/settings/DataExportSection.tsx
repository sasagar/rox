"use client";

/**
 * Data Export Section Component
 *
 * Allows users to download their personal data in a portable format.
 * Implements GDPR Article 20 (Right to Data Portability).
 *
 * @module components/settings/DataExportSection
 */

import { useState } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Download, FileJson, Info } from "lucide-react";
import { tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { addToastAtom } from "../../lib/atoms/toast";

export function DataExportSection() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!token) return;

    setIsExporting(true);

    try {
      apiClient.setToken(token);
      const response = await apiClient.get("/api/users/@me/export");

      // Create a blob and download link
      const blob = new Blob([JSON.stringify(response, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split("T")[0];

      // Create download link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `user-data-export-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL
      URL.revokeObjectURL(url);

      addToast({
        type: "success",
        message: t`Data exported successfully`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to export data`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="w-5 h-5" />
          <Trans>Data Export</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">
                  <Trans>Your Right to Data Portability</Trans>
                </p>
                <p>
                  <Trans>
                    You can download a copy of your personal data at any time. This includes your
                    profile information, notes, social connections, media files, and notification
                    history.
                  </Trans>
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>
              <Trans>The export includes:</Trans>
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>
                <Trans>Profile information (username, display name, bio)</Trans>
              </li>
              <li>
                <Trans>All your notes and their visibility settings</Trans>
              </li>
              <li>
                <Trans>Following and follower relationships</Trans>
              </li>
              <li>
                <Trans>Uploaded media files metadata</Trans>
              </li>
              <li>
                <Trans>Notification history statistics</Trans>
              </li>
              <li>
                <Trans>UI settings and preferences</Trans>
              </li>
            </ul>
          </div>

          <Button onPress={handleExport} isDisabled={isExporting}>
            {isExporting ? (
              <div className="flex items-center gap-2">
                <Spinner size="xs" />
                <span>
                  <Trans>Exporting...</Trans>
                </span>
              </div>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                <Trans>Download My Data</Trans>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
