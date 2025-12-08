"use client";

/**
 * Admin Users Page
 *
 * Allows administrators to view and manage users.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  RefreshCw,
  Users,
  User,
  Shield,
  Ban,
  Trash2,
  Search,
  Globe,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { AdminNav } from "../../components/admin/AdminNav";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  host: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
}

export default function AdminUsersPage() {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [localOnly, setLocalOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleteNotes, setDeleteNotes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (localOnly) {
        params.set("localOnly", "true");
      }
      const response = await apiClient.get<UsersResponse>(
        `/api/admin/users?${params}`,
      );
      setUsers(response.users);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [token, localOnly]);

  // Check admin access and load users
  useEffect(() => {
    const checkAccess = async () => {
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

        await loadUsers();
      } catch (err) {
        console.error("Access check failed:", err);
        setError("Access denied");
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadUsers, setCurrentUser]);

  const handleToggleSuspend = async (user: AdminUser) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      await apiClient.post(`/api/admin/users/${user.id}/suspend`, {
        isSuspended: !user.isSuspended,
      });

      addToast({
        type: "success",
        message: user.isSuspended
          ? t`User unsuspended`
          : t`User suspended`,
      });

      await loadUsers();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to update user`,
      });
    }
  };

  const handleToggleAdmin = async (user: AdminUser) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      await apiClient.post(`/api/admin/users/${user.id}/admin`, {
        isAdmin: !user.isAdmin,
      });

      addToast({
        type: "success",
        message: user.isAdmin
          ? t`Admin status removed`
          : t`Admin status granted`,
      });

      await loadUsers();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to update user`,
      });
    }
  };

  const handleDelete = async () => {
    if (!token || !userToDelete) return;

    setIsDeleting(true);
    try {
      apiClient.setToken(token);
      const params = deleteNotes ? "?deleteNotes=true" : "";
      const response = await apiClient.delete<{
        success: boolean;
        message: string;
        activitiesSent?: number;
      }>(`/api/admin/users/${userToDelete.id}${params}`);

      addToast({
        type: "success",
        message: response.activitiesSent
          ? t`User deleted. ${response.activitiesSent} Delete activities sent to followers.`
          : t`User deleted successfully`,
      });

      setUserToDelete(null);
      setDeleteNotes(false);
      await loadUsers();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to delete user`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.displayName?.toLowerCase().includes(query) ?? false)
    );
  });

  const localUsers = users.filter((u) => u.host === null);
  const remoteUsers = users.filter((u) => u.host !== null);
  const suspendedUsers = users.filter((u) => u.isSuspended);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <InlineError message={error} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-(--text-primary)">
            <Trans>Users</Trans>
          </h1>
          <p className="text-(--text-secondary) mt-2">
            <Trans>Manage user accounts</Trans>
          </p>
        </div>

        {/* Admin Navigation */}
        <AdminNav currentPath="/admin/users" />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-(--text-primary)">{total}</div>
                  <div className="text-xs text-(--text-muted)">
                    <Trans>Total</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <User className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-(--text-primary)">{localUsers.length}</div>
                  <div className="text-xs text-(--text-muted)">
                    <Trans>Local</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Globe className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-(--text-primary)">{remoteUsers.length}</div>
                  <div className="text-xs text-(--text-muted)">
                    <Trans>Remote</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Ban className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-(--text-primary)">{suspendedUsers.length}</div>
                  <div className="text-xs text-(--text-muted)">
                    <Trans>Suspended</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <Trans>User List</Trans>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-(--text-muted)" />
                <input
                  type="text"
                  placeholder={t`Search users...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1 text-sm border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-(--text-secondary)">
                <input
                  type="checkbox"
                  checked={localOnly}
                  onChange={(e) => setLocalOnly(e.target.checked)}
                  className="rounded"
                />
                <Trans>Local only</Trans>
              </label>
              <Button variant="ghost" size="sm" onPress={loadUsers}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
                <p className="text-(--text-muted)">
                  <Trans>No users found</Trans>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      user.isDeleted
                        ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                        : "border-(--border-color) bg-(--bg-primary)"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-(--bg-tertiary) flex items-center justify-center">
                          <User className="w-5 h-5 text-(--text-muted)" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-(--text-primary)">
                            @{user.username}
                            {user.host && `@${user.host}`}
                          </span>
                          {user.isAdmin && (
                            <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              <Trans>Admin</Trans>
                            </span>
                          )}
                          {user.isSuspended && (
                            <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <Trans>Suspended</Trans>
                            </span>
                          )}
                          {user.isDeleted && (
                            <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                              <Trans>Deleted</Trans>
                            </span>
                          )}
                          {user.host && (
                            <Globe className="w-4 h-4 text-(--text-muted)" />
                          )}
                        </div>
                        <div className="text-sm text-(--text-muted)">
                          {user.displayName || user.email}
                        </div>
                        <div className="text-xs text-(--text-muted)">
                          <Trans>Joined {formatDate(user.createdAt)}</Trans>
                        </div>
                      </div>
                    </div>
                    {/* Actions - only for local, non-deleted users */}
                    {user.host === null && !user.isDeleted && (
                      <div className="flex items-center gap-2">
                        {/* Toggle Admin */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleToggleAdmin(user)}
                          aria-label={user.isAdmin ? t`Remove admin` : t`Make admin`}
                        >
                          <Shield
                            className={`w-4 h-4 ${user.isAdmin ? "text-yellow-500" : "text-(--text-muted)"}`}
                          />
                        </Button>
                        {/* Toggle Suspend */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleToggleSuspend(user)}
                          aria-label={user.isSuspended ? t`Unsuspend` : t`Suspend`}
                        >
                          {user.isSuspended ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Ban className="w-4 h-4 text-(--text-muted)" />
                          )}
                        </Button>
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => setUserToDelete(user)}
                          aria-label={t`Delete user`}
                          isDisabled={user.isAdmin}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                    {/* Show deleted date for deleted users */}
                    {user.isDeleted && user.deletedAt && (
                      <div className="text-sm text-(--text-muted)">
                        <Trans>Deleted {formatDate(user.deletedAt)}</Trans>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-(--bg-primary) rounded-xl shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h2 className="text-xl font-bold text-(--text-primary)">
                    <Trans>Delete User</Trans>
                  </h2>
                </div>

                <p className="text-(--text-secondary) mb-4">
                  <Trans>
                    Are you sure you want to delete{" "}
                    <strong>@{userToDelete.username}</strong>? This action will:
                  </Trans>
                </p>

                <ul className="list-disc list-inside text-sm text-(--text-secondary) mb-4 space-y-1">
                  <li>
                    <Trans>Mark the account as deleted</Trans>
                  </li>
                  <li>
                    <Trans>Invalidate all active sessions</Trans>
                  </li>
                  <li>
                    <Trans>Remove all follow relationships</Trans>
                  </li>
                  <li>
                    <Trans>Send Delete activity to remote followers</Trans>
                  </li>
                </ul>

                <label className="flex items-center gap-2 mb-6 text-(--text-secondary)">
                  <input
                    type="checkbox"
                    checked={deleteNotes}
                    onChange={(e) => setDeleteNotes(e.target.checked)}
                    className="rounded"
                  />
                  <Trans>Also delete all notes by this user</Trans>
                </label>

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setUserToDelete(null);
                      setDeleteNotes(false);
                    }}
                    className="flex-1"
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button
                    variant="danger"
                    onPress={handleDelete}
                    isDisabled={isDeleting}
                    className="flex-1"
                  >
                    {isDeleting ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        <Trans>Delete</Trans>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
