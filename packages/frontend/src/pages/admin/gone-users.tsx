"use client";

/**
 * Admin Gone Users Page
 *
 * Allows administrators to view and manage remote users with fetch failures (410 Gone, etc.).
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Ghost, Trash2, RotateCcw, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { AdminNav } from "../../components/admin/AdminNav";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";

interface GoneUser {
  id: string;
  username: string;
  displayName: string | null;
  host: string | null;
  avatarUrl: string | null;
  goneDetectedAt: string | null;
  fetchFailureCount: number;
  lastFetchAttemptAt: string | null;
  lastFetchError: string | null;
  isDeleted: boolean;
}

interface GoneUsersResponse {
  users: GoneUser[];
  total: number;
}

export default function AdminGoneUsersPage() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [users, setUsers] = useState<GoneUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action states
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<GoneUsersResponse>("/api/admin/gone-users?limit=100");
      setUsers(response.users);
      setTotal(response.total);
      setError(null);
    } catch (err) {
      console.error("Failed to load gone users:", err);
      setError("Failed to load gone users");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const handleMarkDeleted = async (userIds?: string[]) => {
    if (!token) return;

    const idsToDelete = userIds || Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    setIsDeleting(true);
    try {
      apiClient.setToken(token);
      await apiClient.post("/api/admin/gone-users/mark-deleted", { userIds: idsToDelete });
      addToast({
        type: "success",
        message: t`Marked ${idsToDelete.length} users as deleted`,
      });
      setSelectedIds(new Set());
      loadUsers();
    } catch (err) {
      console.error("Failed to mark users as deleted:", err);
      addToast({
        type: "error",
        message: t`Failed to mark users as deleted`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearFailures = async (userIds?: string[]) => {
    if (!token) return;

    const idsToClear = userIds || Array.from(selectedIds);
    if (idsToClear.length === 0) return;

    setIsClearing(true);
    try {
      apiClient.setToken(token);
      await apiClient.post("/api/admin/gone-users/clear", { userIds: idsToClear });
      addToast({
        type: "success",
        message: t`Cleared failure status for ${idsToClear.length} users`,
      });
      setSelectedIds(new Set());
      loadUsers();
    } catch (err) {
      console.error("Failed to clear failure status:", err);
      addToast({
        type: "error",
        message: t`Failed to clear failure status`,
      });
    } finally {
      setIsClearing(false);
    }
  };

  const formatDuration = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return t`Today`;
    if (days === 1) return t`1 day ago`;
    return t`${days} days ago`;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <AdminNav currentPath="/admin/gone-users" />
          <div className="flex justify-center items-center py-16">
            <Spinner size="lg" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl">
        <PageHeader
          title={<Trans>Gone Users</Trans>}
          subtitle={<Trans>Manage remote users with fetch errors</Trans>}
          icon={<Ghost className="w-6 h-6" />}
          showReload
          onReload={() => loadUsers()}
          isReloading={isLoading}
        />

        <AdminNav currentPath="/admin/gone-users" />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trans>User List</Trans>
              <span className="text-sm font-normal text-(--text-secondary)">({total})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <InlineError message={error} />}

            {/* Description */}
            <div className="mb-4 p-3 bg-(--bg-secondary) rounded-lg text-sm text-(--text-secondary)">
              <Trans>
                These are remote users whose servers have returned errors (like 410 Gone) when trying to fetch their
                profiles. You can mark them as deleted or clear the failure status to retry fetching.
              </Trans>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-8 text-(--text-secondary)">
                <Ghost className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>
                  <Trans>No users with fetch errors found</Trans>
                </p>
              </div>
            ) : (
              <>
                {/* Bulk Actions */}
                <div className="flex items-center gap-2 mb-4 p-3 bg-(--bg-tertiary) rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={toggleSelectAll}
                    className="flex items-center gap-1"
                  >
                    {selectedIds.size === users.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <Trans>Select All</Trans>
                  </Button>
                  <span className="text-sm text-(--text-secondary)">
                    {selectedIds.size > 0 && <Trans>{selectedIds.size} selected</Trans>}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => handleClearFailures()}
                    isDisabled={selectedIds.size === 0 || isClearing}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    <Trans>Clear Status</Trans>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onPress={() => handleMarkDeleted()}
                    isDisabled={selectedIds.size === 0 || isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    <Trans>Mark as Deleted</Trans>
                  </Button>
                </div>

                {/* User List */}
                <div className="divide-y divide-(--border-primary)">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className={`py-3 flex items-center gap-3 ${user.isDeleted ? "opacity-50" : ""}`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleSelect(user.id)}
                        className="p-1 hover:bg-(--bg-secondary) rounded"
                      >
                        {selectedIds.has(user.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary-500" />
                        ) : (
                          <Square className="w-5 h-5 text-(--text-tertiary)" />
                        )}
                      </button>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-(--bg-secondary) flex-shrink-0">
                        {user.avatarUrl ? (
                          <img
                            src={getProxiedImageUrl(user.avatarUrl) || ""}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-(--text-tertiary)">
                            <Ghost className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {user.displayName || user.username}
                          </span>
                          {user.isDeleted && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                              <Trans>Deleted</Trans>
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-(--text-secondary) truncate">
                          @{user.username}@{user.host}
                        </div>
                      </div>

                      {/* Error Info */}
                      <div className="text-right text-sm flex-shrink-0">
                        <div className="flex items-center justify-end gap-1 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span>{user.lastFetchError || "Unknown error"}</span>
                        </div>
                        <div className="text-(--text-tertiary) text-xs">
                          <Trans>First detected</Trans>: {formatDuration(user.goneDetectedAt)}
                        </div>
                        <div className="text-(--text-tertiary) text-xs">
                          <Trans>Failures</Trans>: {user.fetchFailureCount}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleClearFailures([user.id])}
                          isDisabled={isClearing}
                          aria-label={t`Clear failure status`}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleMarkDeleted([user.id])}
                          isDisabled={isDeleting || user.isDeleted}
                          aria-label={t`Mark as deleted`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
