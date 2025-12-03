"use client";

/**
 * Moderator Audit Logs Page
 *
 * Allows moderators to view moderation audit logs.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  RefreshCw,
  History,
  User,
  FileText,
  AlertTriangle,
  Shield,
  UserX,
  UserCheck,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { Layout } from "../../components/layout/Layout";
import { ModeratorNav } from "../../components/moderator/ModeratorNav";

interface AuditLog {
  id: string;
  moderatorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  details: Record<string, any> | null;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

const ACTION_ICONS: Record<string, any> = {
  delete_note: Trash2,
  restore_note: RotateCcw,
  suspend_user: UserX,
  unsuspend_user: UserCheck,
  resolve_report: AlertTriangle,
  reject_report: AlertTriangle,
  assign_role: Shield,
  unassign_role: Shield,
};

const ACTION_LABELS: Record<string, string> = {
  delete_note: "Delete Note",
  restore_note: "Restore Note",
  suspend_user: "Suspend User",
  unsuspend_user: "Unsuspend User",
  resolve_report: "Resolve Report",
  reject_report: "Reject Report",
  assign_role: "Assign Role",
  unassign_role: "Remove Role",
  warn_user: "Warn User",
  block_instance: "Block Instance",
  unblock_instance: "Unblock Instance",
};

const TARGET_TYPE_ICONS: Record<string, any> = {
  note: FileText,
  user: User,
  report: AlertTriangle,
  role: Shield,
};

export default function ModeratorAuditLogsPage() {
  const [token] = useAtom(tokenAtom);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("");
  const limit = 50;

  const loadLogs = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      apiClient.setToken(token);
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (actionFilter) params.set("action", actionFilter);
      if (targetTypeFilter) params.set("targetType", targetTypeFilter);

      const response = await apiClient.get<AuditLogsResponse>(`/api/mod/audit-logs?${params}`);
      setLogs(response.logs);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      setError("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [token, offset, actionFilter, targetTypeFilter]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        await loadLogs();
      } catch (err: any) {
        console.error("Access check failed:", err);
        if (err.status === 403) {
          setError("Moderator access required");
        } else {
          setError("Access denied");
        }
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadLogs]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || History;
    return <Icon className="w-4 h-4" />;
  };

  const getTargetTypeIcon = (targetType: string) => {
    const Icon = TARGET_TYPE_ICONS[targetType] || FileText;
    return <Icon className="w-3 h-3" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("delete") || action.includes("suspend") || action.includes("reject")) {
      return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
    }
    if (action.includes("restore") || action.includes("unsuspend") || action.includes("resolve")) {
      return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
    }
    return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
  };

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  if (isLoading && logs.length === 0) {
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-(--text-primary)">
            <Trans>Audit Logs</Trans>
          </h1>
          <p className="text-(--text-secondary) mt-2">
            <Trans>View all moderation actions</Trans>
          </p>
        </div>

        <ModeratorNav currentPath="/mod/audit-logs" />

        <div className="grid grid-cols-1 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <History className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-(--text-primary)">{total}</div>
                  <div className="text-sm text-(--text-muted)">
                    <Trans>Total Actions</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <CardTitle>
              <Trans>Action Log</Trans>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setOffset(0);
                }}
                className="px-3 py-1 text-sm border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t`All Actions`}</option>
                <option value="delete_note">{t`Delete Note`}</option>
                <option value="restore_note">{t`Restore Note`}</option>
                <option value="suspend_user">{t`Suspend User`}</option>
                <option value="unsuspend_user">{t`Unsuspend User`}</option>
                <option value="resolve_report">{t`Resolve Report`}</option>
                <option value="reject_report">{t`Reject Report`}</option>
              </select>
              <select
                value={targetTypeFilter}
                onChange={(e) => {
                  setTargetTypeFilter(e.target.value);
                  setOffset(0);
                }}
                className="px-3 py-1 text-sm border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t`All Types`}</option>
                <option value="note">{t`Notes`}</option>
                <option value="user">{t`Users`}</option>
                <option value="report">{t`Reports`}</option>
              </select>
              <Button variant="ghost" size="sm" onPress={loadLogs} isDisabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
                <p className="text-(--text-muted)">
                  <Trans>No audit logs found</Trans>
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-lg border border-(--border-color) bg-(--bg-primary)"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${getActionColor(log.action)}`}
                            >
                              {getActionIcon(log.action)}
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-(--bg-secondary) text-(--text-muted)">
                              {getTargetTypeIcon(log.targetType)}
                              {log.targetType}
                            </span>
                          </div>
                          {log.reason && (
                            <p className="text-sm text-(--text-secondary) mb-2">
                              <span className="font-medium">
                                <Trans>Reason:</Trans>
                              </span>{" "}
                              {log.reason}
                            </p>
                          )}
                          <div className="text-xs text-(--text-muted)">
                            <span className="mr-4">
                              <Trans>Target ID:</Trans> {log.targetId.substring(0, 12)}...
                            </span>
                            <span>{formatDate(log.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-(--border-color)">
                  <div className="text-sm text-(--text-muted)">
                    <Trans>
                      Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
                    </Trans>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={handlePrevPage}
                      isDisabled={offset === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={handleNextPage}
                      isDisabled={offset + limit >= total}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
