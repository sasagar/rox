"use client";

/**
 * Moderator Instance Blocks Page
 *
 * Allows moderators to manage blocked instances.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  RefreshCw,
  Globe,
  Shield,
  ShieldOff,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
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

interface InstanceBlock {
  id: string;
  host: string;
  reason: string | null;
  blockedById: string;
  createdAt: string;
}

interface InstanceBlocksResponse {
  blocks: InstanceBlock[];
  total: number;
}

interface CheckBlockResponse {
  host: string;
  isBlocked: boolean;
  block: InstanceBlock | null;
}

export default function ModeratorInstanceBlocksPage() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [blocks, setBlocks] = useState<InstanceBlock[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Form state for adding new block
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHost, setNewHost] = useState("");
  const [newReason, setNewReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check block state
  const [checkHost, setCheckHost] = useState("");
  const [checkResult, setCheckResult] = useState<CheckBlockResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const loadBlocks = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      apiClient.setToken(token);
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));

      const response = await apiClient.get<InstanceBlocksResponse>(
        `/api/mod/instance-blocks?${params}`,
      );
      setBlocks(response.blocks);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load instance blocks:", err);
      setError("Failed to load instance blocks");
    } finally {
      setIsLoading(false);
    }
  }, [token, offset]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        await loadBlocks();
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
  }, [token, loadBlocks]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleAddBlock = async () => {
    if (!token || !newHost.trim()) return;

    setIsSubmitting(true);
    try {
      apiClient.setToken(token);
      await apiClient.post("/api/mod/instance-blocks", {
        host: newHost.trim(),
        reason: newReason.trim() || undefined,
      });

      addToast({
        type: "success",
        message: t`Instance blocked successfully`,
      });

      // Reset form and reload
      setNewHost("");
      setNewReason("");
      setShowAddForm(false);
      await loadBlocks();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to block instance`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnblock = async (host: string) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/mod/instance-blocks/${encodeURIComponent(host)}`);

      addToast({
        type: "success",
        message: t`Instance unblocked successfully`,
      });

      await loadBlocks();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to unblock instance`,
      });
    }
  };

  const handleCheckBlock = async () => {
    if (!token || !checkHost.trim()) return;

    setIsChecking(true);
    setCheckResult(null);
    try {
      apiClient.setToken(token);
      const result = await apiClient.get<CheckBlockResponse>(
        `/api/mod/instance-blocks/check?host=${encodeURIComponent(checkHost.trim())}`,
      );
      setCheckResult(result);
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to check instance`,
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  if (isLoading && blocks.length === 0) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-100">
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
            <Trans>Instance Blocks</Trans>
          </h1>
          <p className="text-(--text-secondary) mt-2">
            <Trans>Manage blocked instances</Trans>
          </p>
        </div>

        <ModeratorNav currentPath="/mod/instances" />

        {/* Stats Card */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-(--text-primary)">{total}</div>
                  <div className="text-sm text-(--text-muted)">
                    <Trans>Blocked Instances</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Check Instance Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              <Trans>Check Instance</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={checkHost}
                  onChange={(e) => setCheckHost(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCheckBlock()}
                  placeholder={t`Enter instance hostname (e.g., spam.example.com)`}
                  className="w-full px-4 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <Button onPress={handleCheckBlock} isDisabled={isChecking || !checkHost.trim()}>
                {isChecking ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    <Trans>Check</Trans>
                  </>
                )}
              </Button>
            </div>
            {checkResult && (
              <div
                className={`mt-4 p-4 rounded-lg ${checkResult.isBlocked ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"}`}
              >
                <div className="flex items-center gap-2">
                  {checkResult.isBlocked ? (
                    <>
                      <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="font-medium text-red-800 dark:text-red-200">
                        <Trans>{checkResult.host} is blocked</Trans>
                      </span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-800 dark:text-green-200">
                        <Trans>{checkResult.host} is not blocked</Trans>
                      </span>
                    </>
                  )}
                </div>
                {checkResult.block && (
                  <div className="mt-2 text-sm text-(--text-muted)">
                    {checkResult.block.reason && (
                      <p>
                        <Trans>Reason:</Trans> {checkResult.block.reason}
                      </p>
                    )}
                    <p>
                      <Trans>Blocked at:</Trans> {formatDate(checkResult.block.createdAt)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blocked Instances List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <CardTitle>
              <Trans>Blocked Instances</Trans>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onPress={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                <Trans>Block Instance</Trans>
              </Button>
              <Button variant="ghost" size="sm" onPress={loadBlocks} isDisabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add Block Form */}
            {showAddForm && (
              <div className="mb-6 p-4 rounded-lg border border-(--border-color) bg-(--bg-secondary)">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-(--text-primary)">
                    <Trans>Block New Instance</Trans>
                  </h4>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="p-1 hover:bg-(--bg-tertiary) rounded"
                  >
                    <X className="w-4 h-4 text-(--text-muted)" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-(--text-muted) mb-1">
                      <Trans>Instance Hostname</Trans> *
                    </label>
                    <input
                      type="text"
                      value={newHost}
                      onChange={(e) => setNewHost(e.target.value)}
                      placeholder={t`spam.example.com`}
                      className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-(--text-muted) mb-1">
                      <Trans>Reason (optional)</Trans>
                    </label>
                    <textarea
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      placeholder={t`Reason for blocking this instance...`}
                      className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onPress={() => setShowAddForm(false)}>
                      <Trans>Cancel</Trans>
                    </Button>
                    <Button
                      variant="danger"
                      onPress={handleAddBlock}
                      isDisabled={isSubmitting || !newHost.trim()}
                    >
                      {isSubmitting ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          <Trans>Block Instance</Trans>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {blocks.length === 0 ? (
              <div className="text-center py-12">
                <Globe className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
                <p className="text-(--text-muted)">
                  <Trans>No instances blocked</Trans>
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      className="p-4 rounded-lg border border-(--border-color) bg-(--bg-primary)"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Globe className="w-4 h-4 text-(--text-muted)" />
                            <span className="font-medium text-(--text-primary)">{block.host}</span>
                          </div>
                          {block.reason && (
                            <p className="text-sm text-(--text-secondary) mb-2">{block.reason}</p>
                          )}
                          <p className="text-xs text-(--text-muted)">
                            <Trans>Blocked:</Trans> {formatDate(block.createdAt)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onPress={() => handleUnblock(block.host)}>
                          <ShieldOff className="w-4 h-4 mr-2" />
                          <Trans>Unblock</Trans>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {total > limit && (
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
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
