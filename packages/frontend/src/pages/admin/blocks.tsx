"use client";

/**
 * Admin Instance Blocks Page
 *
 * Allows administrators to manage blocked instances (domains).
 * Blocked instances cannot federate with this server.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Trash2, Plus, RefreshCw, Shield, Globe, AlertTriangle } from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { AdminNav } from "../../components/admin/AdminNav";

interface InstanceBlock {
  id: string;
  host: string;
  reason: string | null;
  blockedById: string;
  createdAt: string;
}

interface BlocksResponse {
  blocks: InstanceBlock[];
  total: number;
}

export default function AdminBlocksPage() {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [blocks, setBlocks] = useState<InstanceBlock[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [host, setHost] = useState("");
  const [reason, setReason] = useState("");

  const loadBlocks = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<BlocksResponse>("/api/admin/instance-blocks");
      setBlocks(response.blocks);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load instance blocks:", err);
      setError("Failed to load instance blocks");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Check admin access and load blocks
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

        await loadBlocks();
      } catch (err) {
        console.error("Access check failed:", err);
        setError("Access denied");
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadBlocks, setCurrentUser]);

  const handleAddBlock = async () => {
    if (!token || !host.trim()) return;

    setIsAdding(true);
    try {
      apiClient.setToken(token);

      // Normalize host (remove protocol, trailing slashes)
      const normalizedHost = host
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

      await apiClient.post<InstanceBlock>("/api/admin/instance-blocks", {
        host: normalizedHost,
        reason: reason.trim() || undefined,
      });

      addToast({
        type: "success",
        message: t`Instance blocked`,
      });

      // Reset form
      setHost("");
      setReason("");

      // Reload list
      await loadBlocks();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to block instance`,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleUnblock = async (hostToUnblock: string) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/admin/instance-blocks/${encodeURIComponent(hostToUnblock)}`);

      addToast({
        type: "success",
        message: t`Instance unblocked`,
      });

      // Reload list
      await loadBlocks();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to unblock instance`,
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-(--text-primary)">
            <Trans>Instance Blocks</Trans>
          </h1>
          <p className="text-(--text-secondary) mt-2">
            <Trans>Block instances from federating with this server</Trans>
          </p>
        </div>

        {/* Admin Navigation */}
        <AdminNav currentPath="/admin/blocks" />

        {/* Stats */}
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

        {/* Add block form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              <Trans>Block Instance</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <Trans>
                    Blocking an instance will prevent all federation with that server. Users from
                    blocked instances cannot interact with this server.
                  </Trans>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                <Trans>Instance Domain</Trans>
              </label>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-(--text-muted)" />
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={t`example.com`}
                  className="flex-1 px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <p className="text-xs text-(--text-muted) mt-1">
                <Trans>Enter the domain without https:// prefix</Trans>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                <Trans>Reason (optional)</Trans>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t`Why is this instance being blocked?`}
                className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                rows={2}
              />
            </div>

            <Button
              onPress={handleAddBlock}
              isDisabled={isAdding || !host.trim()}
              className="w-full"
              variant="danger"
            >
              {isAdding ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  <Trans>Block Instance</Trans>
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Blocked instances list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <Trans>Blocked Instances</Trans>
            </CardTitle>
            <Button variant="ghost" size="sm" onPress={loadBlocks}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {blocks.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
                <p className="text-(--text-muted)">
                  <Trans>No blocked instances</Trans>
                </p>
                <p className="text-sm text-(--text-muted) mt-1">
                  <Trans>All instances can federate with this server</Trans>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-(--border-color) bg-(--bg-primary)"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-(--text-muted)" />
                        <span className="text-lg font-semibold text-(--text-primary)">
                          {block.host}
                        </span>
                      </div>
                      {block.reason && (
                        <p className="text-sm text-(--text-secondary) mt-1 ml-6">{block.reason}</p>
                      )}
                      <p className="text-xs text-(--text-muted) mt-1 ml-6">
                        <Trans>Blocked on {formatDate(block.createdAt)}</Trans>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => handleUnblock(block.host)}
                      aria-label={t`Unblock instance`}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
