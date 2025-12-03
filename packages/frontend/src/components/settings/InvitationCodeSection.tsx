"use client";

/**
 * Invitation Code Section Component
 *
 * Allows users with invitation permissions to create and manage their invitation codes.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Copy, Trash2, Plus, RefreshCw, Ticket } from "lucide-react";
import { tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { addToastAtom } from "../../lib/atoms/toast";

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

interface InvitePermissions {
  canInvite: boolean;
  inviteLimit: number; // -1 = unlimited, 0 = cannot invite
  inviteLimitCycle: number; // hours
}

export function InvitationCodeSection() {
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [permissions, setPermissions] = useState<InvitePermissions | null>(null);
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Load permissions and codes
  const loadData = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);

      // Load permissions
      const permsResponse = await apiClient.get<InvitePermissions>("/api/invitations/permissions");
      setPermissions(permsResponse);

      // Only load codes if user can invite
      if (permsResponse.canInvite) {
        const codesResponse = await apiClient.get<{ codes: InvitationCode[] }>("/api/invitations");
        setCodes(codesResponse.codes);
      }
    } catch (err) {
      console.error("Failed to load invitation data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCode = async () => {
    if (!token) return;

    setIsCreating(true);
    try {
      apiClient.setToken(token);
      const newCode = await apiClient.post<InvitationCode>("/api/invitations", {
        maxUses: 1,
      });

      setCodes((prev) => [newCode, ...prev]);
      addToast({
        type: "success",
        message: t`Invitation code created`,
      });
    } catch (err: any) {
      if (err.message?.includes("limit")) {
        addToast({
          type: "error",
          message: t`You have reached your invitation limit`,
        });
      } else {
        addToast({
          type: "error",
          message: err.message || t`Failed to create invitation code`,
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/invitations/${id}`);

      setCodes((prev) => prev.filter((c) => c.id !== id));
      addToast({
        type: "success",
        message: t`Invitation code deleted`,
      });
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

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  // User cannot invite
  if (!permissions?.canInvite) {
    return null; // Don't show section if user cannot invite
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Ticket className="w-5 h-5" />
          <Trans>Invitation Codes</Trans>
        </CardTitle>
        <Button variant="ghost" size="sm" onPress={loadData} aria-label={t`Refresh`}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        {/* Limit info */}
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {permissions.inviteLimit === -1 ? (
            <Trans>You can create unlimited invitation codes</Trans>
          ) : (
            <Trans>
              You can create up to {permissions.inviteLimit} invitation codes per{" "}
              {permissions.inviteLimitCycle} hours
            </Trans>
          )}
        </div>

        {/* Create button */}
        <Button onPress={handleCreateCode} isDisabled={isCreating} className="mb-4 w-full">
          {isCreating ? (
            <Spinner size="sm" />
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              <Trans>Create Invitation Code</Trans>
            </>
          )}
        </Button>

        {/* Code list */}
        {codes.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            <Trans>No invitation codes yet</Trans>
          </p>
        ) : (
          <div className="space-y-2">
            {codes.map((code) => {
              const expired = isCodeExpired(code);
              const used = isCodeUsed(code);
              const available = !expired && !used;

              return (
                <div
                  key={code.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    available
                      ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono font-bold text-gray-900 dark:text-gray-100">
                        {code.code}
                      </code>
                      {expired && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                          <Trans>Expired</Trans>
                        </span>
                      )}
                      {used && !expired && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                          <Trans>Used</Trans>
                        </span>
                      )}
                      {available && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                          <Trans>Available</Trans>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <Trans>
                        Uses: {code.useCount}/{code.maxUses}
                      </Trans>
                      {code.expiresAt && (
                        <span className="ml-2">
                          <Trans>Expires: {formatDate(code.expiresAt)}</Trans>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => handleCopyCode(code.code)}
                      aria-label={t`Copy code`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => handleDeleteCode(code.id)}
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
  );
}
