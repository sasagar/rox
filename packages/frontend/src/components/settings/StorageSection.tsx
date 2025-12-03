"use client";

/**
 * Storage Section Component
 *
 * Allows users to view their storage usage and manage their files:
 * - Storage quota visualization
 * - File list with delete functionality
 * - File type breakdown
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { HardDrive, Trash2, FileImage, FileVideo, FileAudio, FileText, File, RefreshCw } from "lucide-react";
import { tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { addToastAtom } from "../../lib/atoms/toast";
import type { DriveFile } from "shared";

interface StorageUsage {
  usage: number;
  usageMB: number;
  quotaMB: number;
  quotaBytes: number;
  isUnlimited: boolean;
  usagePercent: number;
  fileCount: {
    total: number;
    user: number;
    system: number;
  };
}

interface StorageStats {
  byType: Record<string, { count: number; size: number }>;
  bySource: Record<string, { count: number; size: number }>;
  totalFiles: number;
  totalSize: number;
}

/**
 * Get icon for file type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <FileImage className="w-4 h-4" />;
  if (mimeType.startsWith("video/")) return <FileVideo className="w-4 h-4" />;
  if (mimeType.startsWith("audio/")) return <FileAudio className="w-4 h-4" />;
  if (mimeType.startsWith("text/") || mimeType.includes("pdf")) return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function StorageSection() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      apiClient.setToken(token);

      const [usageData, statsData, filesData] = await Promise.all([
        apiClient.get<StorageUsage>("/api/drive/usage"),
        apiClient.get<StorageStats>("/api/drive/stats"),
        apiClient.get<DriveFile[]>("/api/drive/files?limit=100"),
      ]);

      setUsage(usageData);
      setStats(statsData);
      setFiles(filesData);
    } catch (err: any) {
      console.error("Failed to fetch storage data:", err);
      addToast({
        type: "error",
        message: err.message || t`Failed to load storage data`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteFile = async (fileId: string) => {
    if (!token) return;

    setIsDeleting(fileId);
    try {
      apiClient.setToken(token);
      await apiClient.post("/api/drive/files/delete", { fileId });

      // Remove from local state
      setFiles((prev) => prev.filter((f) => f.id !== fileId));

      // Refresh usage data
      const usageData = await apiClient.get<StorageUsage>("/api/drive/usage");
      setUsage(usageData);

      addToast({
        type: "success",
        message: t`File deleted`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to delete file`,
      });
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            <Trans>Storage</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedFiles = showAllFiles ? files : files.slice(0, 10);
  const userFiles = files.filter((f) => (f as any).source === "user" || !(f as any).source);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          <Trans>Storage</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-6">
        {/* Storage Usage Bar */}
        {usage && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                <Trans>Storage Usage</Trans>
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {usage.isUnlimited ? (
                  <Trans>{formatBytes(usage.usage)} used (Unlimited)</Trans>
                ) : (
                  <Trans>
                    {formatBytes(usage.usage)} / {usage.quotaMB} MB ({usage.usagePercent}%)
                  </Trans>
                )}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.usagePercent > 90
                    ? "bg-red-500"
                    : usage.usagePercent > 70
                      ? "bg-yellow-500"
                      : "bg-primary-500"
                }`}
                style={{ width: usage.isUnlimited ? "0%" : `${Math.min(usage.usagePercent, 100)}%` }}
              />
            </div>

            {/* File Count */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>
                <Trans>{usage.fileCount.total} files total</Trans>
              </span>
              <span>
                <Trans>{usage.fileCount.user} uploaded by you</Trans>
              </span>
              {usage.fileCount.system > 0 && (
                <span>
                  <Trans>{usage.fileCount.system} system files</Trans>
                </span>
              )}
            </div>
          </div>
        )}

        {/* File Type Breakdown */}
        {stats && Object.keys(stats.byType).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <Trans>By File Type</Trans>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(stats.byType).map(([type, data]) => (
                <div
                  key={type}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
                >
                  {type === "image" && <FileImage className="w-4 h-4 text-blue-500" />}
                  {type === "video" && <FileVideo className="w-4 h-4 text-purple-500" />}
                  {type === "audio" && <FileAudio className="w-4 h-4 text-green-500" />}
                  {type === "text" && <FileText className="w-4 h-4 text-gray-500" />}
                  {type === "document" && <FileText className="w-4 h-4 text-orange-500" />}
                  {type === "other" && <File className="w-4 h-4 text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {type}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {data.count} files, {formatBytes(data.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <Trans>Your Files</Trans>
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onPress={fetchData}
              isDisabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {userFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>
                <Trans>No files uploaded yet</Trans>
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {displayedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    {/* Thumbnail or Icon */}
                    {file.type.startsWith("image/") && file.thumbnailUrl ? (
                      <img
                        src={file.thumbnailUrl}
                        alt=""
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded">
                        {getFileIcon(file.type)}
                      </div>
                    )}

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatBytes(file.size)} • {file.type}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {file.isSensitive && (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded">
                          NSFW
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => handleDeleteFile(file.id)}
                        isDisabled={isDeleting === file.id}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {isDeleting === file.id ? (
                          <Spinner size="xs" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Show More / Show Less */}
              {files.length > 10 && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => setShowAllFiles(!showAllFiles)}
                  >
                    {showAllFiles ? (
                      <Trans>Show less</Trans>
                    ) : (
                      <Trans>Show all {files.length} files</Trans>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Warning for high usage */}
        {usage && !usage.isUnlimited && usage.usagePercent > 80 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {usage.usagePercent >= 100 ? (
                <Trans>Your storage is full. Delete some files to upload more.</Trans>
              ) : (
                <Trans>
                  You are using {usage.usagePercent}% of your storage. Consider deleting unused
                  files.
                </Trans>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
