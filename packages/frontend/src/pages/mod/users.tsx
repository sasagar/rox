"use client";

/**
 * Moderator Users Page
 *
 * Allows moderators to suspend, unsuspend, and warn users.
 */

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  Search,
  User,
  UserX,
  UserCheck,
  AlertTriangle,
  Shield,
  AlertCircle,
  Trash2,
  Clock,
} from "lucide-react";
import { tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { ModeratorNav } from "../../components/moderator/ModeratorNav";

interface UserData {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  host: string | null;
  isSuspended: boolean;
  isAdmin: boolean;
  createdAt: string;
}

interface UserWarning {
  id: string;
  userId: string;
  moderatorId: string;
  reason: string;
  isRead: boolean;
  readAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface UserDetailResponse {
  user: UserData;
  reports: {
    items: any[];
    total: number;
  };
  warnings: {
    items: UserWarning[];
    total: number;
  };
  moderationHistory: any[];
}

export default function ModeratorUsersPage() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetailResponse | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  // Warning state
  const [showWarningForm, setShowWarningForm] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [warningExpiresAt, setWarningExpiresAt] = useState("");
  const [isWarning, setIsWarning] = useState(false);
  const [isDeletingWarning, setIsDeletingWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
    }
  }, [token]);

  const searchUser = async () => {
    if (!token || !searchQuery.trim()) return;

    setIsLoadingUser(true);
    setError(null);
    setSelectedUser(null);

    try {
      apiClient.setToken(token);
      // First resolve the user
      const resolveResponse = await apiClient.get<{ id: string }>(
        `/api/users/resolve?acct=${encodeURIComponent(searchQuery.trim())}`,
      );

      // Then get the user details from moderation endpoint
      const userDetail = await apiClient.get<UserDetailResponse>(
        `/api/mod/users/${resolveResponse.id}`,
      );
      setSelectedUser(userDetail);
    } catch (err: any) {
      console.error("Failed to find user:", err);
      if (err.status === 404) {
        setError(t`User not found`);
      } else if (err.status === 403) {
        setError(t`Moderator access required`);
      } else {
        setError(err.message || t`Failed to find user`);
      }
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleSuspend = async () => {
    if (!token || !selectedUser) return;

    setIsProcessing(true);
    try {
      apiClient.setToken(token);
      await apiClient.post(`/api/mod/users/${selectedUser.user.id}/suspend`, {
        reason: suspendReason.trim() || undefined,
      });

      addToast({
        type: "success",
        message: t`User suspended successfully`,
      });

      // Refresh user data
      const userDetail = await apiClient.get<UserDetailResponse>(
        `/api/mod/users/${selectedUser.user.id}`,
      );
      setSelectedUser(userDetail);
      setSuspendReason("");
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to suspend user`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!token || !selectedUser) return;

    setIsProcessing(true);
    try {
      apiClient.setToken(token);
      await apiClient.post(`/api/mod/users/${selectedUser.user.id}/unsuspend`, {
        reason: suspendReason.trim() || undefined,
      });

      addToast({
        type: "success",
        message: t`User unsuspended successfully`,
      });

      // Refresh user data
      const userDetail = await apiClient.get<UserDetailResponse>(
        `/api/mod/users/${selectedUser.user.id}`,
      );
      setSelectedUser(userDetail);
      setSuspendReason("");
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to unsuspend user`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWarnUser = async () => {
    if (!token || !selectedUser || !warningReason.trim()) return;

    setIsWarning(true);
    try {
      apiClient.setToken(token);
      await apiClient.post(`/api/mod/users/${selectedUser.user.id}/warn`, {
        reason: warningReason.trim(),
        expiresAt: warningExpiresAt || undefined,
      });

      addToast({
        type: "success",
        message: t`Warning issued successfully`,
      });

      // Refresh user data
      const userDetail = await apiClient.get<UserDetailResponse>(
        `/api/mod/users/${selectedUser.user.id}`,
      );
      setSelectedUser(userDetail);
      setWarningReason("");
      setWarningExpiresAt("");
      setShowWarningForm(false);
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to issue warning`,
      });
    } finally {
      setIsWarning(false);
    }
  };

  const handleDeleteWarning = async (warningId: string) => {
    if (!token || !selectedUser) return;

    setIsDeletingWarning(warningId);
    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/mod/warnings/${warningId}`);

      addToast({
        type: "success",
        message: t`Warning deleted successfully`,
      });

      // Refresh user data
      const userDetail = await apiClient.get<UserDetailResponse>(
        `/api/mod/users/${selectedUser.user.id}`,
      );
      setSelectedUser(userDetail);
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to delete warning`,
      });
    } finally {
      setIsDeletingWarning(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isWarningExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-(--text-primary)">
            <Trans>User Moderation</Trans>
          </h1>
          <p className="text-(--text-secondary) mt-2">
            <Trans>Search for users and manage suspensions</Trans>
          </p>
        </div>

        <ModeratorNav currentPath="/mod/users" />

        {/* Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              <Trans>Search User</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchUser()}
                  placeholder={t`Enter username (e.g., alice or alice@remote.server)`}
                  className="w-full px-4 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <Button onPress={searchUser} isDisabled={isLoadingUser || !searchQuery.trim()}>
                {isLoadingUser ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    <Trans>Search</Trans>
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div className="mt-3">
                <InlineError message={error} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Details */}
        {selectedUser && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                <Trans>User Details</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* User Info */}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-(--bg-secondary) flex items-center justify-center overflow-hidden">
                    {selectedUser.user.avatarUrl ? (
                      <img
                        src={selectedUser.user.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-(--text-muted)" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-(--text-primary)">
                        {selectedUser.user.displayName || selectedUser.user.username}
                      </h3>
                      {selectedUser.user.isAdmin && (
                        <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          <Shield className="w-3 h-3 inline mr-1" />
                          Admin
                        </span>
                      )}
                      {selectedUser.user.isSuspended && (
                        <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <UserX className="w-3 h-3 inline mr-1" />
                          <Trans>Suspended</Trans>
                        </span>
                      )}
                    </div>
                    <p className="text-(--text-muted)">
                      @{selectedUser.user.username}
                      {selectedUser.user.host && `@${selectedUser.user.host}`}
                    </p>
                    <p className="text-sm text-(--text-muted) mt-1">
                      <Trans>Joined: {formatDate(selectedUser.user.createdAt)}</Trans>
                    </p>
                  </div>
                </div>

                {/* Reports count */}
                {selectedUser.reports.total > 0 && (
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">
                        <Trans>{selectedUser.reports.total} reports against this user</Trans>
                      </span>
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {selectedUser.warnings && selectedUser.warnings.total > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-(--text-secondary) mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <Trans>Warnings ({selectedUser.warnings.total})</Trans>
                    </h4>
                    <div className="space-y-2">
                      {selectedUser.warnings.items.map((warning) => (
                        <div
                          key={warning.id}
                          className={`p-3 rounded-lg border text-sm ${
                            isWarningExpired(warning.expiresAt)
                              ? "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700 opacity-60"
                              : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-(--text-primary)">{warning.reason}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-(--text-muted)">
                                <span>{formatDate(warning.createdAt)}</span>
                                {warning.expiresAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {isWarningExpired(warning.expiresAt) ? (
                                      <Trans>Expired</Trans>
                                    ) : (
                                      <Trans>Expires: {formatDate(warning.expiresAt)}</Trans>
                                    )}
                                  </span>
                                )}
                                {warning.isRead && (
                                  <span className="text-green-600 dark:text-green-400">
                                    <Trans>Read</Trans>
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteWarning(warning.id)}
                              disabled={isDeletingWarning === warning.id}
                              className="p-1 text-(--text-muted) hover:text-red-500 disabled:opacity-50"
                              title={t`Delete warning`}
                            >
                              {isDeletingWarning === warning.id ? (
                                <Spinner size="sm" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Moderation History */}
                {selectedUser.moderationHistory.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-(--text-secondary) mb-2">
                      <Trans>Recent Moderation History</Trans>
                    </h4>
                    <div className="space-y-2">
                      {selectedUser.moderationHistory.slice(0, 5).map((log: any) => (
                        <div key={log.id} className="p-3 rounded-lg bg-(--bg-secondary) text-sm">
                          <span className="font-medium text-(--text-primary)">{log.action}</span>
                          {log.reason && (
                            <span className="text-(--text-muted)"> - {log.reason}</span>
                          )}
                          <p className="text-xs text-(--text-muted) mt-1">
                            {formatDate(log.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!selectedUser.user.isAdmin && (
                  <div className="pt-4 border-t border-(--border-color)">
                    <h4 className="text-sm font-medium text-(--text-secondary) mb-3">
                      <Trans>Actions</Trans>
                    </h4>
                    <div className="space-y-4">
                      {/* Suspend/Unsuspend Section */}
                      <div>
                        <label className="block text-sm text-(--text-muted) mb-1">
                          <Trans>Reason (optional)</Trans>
                        </label>
                        <textarea
                          value={suspendReason}
                          onChange={(e) => setSuspendReason(e.target.value)}
                          placeholder={t`Enter reason for action...`}
                          className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-3">
                        {selectedUser.user.isSuspended ? (
                          <Button
                            variant="primary"
                            onPress={handleUnsuspend}
                            isDisabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-2" />
                                <Trans>Unsuspend User</Trans>
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            onPress={handleSuspend}
                            isDisabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <UserX className="w-4 h-4 mr-2" />
                                <Trans>Suspend User</Trans>
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Warning Section */}
                      <div className="pt-4 border-t border-(--border-color)">
                        <h5 className="text-sm font-medium text-(--text-secondary) mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          <Trans>Issue Warning</Trans>
                        </h5>
                        {showWarningForm ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm text-(--text-muted) mb-1">
                                <Trans>Warning Reason (required)</Trans>
                              </label>
                              <textarea
                                value={warningReason}
                                onChange={(e) => setWarningReason(e.target.value)}
                                placeholder={t`Describe the reason for this warning...`}
                                className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                rows={3}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-(--text-muted) mb-1">
                                <Trans>Expiration Date (optional)</Trans>
                              </label>
                              <input
                                type="datetime-local"
                                value={warningExpiresAt}
                                onChange={(e) => setWarningExpiresAt(e.target.value)}
                                className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <p className="text-xs text-(--text-muted) mt-1">
                                <Trans>Leave empty for a permanent warning</Trans>
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <Button
                                variant="primary"
                                onPress={handleWarnUser}
                                isDisabled={isWarning || !warningReason.trim()}
                              >
                                {isWarning ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <>
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    <Trans>Issue Warning</Trans>
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="secondary"
                                onPress={() => {
                                  setShowWarningForm(false);
                                  setWarningReason("");
                                  setWarningExpiresAt("");
                                }}
                                isDisabled={isWarning}
                              >
                                <Trans>Cancel</Trans>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="secondary" onPress={() => setShowWarningForm(true)}>
                            <AlertCircle className="w-4 h-4 mr-2" />
                            <Trans>Warn User</Trans>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedUser.user.isAdmin && (
                  <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <p className="text-purple-800 dark:text-purple-200">
                      <Shield className="w-4 h-4 inline mr-2" />
                      <Trans>Admin users cannot be suspended</Trans>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
