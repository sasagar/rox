"use client";

/**
 * Moderator Reports Page
 *
 * Allows moderators to view and manage user reports.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  ExternalLink,
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

interface UserReport {
  id: string;
  reporterId: string;
  targetUserId: string | null;
  targetNoteId: string | null;
  reason: string;
  comment: string | null;
  status: "pending" | "resolved" | "rejected";
  resolvedById: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter?: { id: string; username: string };
  targetUser?: { id: string; username: string; host: string | null };
  targetNote?: { id: string; text: string };
}

interface ReportsResponse {
  reports: UserReport[];
  total: number;
  pendingCount: number;
}

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate_speech: "Hate Speech",
  violence: "Violence",
  nsfw: "NSFW Content",
  impersonation: "Impersonation",
  copyright: "Copyright Violation",
  other: "Other",
};

export default function ModeratorReportsPage() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [reports, setReports] = useState<UserReport[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved" | "rejected">(
    "pending",
  );
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionText, setResolutionText] = useState("");

  const loadReports = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      const response = await apiClient.get<ReportsResponse>(
        `/api/mod/reports${params.toString() ? `?${params}` : ""}`,
      );
      setReports(response.reports);
      setTotal(response.total);
      setPendingCount(response.pendingCount);
    } catch (err) {
      console.error("Failed to load reports:", err);
      setError("Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        apiClient.setToken(token);
        // The mod API will check for moderator access
        await loadReports();
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
  }, [token, loadReports]);

  const loadReportDetail = async (id: string) => {
    if (!token) return;

    setIsLoadingDetail(true);
    try {
      apiClient.setToken(token);
      const detail = await apiClient.get<UserReport>(`/api/mod/reports/${id}`);
      setSelectedReport(detail);
      setResolutionText("");
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to load report details`,
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleResolve = async (status: "resolved" | "rejected") => {
    if (!token || !selectedReport) return;

    setIsResolving(true);
    try {
      apiClient.setToken(token);
      await apiClient.post(`/api/mod/reports/${selectedReport.id}/resolve`, {
        status,
        resolution: resolutionText.trim() || undefined,
      });

      addToast({
        type: "success",
        message: status === "resolved" ? t`Report resolved` : t`Report rejected`,
      });

      setSelectedReport(null);
      await loadReports();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to process report`,
      });
    } finally {
      setIsResolving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "resolved":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "resolved":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "rejected":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "";
    }
  };

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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-(--text-primary)">
            <Trans>Moderation Dashboard</Trans>
          </h1>
          <p className="text-(--text-secondary) mt-2">
            <Trans>Review and manage user reports</Trans>
          </p>
        </div>

        <ModeratorNav currentPath="/mod/reports" />

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-(--text-primary)">{pendingCount}</div>
                  <div className="text-sm text-(--text-muted)">
                    <Trans>Pending Reports</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-(--text-primary)">{total}</div>
                  <div className="text-sm text-(--text-muted)">
                    <Trans>Total Reports</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <Trans>Report List</Trans>
            </CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1 text-sm border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">{t`All`}</option>
                <option value="pending">{t`Pending`}</option>
                <option value="resolved">{t`Resolved`}</option>
                <option value="rejected">{t`Rejected`}</option>
              </select>
              <Button variant="ghost" size="sm" onPress={loadReports}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
                <p className="text-(--text-muted)">
                  <Trans>No reports found</Trans>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-(--border-color) bg-(--bg-primary) hover:bg-(--bg-secondary) cursor-pointer transition-colors"
                    onClick={() => loadReportDetail(report.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(report.status)}
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${getStatusBadgeClass(report.status)}`}
                        >
                          {report.status}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {REASON_LABELS[report.reason] || report.reason}
                        </span>
                      </div>
                      <div className="text-sm text-(--text-secondary)">
                        {report.targetUserId && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <Trans>User Report</Trans>
                          </span>
                        )}
                        {report.targetNoteId && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <Trans>Note Report</Trans>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-(--text-muted) mt-1">
                        {formatDate(report.createdAt)}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-(--text-muted)" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-(--bg-primary) rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-(--text-primary)">
                    <Trans>Report Details</Trans>
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => setSelectedReport(null)}
                    aria-label={t`Close`}
                  >
                    <XCircle className="w-5 h-5" />
                  </Button>
                </div>

                {isLoadingDetail ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 text-sm rounded-full ${getStatusBadgeClass(selectedReport.status)}`}
                      >
                        {selectedReport.status}
                      </span>
                      <span className="px-3 py-1 text-sm rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {REASON_LABELS[selectedReport.reason] || selectedReport.reason}
                      </span>
                    </div>

                    {selectedReport.reporter && (
                      <div>
                        <label className="block text-sm font-medium text-(--text-muted) mb-1">
                          <Trans>Reporter</Trans>
                        </label>
                        <div className="flex items-center gap-2 text-(--text-primary)">
                          <User className="w-4 h-4" />
                          <a
                            href={`/@${selectedReport.reporter.username}`}
                            className="hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            @{selectedReport.reporter.username}
                          </a>
                        </div>
                      </div>
                    )}

                    {selectedReport.targetUser && (
                      <div>
                        <label className="block text-sm font-medium text-(--text-muted) mb-1">
                          <Trans>Reported User</Trans>
                        </label>
                        <div className="flex items-center gap-2 text-(--text-primary)">
                          <User className="w-4 h-4" />
                          <a
                            href={`/@${selectedReport.targetUser.username}${selectedReport.targetUser.host ? `@${selectedReport.targetUser.host}` : ""}`}
                            className="hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            @{selectedReport.targetUser.username}
                            {selectedReport.targetUser.host && `@${selectedReport.targetUser.host}`}
                          </a>
                        </div>
                      </div>
                    )}

                    {selectedReport.targetNote && (
                      <div>
                        <label className="block text-sm font-medium text-(--text-muted) mb-1">
                          <Trans>Reported Note</Trans>
                        </label>
                        <div className="p-3 rounded-lg bg-(--bg-secondary) border border-(--border-color)">
                          <p className="text-(--text-primary) whitespace-pre-wrap">
                            {selectedReport.targetNote.text || (
                              <span className="text-(--text-muted) italic">
                                <Trans>No text content</Trans>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedReport.comment && (
                      <div>
                        <label className="block text-sm font-medium text-(--text-muted) mb-1">
                          <Trans>Additional Comment</Trans>
                        </label>
                        <div className="p-3 rounded-lg bg-(--bg-secondary) border border-(--border-color)">
                          <p className="text-(--text-primary) whitespace-pre-wrap">
                            {selectedReport.comment}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-(--text-muted)">
                      <p>
                        <Trans>Created: {formatDate(selectedReport.createdAt)}</Trans>
                      </p>
                      {selectedReport.resolvedAt && (
                        <p>
                          <Trans>Resolved: {formatDate(selectedReport.resolvedAt)}</Trans>
                        </p>
                      )}
                    </div>

                    {selectedReport.status !== "pending" && selectedReport.resolution && (
                      <div>
                        <label className="block text-sm font-medium text-(--text-muted) mb-1">
                          <Trans>Resolution</Trans>
                        </label>
                        <div className="p-3 rounded-lg bg-(--bg-secondary) border border-(--border-color)">
                          <p className="text-(--text-primary)">{selectedReport.resolution}</p>
                        </div>
                      </div>
                    )}

                    {selectedReport.status === "pending" && (
                      <div className="space-y-4 pt-4 border-t border-(--border-color)">
                        <div>
                          <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                            <Trans>Resolution Notes</Trans>
                          </label>
                          <textarea
                            value={resolutionText}
                            onChange={(e) => setResolutionText(e.target.value)}
                            placeholder={t`Add notes about the action taken...`}
                            className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-3">
                          <Button
                            onPress={() => handleResolve("resolved")}
                            isDisabled={isResolving}
                            className="flex-1"
                          >
                            {isResolving ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                <Trans>Resolve</Trans>
                              </>
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            onPress={() => handleResolve("rejected")}
                            isDisabled={isResolving}
                            className="flex-1"
                          >
                            {isResolving ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 mr-2" />
                                <Trans>Reject</Trans>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
