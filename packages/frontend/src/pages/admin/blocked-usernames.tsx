"use client";

/**
 * Admin Blocked Usernames Page
 *
 * Allows administrators to manage blocked username patterns:
 * - View all custom blocked patterns
 * - Add new patterns (exact match or regex)
 * - Delete existing patterns
 * - Test usernames against all patterns
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Plus, Trash2, TestTube, AlertCircle, CheckCircle, Info } from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { AdminLayout } from "../../components/admin/AdminLayout";

interface BlockedUsername {
  id: string;
  pattern: string;
  isRegex: boolean;
  reason: string | null;
  createdAt: string;
  createdById: string | null;
}

interface TestResult {
  blocked: boolean;
  reason?: string;
  source?: "default" | "custom";
  matchedPattern?: string;
}

export default function AdminBlockedUsernamesPage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [patterns, setPatterns] = useState<BlockedUsername[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add pattern form
  const [newPattern, setNewPattern] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [reason, setReason] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Test username form
  const [testUsername, setTestUsername] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPatterns = useCallback(async () => {
    try {
      const response = await apiClient.get<{ patterns: BlockedUsername[] }>(
        "/api/admin/blocked-usernames"
      );
      setPatterns(response.patterns);
    } catch (err) {
      console.error("Failed to load blocked usernames:", err);
      setError("Failed to load blocked usernames");
    }
  }, []);

  // Check admin access and load patterns
  useEffect(() => {
    const init = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        apiClient.setToken(token);

        // Check if user is admin
        const sessionResponse = await apiClient.get<{ user: any }>("/api/auth/session");
        if (!sessionResponse.user?.isAdmin) {
          window.location.href = "/timeline";
          return;
        }

        setCurrentUser(sessionResponse.user);
        await loadPatterns();
      } catch (err) {
        console.error("Failed to initialize:", err);
        setError("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [token, setCurrentUser, loadPatterns]);

  const handleAddPattern = async () => {
    if (!newPattern.trim()) {
      addToast({ type: "error", message: t`Pattern is required` });
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const response = await apiClient.post<BlockedUsername>("/api/admin/blocked-usernames", {
        pattern: newPattern.trim(),
        isRegex,
        reason: reason.trim() || undefined,
      });

      setPatterns((prev) => [response, ...prev]);
      setNewPattern("");
      setIsRegex(false);
      setReason("");
      addToast({ type: "success", message: t`Pattern added successfully` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add pattern";
      setError(message);
      addToast({ type: "error", message });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeletePattern = async (id: string) => {
    setDeletingId(id);
    setError(null);

    try {
      await apiClient.delete(`/api/admin/blocked-usernames/${id}`);
      setPatterns((prev) => prev.filter((p) => p.id !== id));
      addToast({ type: "success", message: t`Pattern deleted` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete pattern";
      setError(message);
      addToast({ type: "error", message });
    } finally {
      setDeletingId(null);
    }
  };

  const handleTestUsername = async () => {
    if (!testUsername.trim()) {
      addToast({ type: "error", message: t`Username is required` });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await apiClient.post<TestResult>("/api/admin/blocked-usernames/test", {
        username: testUsername.trim(),
      });
      setTestResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to test username";
      setError(message);
      addToast({ type: "error", message });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!currentUser?.isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <AdminLayout
      currentPath="/admin/blocked-usernames"
      title={<Trans>Blocked Usernames</Trans>}
      subtitle={<Trans>Manage username restrictions for registration</Trans>}
    >
      {error && <InlineError message={error} className="mb-4" />}

      {/* Info Card */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-(--text-secondary)">
              <p className="mb-2">
                <Trans>
                  Blocked usernames prevent users from registering with certain names. There are two types:
                </Trans>
              </p>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  <Trans>
                    <strong>Default reserved names</strong>: System names like "admin", "api", "system" are always blocked and cannot be removed.
                  </Trans>
                </li>
                <li>
                  <Trans>
                    <strong>Custom patterns</strong>: Admin-defined patterns shown below. These can be exact matches or regular expressions.
                  </Trans>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Username */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            <Trans>Test Username</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={testUsername}
              onChange={(e) => {
                setTestUsername(e.target.value);
                setTestResult(null);
              }}
              placeholder={t`Enter a username to test...`}
              className="flex-1 rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTestUsername();
                }
              }}
            />
            <Button variant="secondary" onPress={handleTestUsername} isDisabled={isTesting}>
              {isTesting ? <Spinner size="xs" /> : <Trans>Test</Trans>}
            </Button>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-lg flex items-start gap-2 ${
                testResult.blocked
                  ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                  : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
              }`}
            >
              {testResult.blocked ? (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <div>
                {testResult.blocked ? (
                  <>
                    <p className="font-medium">
                      <Trans>This username is blocked</Trans>
                    </p>
                    <p className="text-sm mt-1">
                      <Trans>Source</Trans>: {testResult.source === "default" ? t`Default reserved` : t`Custom pattern`}
                    </p>
                    {testResult.reason && (
                      <p className="text-sm">
                        <Trans>Reason</Trans>: {testResult.reason}
                      </p>
                    )}
                    {testResult.matchedPattern && (
                      <p className="text-sm font-mono">
                        <Trans>Matched pattern</Trans>: {testResult.matchedPattern}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-medium">
                    <Trans>This username is allowed</Trans>
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add New Pattern */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <Trans>Add New Pattern</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-2">
              <Trans>Pattern</Trans>
            </label>
            <input
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder={isRegex ? t`e.g., bad.*word` : t`e.g., badword`}
              className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isAdding}
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
              className="w-5 h-5 rounded border-(--border-color) text-primary-600 focus:ring-primary-500"
              disabled={isAdding}
            />
            <div>
              <span className="font-medium text-(--text-primary)">
                <Trans>Regular Expression</Trans>
              </span>
              <p className="text-sm text-(--text-muted)">
                <Trans>Enable if the pattern is a regex (case-insensitive)</Trans>
              </p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-2">
              <Trans>Reason (optional)</Trans>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t`e.g., Inappropriate content`}
              className="w-full rounded-md border border-(--border-color) bg-(--card-bg) px-3 py-2 text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isAdding}
            />
          </div>

          <div className="pt-2">
            <Button variant="primary" onPress={handleAddPattern} isDisabled={isAdding || !newPattern.trim()}>
              {isAdding ? <Spinner size="xs" variant="white" /> : <Trans>Add Pattern</Trans>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pattern List */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Custom Blocked Patterns</Trans>
            <span className="ml-2 text-sm font-normal text-(--text-muted)">
              ({patterns.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patterns.length === 0 ? (
            <div className="text-center py-8 text-(--text-muted)">
              <Trans>No custom patterns defined yet.</Trans>
            </div>
          ) : (
            <div className="space-y-3">
              {patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-(--border-color) bg-(--bg-secondary)"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-(--text-primary) truncate">
                        {pattern.pattern}
                      </code>
                      {pattern.isRegex && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          regex
                        </span>
                      )}
                    </div>
                    {pattern.reason && (
                      <p className="text-sm text-(--text-muted) mt-1 truncate">{pattern.reason}</p>
                    )}
                    <p className="text-xs text-(--text-muted) mt-1">
                      <Trans>Added</Trans>: {new Date(pattern.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onPress={() => handleDeletePattern(pattern.id)}
                    isDisabled={deletingId === pattern.id}
                  >
                    {deletingId === pattern.id ? (
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
      </Card>
    </AdminLayout>
  );
}
