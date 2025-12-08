"use client";

/**
 * Admin Queue Dashboard Page
 *
 * Displays job queue statistics and metrics for ActivityPub delivery.
 * Shows overall queue health, success rates, and per-server delivery metrics.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import {
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  Server,
  TrendingUp,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { Layout } from "../../components/layout/Layout";
import { AdminNav } from "../../components/admin/AdminNav";

interface QueueStats {
  available: boolean;
  message?: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  serverCount: number;
  topServers: Array<{
    inbox: string;
    host: string;
    success: number;
    failure: number;
    successRate: number;
  }>;
}

interface ServerMetric {
  host: string;
  inbox: string;
  success: number;
  failure: number;
  total: number;
  successRate: number;
}

interface QueueMetrics {
  available: boolean;
  message?: string;
  serverCount: number;
  servers: ServerMetric[];
}

export default function AdminQueuePage() {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);

  const [stats, setStats] = useState<QueueStats | null>(null);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "servers">("overview");

  const loadData = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const [statsResponse, metricsResponse] = await Promise.all([
        apiClient.get<QueueStats>("/api/admin/queue/stats"),
        apiClient.get<QueueMetrics>("/api/admin/queue/metrics"),
      ]);
      setStats(statsResponse);
      setMetrics(metricsResponse);
    } catch (err) {
      console.error("Failed to load queue data:", err);
      setError("Failed to load queue statistics");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  // Check admin access and load data
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

        await loadData();
      } catch (err) {
        console.error("Access check failed:", err);
        setError("Access denied");
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadData, setCurrentUser]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return "text-green-500";
    if (rate >= 80) return "text-yellow-500";
    return "text-red-500";
  };

  const getSuccessRateBg = (rate: number) => {
    if (rate >= 95) return "bg-green-500";
    if (rate >= 80) return "bg-yellow-500";
    return "bg-red-500";
  };

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

  // Queue not available (e.g., no Redis/Dragonfly)
  if (stats && !stats.available) {
    return (
      <Layout>
        <AdminNav currentPath="/admin/queue" />
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
                <Trans>Job Queue</Trans>
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                <Trans>Monitor ActivityPub delivery queue status</Trans>
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                <Trans>Queue Not Available</Trans>
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                {stats.message || <Trans>The job queue system is not currently configured or running.</Trans>}
              </p>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                <Trans>ActivityPub delivery is running in synchronous mode.</Trans>
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AdminNav currentPath="/admin/queue" />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
              <Trans>Job Queue</Trans>
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              <Trans>Monitor ActivityPub delivery queue status</Trans>
            </p>
          </div>
          <Button variant="secondary" onPress={handleRefresh} isDisabled={isRefreshing}>
            {isRefreshing ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            <Trans>Refresh</Trans>
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Zap className="w-8 h-8 text-primary-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatNumber(stats.totalDeliveries)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <Trans>Total Deliveries</Trans>
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
                      {formatNumber(stats.successfulDeliveries)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <Trans>Successful</Trans>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {formatNumber(stats.failedDeliveries)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <Trans>Failed</Trans>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className={`w-8 h-8 ${getSuccessRateColor(stats.successRate)}`} />
                  <div>
                    <p className={`text-2xl font-bold ${getSuccessRateColor(stats.successRate)}`}>
                      {formatPercentage(stats.successRate)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <Trans>Success Rate</Trans>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Trans>Overview</Trans>
          </button>
          <button
            onClick={() => setActiveTab("servers")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "servers"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Trans>Per Server</Trans> ({stats?.serverCount || 0})
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Servers by Delivery Count */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  <Trans>Top Servers by Delivery</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topServers.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                    <Trans>No deliveries recorded yet</Trans>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.topServers.map((server, index) => (
                      <div key={server.inbox} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-400 w-6">
                          #{index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {server.host}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                            {formatNumber(server.success + server.failure)}
                          </span>
                          <span className={`ml-2 text-xs ${getSuccessRateColor(server.successRate)}`}>
                            ({formatPercentage(server.successRate)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Queue Health Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <Trans>Queue Health</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Success Rate Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        <Trans>Overall Success Rate</Trans>
                      </span>
                      <span className={`font-semibold ${getSuccessRateColor(stats.successRate)}`}>
                        {formatPercentage(stats.successRate)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getSuccessRateBg(stats.successRate)} transition-all duration-500`}
                        style={{ width: `${stats.successRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        <Trans>Connected Servers</Trans>
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {formatNumber(stats.serverCount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        <Trans>Avg per Server</Trans>
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {stats.serverCount > 0
                          ? formatNumber(Math.round(stats.totalDeliveries / stats.serverCount))
                          : "0"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Servers Tab */}
        {activeTab === "servers" && metrics && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Server Metrics</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!metrics.available ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {metrics.message || <Trans>No metrics available</Trans>}
                </p>
              ) : metrics.servers.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <Trans>No server metrics recorded yet</Trans>
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-gray-400">
                          <Trans>Server</Trans>
                        </th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">
                          <Trans>Success</Trans>
                        </th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">
                          <Trans>Failed</Trans>
                        </th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">
                          <Trans>Total</Trans>
                        </th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-gray-400">
                          <Trans>Rate</Trans>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {metrics.servers.map((server) => (
                        <tr key={server.inbox} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-3 px-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate block max-w-48">
                              {server.host}
                            </span>
                          </td>
                          <td className="text-right py-3 px-2 text-green-600 dark:text-green-400">
                            {formatNumber(server.success)}
                          </td>
                          <td className="text-right py-3 px-2 text-red-600 dark:text-red-400">
                            {formatNumber(server.failure)}
                          </td>
                          <td className="text-right py-3 px-2 text-gray-600 dark:text-gray-300">
                            {formatNumber(server.total)}
                          </td>
                          <td className="text-right py-3 px-2">
                            <span className={getSuccessRateColor(server.successRate)}>
                              {formatPercentage(server.successRate)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
