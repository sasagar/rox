"use client";

/**
 * Admin Storage Management Page
 *
 * Allows administrators to:
 * - View instance-wide storage statistics
 * - Manage system files (emojis, etc.)
 * - View and manage user storage
 * - Adjust user storage quotas
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  HardDrive,
  Trash2,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  File,
  Users,
  Settings,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { AdminNav } from "../../components/admin/AdminNav";
import type { DriveFile } from "shared";

interface InstanceStorageStats {
  totalFiles: number;
  totalSize: number;
  totalSizeMB: number;
  userFiles: { count: number; size: number; sizeMB: number };
  systemFiles: { count: number; size: number; sizeMB: number };
  byType: Record<string, { count: number; size: number }>;
  topUsers: Array<{
    userId: string;
    username?: string;
    count: number;
    size: number;
    sizeMB: number;
  }>;
}

interface UserStorageDetails {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    storageQuotaMb: number | null;
  };
  files: DriveFile[];
  totalSize: number;
  fileCount: number;
  quotaMb: number;
  usagePercent: number;
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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

export default function AdminStoragePage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<InstanceStorageStats | null>(null);
  const [systemFiles, setSystemFiles] = useState<DriveFile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserStorageDetails | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSystemFiles, setShowSystemFiles] = useState(false);
  const [editingQuota, setEditingQuota] = useState<string | null>(null);
  const [newQuota, setNewQuota] = useState("");

  // Restore session and check admin
  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      if (!currentUser) {
        try {
          apiClient.setToken(token);
          const response = await apiClient.get<{ user: any }>("/api/auth/session");
          setCurrentUser(response.user);

          if (!response.user.isAdmin) {
            window.location.href = "/";
            return;
          }
        } catch (error) {
          console.error("Failed to restore session:", error);
          window.location.href = "/login";
          return;
        }
      } else if (!currentUser.isAdmin) {
        window.location.href = "/";
        return;
      }

      setIsLoading(false);
    };
    restoreSession();
  }, [token, currentUser, setCurrentUser]);

  const fetchStats = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const [statsData, systemFilesResponse] = await Promise.all([
        apiClient.get<InstanceStorageStats>("/api/admin/storage/stats"),
        apiClient.get<{ files: DriveFile[]; total: number }>("/api/admin/storage/system-files"),
      ]);

      setStats(statsData);
      setSystemFiles(systemFilesResponse.files);
    } catch (err: any) {
      console.error("Failed to fetch storage stats:", err);
      addToast({
        type: "error",
        message: err.message || t`Failed to load storage statistics`,
      });
    }
  }, [token, addToast]);

  useEffect(() => {
    if (!isLoading && currentUser?.isAdmin) {
      fetchStats();
    }
  }, [isLoading, currentUser, fetchStats]);

  const fetchUserDetails = async (userId: string) => {
    if (!token) return;

    setIsLoadingUser(true);
    try {
      apiClient.setToken(token);
      const data = await apiClient.get<UserStorageDetails>(`/api/admin/storage/users/${userId}`);
      setSelectedUser(data);
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to load user storage details`,
      });
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!token) return;

    setIsDeleting(fileId);
    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/admin/storage/files/${fileId}`);

      // Remove from local state
      setSystemFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (selectedUser) {
        setSelectedUser({
          ...selectedUser,
          files: selectedUser.files.filter((f) => f.id !== fileId),
          fileCount: selectedUser.fileCount - 1,
        });
      }

      // Refresh stats
      await fetchStats();

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

  const handleUpdateQuota = async (userId: string) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const quotaValue = newQuota === "" || newQuota === "-1" ? -1 : parseInt(newQuota, 10);

      await apiClient.patch(`/api/admin/storage/users/${userId}/quota`, {
        quotaMb: quotaValue,
      });

      // Refresh user details
      await fetchUserDetails(userId);
      setEditingQuota(null);
      setNewQuota("");

      addToast({
        type: "success",
        message: t`Quota updated`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to update quota`,
      });
    }
  };

  if (isLoading || !currentUser) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!currentUser.isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  const filteredTopUsers = stats?.topUsers.filter(
    (u) =>
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.userId.includes(searchQuery)
  );

  return (
    <Layout>
      <PageHeader
        title={<Trans>Storage Management</Trans>}
        subtitle={<Trans>Manage instance storage and user quotas</Trans>}
        icon={<HardDrive className="w-6 h-6" />}
      />

      {/* Admin Navigation */}
      <AdminNav currentPath="/admin/storage" />

      {/* Instance Overview */}
      {stats && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              <Trans>Instance Overview</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <Trans>Total Files</Trans>
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.totalFiles.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <Trans>Total Size</Trans>
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatBytes(stats.totalSize)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <Trans>Users with Files</Trans>
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.topUsers.length.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <Trans>System Files</Trans>
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.systemFiles.count.toLocaleString()}
                </p>
              </div>
            </div>

            {/* By Type */}
            {Object.keys(stats.byType).length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Trans>By File Type</Trans>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {Object.entries(stats.byType).map(([type, data]) => (
                    <div
                      key={type}
                      className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md"
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
                          {data.count} ({formatBytes(data.size)})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* System Files */}
      <Card className="mb-6">
        <CardHeader>
          <button
            type="button"
            onClick={() => setShowSystemFiles(!showSystemFiles)}
            className="flex items-center gap-2 w-full text-left cursor-pointer"
          >
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <Trans>System Files</Trans>
              <span className="text-sm font-normal text-gray-500">
                ({systemFiles.length} files)
              </span>
            </CardTitle>
            {showSystemFiles ? (
              <ChevronUp className="w-4 h-4 ml-auto" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-auto" />
            )}
          </button>
        </CardHeader>
        {showSystemFiles && (
          <CardContent className="p-6 pt-0">
            {systemFiles.length === 0 ? (
              <p className="text-center py-4 text-gray-500 dark:text-gray-400">
                <Trans>No system files</Trans>
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {systemFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatBytes(file.size)} • {file.type}
                      </p>
                    </div>
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
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* User Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <Trans>User Storage</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t`Search users...`}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* User List */}
          {stats && filteredTopUsers && filteredTopUsers.length > 0 ? (
            <div className="space-y-2 mb-6">
              {filteredTopUsers.map((user) => (
                <div
                  key={user.userId}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedUser?.user.id === user.userId
                      ? "bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800"
                      : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => fetchUserDetails(user.userId)}
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full">
                    <Users className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      @{user.username ?? user.userId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user.count} files • {formatBytes(user.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-gray-500 dark:text-gray-400">
              <Trans>No users found</Trans>
            </p>
          )}

          {/* Selected User Details */}
          {isLoadingUser && (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          )}

          {selectedUser && !isLoadingUser && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    @{selectedUser.user.username}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedUser.fileCount} files • {formatBytes(selectedUser.totalSize)}
                  </p>
                </div>

                {/* Quota Editor */}
                <div className="flex items-center gap-2">
                  {editingQuota === selectedUser.user.id ? (
                    <>
                      <input
                        type="number"
                        value={newQuota}
                        onChange={(e) => setNewQuota(e.target.value)}
                        placeholder={t`MB (-1 for unlimited)`}
                        className="w-32 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                      />
                      <Button
                        size="sm"
                        onPress={() => handleUpdateQuota(selectedUser.user.id)}
                      >
                        <Trans>Save</Trans>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          setEditingQuota(null);
                          setNewQuota("");
                        }}
                      >
                        <Trans>Cancel</Trans>
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        setEditingQuota(selectedUser.user.id);
                        setNewQuota(
                          selectedUser.quotaMb === -1 ? "-1" : String(selectedUser.quotaMb)
                        );
                      }}
                    >
                      <Trans>
                        Quota: {selectedUser.quotaMb === -1 ? "Unlimited" : `${selectedUser.quotaMb} MB`}
                      </Trans>
                    </Button>
                  )}
                </div>
              </div>

              {/* Usage Bar */}
              {selectedUser.quotaMb !== -1 && (
                <div className="mb-4">
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        selectedUser.usagePercent > 90
                          ? "bg-red-500"
                          : selectedUser.usagePercent > 70
                            ? "bg-yellow-500"
                            : "bg-primary-500"
                      }`}
                      style={{ width: `${Math.min(selectedUser.usagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedUser.usagePercent}% used
                  </p>
                </div>
              )}

              {/* User Files */}
              {selectedUser.files.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedUser.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatBytes(file.size)} • {file.type}
                        </p>
                      </div>
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
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
