"use client";

/**
 * Admin Federation Page
 *
 * Allows administrators to view and manage remote instances that this server has federated with.
 * Shows instance metadata, fetch status, and error information.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  RefreshCw,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Server,
  Clock,
  Trash2,
} from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";
import { Layout } from "../../components/layout/Layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { AdminNav } from "../../components/admin/AdminNav";

interface RemoteInstance {
  host: string;
  softwareName: string | null;
  softwareVersion: string | null;
  name: string | null;
  description: string | null;
  iconUrl: string | null;
  themeColor: string | null;
  openRegistrations: boolean | null;
  usersCount: number | null;
  notesCount: number | null;
  isBlocked: boolean;
  lastFetchedAt: string | null;
  fetchErrorCount: number;
  lastFetchError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InstancesResponse {
  instances: RemoteInstance[];
  total: number;
}

export default function AdminFederationPage() {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [instances, setInstances] = useState<RemoteInstance[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshingHost, setRefreshingHost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "healthy" | "errors">("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const loadInstances = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<InstancesResponse>(
        `/api/admin/remote-instances?limit=${pageSize}&offset=${page * pageSize}`,
      );
      setInstances(response.instances);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load remote instances:", err);
      setError("Failed to load remote instances");
    } finally {
      setIsLoading(false);
    }
  }, [token, page]);

  // Check admin access and load instances
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

        await loadInstances();
      } catch (err) {
        console.error("Access check failed:", err);
        setError("Access denied");
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadInstances, setCurrentUser]);

  const handleRefresh = async (host: string) => {
    if (!token) return;

    setRefreshingHost(host);
    try {
      apiClient.setToken(token);
      const response = await apiClient.post<{ success: boolean; message: string; instance: RemoteInstance }>(
        `/api/admin/remote-instances/${encodeURIComponent(host)}/refresh`,
      );

      addToast({
        type: response.instance.fetchErrorCount > 0 ? "info" : "success",
        message: response.message,
      });

      // Update the instance in the list
      setInstances((prev) =>
        prev.map((inst) => (inst.host === host ? response.instance : inst)),
      );
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to refresh instance`,
      });
    } finally {
      setRefreshingHost(null);
    }
  };

  const handleDelete = async (host: string) => {
    if (!token) return;

    if (!window.confirm(t`Are you sure you want to remove this instance from the cache?`)) {
      return;
    }

    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/admin/remote-instances/${encodeURIComponent(host)}`);

      addToast({
        type: "success",
        message: t`Instance removed from cache`,
      });

      // Remove from list
      setInstances((prev) => prev.filter((inst) => inst.host !== host));
      setTotal((prev) => prev - 1);
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to remove instance`,
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (instance: RemoteInstance) => {
    if (instance.fetchErrorCount >= 5) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (instance.fetchErrorCount > 0) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    if (instance.lastFetchedAt) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const filteredInstances = instances.filter((inst) => {
    if (filter === "healthy") {
      return inst.fetchErrorCount === 0 && inst.lastFetchedAt;
    }
    if (filter === "errors") {
      return inst.fetchErrorCount > 0;
    }
    return true;
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <InlineError message={error} />
      </Layout>
    );
  }

  const errorCount = instances.filter((i) => i.fetchErrorCount > 0).length;

  return (
    <Layout>
      <PageHeader
        title={<Trans>Federation</Trans>}
        subtitle={<Trans>Manage remote instances and federation status</Trans>}
        icon={<Globe className="w-6 h-6" />}
        actions={[
          {
            key: "refresh",
            label: <Trans>Refresh List</Trans>,
            icon: <RefreshCw className="w-4 h-4" />,
            onPress: () => loadInstances(),
            variant: "secondary",
          },
        ]}
      />

      <AdminNav currentPath="/admin/federation" />

      <div className="space-y-6">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Server className="w-8 h-8 text-primary-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <Trans>Known Instances</Trans>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {instances.filter((i) => i.fetchErrorCount === 0 && i.lastFetchedAt).length}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <Trans>Healthy</Trans>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{errorCount}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <Trans>With Errors</Trans>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "all"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Trans>All</Trans> ({total})
          </button>
          <button
            onClick={() => setFilter("healthy")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "healthy"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Trans>Healthy</Trans>
          </button>
          <button
            onClick={() => setFilter("errors")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === "errors"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Trans>With Errors</Trans> ({errorCount})
          </button>
        </div>

        {/* Instances List */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Remote Instances</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredInstances.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Trans>No instances found</Trans>
              </p>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInstances.map((instance) => (
                  <div
                    key={instance.host}
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Instance Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(instance)}
                          {instance.iconUrl && (
                            <img
                              src={getProxiedImageUrl(instance.iconUrl) || ""}
                              alt=""
                              className="w-5 h-5 rounded"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          )}
                          <a
                            href={`https://${instance.host}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-gray-900 dark:text-gray-100 hover:underline truncate"
                          >
                            {instance.name || instance.host}
                          </a>
                          {instance.isBlocked && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                              <Trans>Blocked</Trans>
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {instance.host}
                          {instance.softwareName && (
                            <span className="ml-2">
                              ({instance.softwareName}
                              {instance.softwareVersion && ` ${instance.softwareVersion}`})
                            </span>
                          )}
                        </p>

                        {instance.description && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                            {instance.description}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          {instance.usersCount !== null && (
                            <span>
                              <Trans>Users</Trans>: {instance.usersCount.toLocaleString()}
                            </span>
                          )}
                          {instance.notesCount !== null && (
                            <span>
                              <Trans>Posts</Trans>: {instance.notesCount.toLocaleString()}
                            </span>
                          )}
                          <span>
                            <Trans>Last fetched</Trans>: {formatDate(instance.lastFetchedAt)}
                          </span>
                        </div>

                        {/* Error Info */}
                        {instance.fetchErrorCount > 0 && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                            <p className="text-red-800 dark:text-red-200 font-medium">
                              <Trans>Fetch errors</Trans>: {instance.fetchErrorCount}
                            </p>
                            {instance.lastFetchError && (
                              <p className="text-red-600 dark:text-red-300 mt-1 text-xs break-all">
                                {instance.lastFetchError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onPress={() => handleRefresh(instance.host)}
                          isDisabled={refreshingHost === instance.host}
                        >
                          {refreshingHost === instance.host ? (
                            <Spinner size="sm" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span className="ml-1 sm:hidden">
                            <Trans>Refresh</Trans>
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleDelete(instance.host)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="ml-1 sm:hidden">
                            <Trans>Remove</Trans>
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  isDisabled={page === 0}
                >
                  <Trans>Previous</Trans>
                </Button>
                <span className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {page + 1} / {Math.ceil(total / pageSize)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setPage((p) => p + 1)}
                  isDisabled={(page + 1) * pageSize >= total}
                >
                  <Trans>Next</Trans>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
