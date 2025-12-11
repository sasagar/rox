"use client";

/**
 * Admin Invitations Page
 *
 * Allows administrators to manage invitation codes for invite-only registration.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Copy, Trash2, Plus, RefreshCw } from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { AdminNav } from "../../components/admin/AdminNav";
import { Ticket } from "lucide-react";

interface InvitationCode {
  id: string;
  code: string;
  createdById: string;
  usedById: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  maxUses: number;
  useCount: number;
  createdAt: string;
}

interface InvitationsResponse {
  codes: InvitationCode[];
  total: number;
  unused: number;
}

export default function AdminInvitationsPage() {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [invitations, setInvitations] = useState<InvitationCode[]>([]);
  const [total, setTotal] = useState(0);
  const [unused, setUnused] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [customCode, setCustomCode] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresIn, setExpiresIn] = useState<"never" | "1d" | "7d" | "30d">("never");

  const loadInvitations = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<InvitationsResponse>("/api/admin/invitations");
      setInvitations(response.codes);
      setTotal(response.total);
      setUnused(response.unused);
    } catch (err) {
      console.error("Failed to load invitations:", err);
      setError("Failed to load invitations");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Check admin access and load invitations
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

        await loadInvitations();
      } catch (err) {
        console.error("Access check failed:", err);
        setError("Access denied");
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadInvitations, setCurrentUser]);

  const handleCreateInvitation = async () => {
    if (!token) return;

    setIsCreating(true);
    try {
      apiClient.setToken(token);

      let expiresAt: string | undefined;
      if (expiresIn !== "never") {
        const now = new Date();
        const days = expiresIn === "1d" ? 1 : expiresIn === "7d" ? 7 : 30;
        now.setDate(now.getDate() + days);
        expiresAt = now.toISOString();
      }

      await apiClient.post<InvitationCode>("/api/admin/invitations", {
        code: customCode || undefined,
        maxUses,
        expiresAt,
      });

      addToast({
        type: "success",
        message: t`Invitation code created`,
      });

      // Reset form
      setCustomCode("");
      setMaxUses(1);
      setExpiresIn("never");

      // Reload list
      await loadInvitations();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to create invitation code`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteInvitation = async (id: string) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/admin/invitations/${id}`);

      addToast({
        type: "success",
        message: t`Invitation code deleted`,
      });

      // Reload list
      await loadInvitations();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to delete invitation code`,
      });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    addToast({
      type: "success",
      message: t`Code copied to clipboard`,
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  const isCodeExpired = (code: InvitationCode) => {
    if (!code.expiresAt) return false;
    return new Date(code.expiresAt) < new Date();
  };

  const isCodeUsed = (code: InvitationCode) => {
    return code.useCount >= code.maxUses;
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
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title={<Trans>Invitation Codes</Trans>}
          subtitle={<Trans>Manage invitation codes for new user registration</Trans>}
          icon={<Ticket className="w-6 h-6" />}
        />

        {/* Admin Navigation */}
        <AdminNav currentPath="/admin/invitations" />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-(--text-primary)">{total}</div>
              <div className="text-sm text-(--text-muted)">
                <Trans>Total Codes</Trans>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-green-500">{unused}</div>
              <div className="text-sm text-(--text-muted)">
                <Trans>Available Codes</Trans>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create new code */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              <Trans>Create Invitation Code</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                <Trans>Custom Code (optional)</Trans>
              </label>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder={t`Leave empty for auto-generated code`}
                className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                maxLength={20}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  <Trans>Max Uses</Trans>
                </label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="1">1</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  <Trans>Expires In</Trans>
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value as any)}
                  className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="never">
                    <Trans>Never</Trans>
                  </option>
                  <option value="1d">
                    <Trans>1 Day</Trans>
                  </option>
                  <option value="7d">
                    <Trans>7 Days</Trans>
                  </option>
                  <option value="30d">
                    <Trans>30 Days</Trans>
                  </option>
                </select>
              </div>
            </div>

            <Button onPress={handleCreateInvitation} isDisabled={isCreating} className="w-full">
              {isCreating ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  <Trans>Create Invitation Code</Trans>
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Invitation list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <Trans>Invitation Codes</Trans>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadInvitations}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-center text-(--text-muted) py-8">
                <Trans>No invitation codes yet</Trans>
              </p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => {
                  const expired = isCodeExpired(invitation);
                  const used = isCodeUsed(invitation);
                  const available = !expired && !used;

                  return (
                    <div
                      key={invitation.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        available
                          ? "border-(--border-color) bg-(--bg-primary)"
                          : "border-(--border-color) bg-(--bg-tertiary) opacity-60"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-lg font-mono font-bold text-(--text-primary)">
                            {invitation.code}
                          </code>
                          {expired && (
                            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                              <Trans>Expired</Trans>
                            </span>
                          )}
                          {used && !expired && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 rounded">
                              <Trans>Used</Trans>
                            </span>
                          )}
                          {available && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                              <Trans>Available</Trans>
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-(--text-muted) mt-1">
                          <Trans>
                            Uses: {invitation.useCount}/{invitation.maxUses}
                          </Trans>
                          {invitation.expiresAt && (
                            <span className="ml-3">
                              <Trans>Expires: {formatDate(invitation.expiresAt)}</Trans>
                            </span>
                          )}
                          <span className="ml-3">
                            <Trans>Created: {formatDate(invitation.createdAt)}</Trans>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleCopyCode(invitation.code)}
                          aria-label={t`Copy code`}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleDeleteInvitation(invitation.id)}
                          aria-label={t`Delete code`}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
