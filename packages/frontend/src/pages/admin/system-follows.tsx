"use client";

/**
 * Admin System Follows Page
 *
 * Allows administrators to view and manage accounts followed by the system account.
 * Shows which lists each account is in for easy management.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  RefreshCw,
  Users,
  User,
  Search,
  Globe,
  UserMinus,
  AlertTriangle,
  List,
  Loader2,
} from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";
import { MfmRenderer } from "../../components/mfm/MfmRenderer";

interface ProfileEmoji {
  name: string;
  url: string;
}

interface ListInfo {
  id: string;
  name: string;
}

interface SystemFollowUser {
  id: string;
  username: string;
  displayName: string | null;
  host: string | null;
  avatarUrl: string | null;
  profileEmojis?: ProfileEmoji[];
}

interface SystemFollow {
  id: string;
  user: SystemFollowUser;
  createdAt: string;
  lists: ListInfo[];
  listCount: number;
}

interface SystemFollowsResponse {
  follows: SystemFollow[];
  total: number;
  systemAccountId: string;
}

type FilterType = "all" | "local" | "remote" | "in-lists" | "not-in-lists";

export default function AdminSystemFollowsPage() {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [follows, setFollows] = useState<SystemFollow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [userFilter, setUserFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Unfollow confirmation state
  const [userToUnfollow, setUserToUnfollow] = useState<SystemFollow | null>(null);
  const [isUnfollowing, setIsUnfollowing] = useState(false);

  const loadFollows = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (userFilter !== "all") {
        params.set("filter", userFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      const response = await apiClient.get<SystemFollowsResponse>(
        `/api/admin/system-follows?${params}`,
      );
      setFollows(response.follows);
      setTotal(response.total);
    } catch (err) {
      console.error("Failed to load system follows:", err);
      setError("Failed to load system follows");
    } finally {
      setIsLoading(false);
    }
  }, [token, userFilter, searchQuery]);

  // Check admin access and load follows
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

        await loadFollows();
      } catch (err) {
        console.error("Access check failed:", err);
        setError("Access denied");
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadFollows, setCurrentUser]);

  // Reload when filter changes
  useEffect(() => {
    if (!isLoading && token) {
      loadFollows();
    }
  }, [userFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnfollow = async () => {
    if (!token || !userToUnfollow) return;

    setIsUnfollowing(true);
    try {
      apiClient.setToken(token);
      await apiClient.delete<{ success: boolean; message: string }>(
        `/api/admin/system-follows/${userToUnfollow.user.id}`,
      );

      addToast({
        type: "success",
        message: t`User has been unfollowed`,
      });

      setUserToUnfollow(null);
      await loadFollows();
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to unfollow user`,
      });
    } finally {
      setIsUnfollowing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Convert profileEmojis array to Record<string, string> for MfmRenderer
  const getEmojiMap = (emojis?: ProfileEmoji[]): Record<string, string> => {
    if (!emojis || emojis.length === 0) return {};
    const map: Record<string, string> = {};
    for (const emoji of emojis) {
      map[emoji.name] = emoji.url;
    }
    return map;
  };

  // Filter by search query (additional client-side filter)
  const filteredFollows = follows.filter((follow) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      follow.user.username.toLowerCase().includes(query) ||
      (follow.user.displayName?.toLowerCase().includes(query) ?? false) ||
      (follow.user.host?.toLowerCase().includes(query) ?? false)
    );
  });

  // Calculate stats
  const localCount = follows.filter((f) => f.user.host === null).length;
  const remoteCount = follows.filter((f) => f.user.host !== null).length;
  const inListsCount = follows.filter((f) => f.listCount > 0).length;
  const notInListsCount = follows.filter((f) => f.listCount === 0).length;

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
    <AdminLayout
      currentPath="/admin/system-follows"
      title={<Trans>System Follows</Trans>}
      subtitle={<Trans>Manage accounts followed by the system account</Trans>}
    >
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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
                  <div className="text-2xl font-bold text-(--text-primary)">{localCount}</div>
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
                  <div className="text-2xl font-bold text-(--text-primary)">{remoteCount}</div>
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
                <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <List className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-(--text-primary)">{inListsCount}</div>
                  <div className="text-xs text-(--text-muted)">
                    <Trans>In Lists</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900/30">
                  <UserMinus className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-(--text-primary)">{notInListsCount}</div>
                  <div className="text-xs text-(--text-muted)">
                    <Trans>Not in Lists</Trans>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <CardTitle>
              <Trans>Following List</Trans>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
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
              <div className="flex rounded-lg border border-(--border-color) overflow-hidden">
                <button
                  type="button"
                  onClick={() => setUserFilter("all")}
                  className={`px-3 py-1 text-sm ${
                    userFilter === "all"
                      ? "bg-primary-600 text-white"
                      : "bg-(--bg-primary) text-(--text-secondary) hover:bg-(--bg-tertiary)"
                  }`}
                >
                  <Trans>All</Trans>
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilter("local")}
                  className={`px-3 py-1 text-sm border-l border-(--border-color) ${
                    userFilter === "local"
                      ? "bg-primary-600 text-white"
                      : "bg-(--bg-primary) text-(--text-secondary) hover:bg-(--bg-tertiary)"
                  }`}
                >
                  <Trans>Local</Trans>
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilter("remote")}
                  className={`px-3 py-1 text-sm border-l border-(--border-color) ${
                    userFilter === "remote"
                      ? "bg-primary-600 text-white"
                      : "bg-(--bg-primary) text-(--text-secondary) hover:bg-(--bg-tertiary)"
                  }`}
                >
                  <Trans>Remote</Trans>
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilter("in-lists")}
                  className={`px-3 py-1 text-sm border-l border-(--border-color) ${
                    userFilter === "in-lists"
                      ? "bg-primary-600 text-white"
                      : "bg-(--bg-primary) text-(--text-secondary) hover:bg-(--bg-tertiary)"
                  }`}
                >
                  <Trans>In Lists</Trans>
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilter("not-in-lists")}
                  className={`px-3 py-1 text-sm border-l border-(--border-color) ${
                    userFilter === "not-in-lists"
                      ? "bg-primary-600 text-white"
                      : "bg-(--bg-primary) text-(--text-secondary) hover:bg-(--bg-tertiary)"
                  }`}
                >
                  <Trans>Not in Lists</Trans>
                </button>
              </div>
              <Button variant="ghost" size="sm" onPress={loadFollows}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredFollows.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-(--text-muted) mb-4" />
                <p className="text-(--text-muted)">
                  <Trans>No users found</Trans>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFollows.map((follow) => (
                  <div
                    key={follow.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-(--border-color) bg-(--bg-primary)"
                  >
                    <div className="flex items-center gap-3">
                      {follow.user.avatarUrl ? (
                        <img
                          src={getProxiedImageUrl(follow.user.avatarUrl) || follow.user.avatarUrl}
                          alt={follow.user.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-(--bg-tertiary) flex items-center justify-center">
                          <User className="w-5 h-5 text-(--text-muted)" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-(--text-primary)">
                            {follow.user.displayName ? (
                              <MfmRenderer
                                text={follow.user.displayName}
                                customEmojis={getEmojiMap(follow.user.profileEmojis)}
                              />
                            ) : (
                              `@${follow.user.username}`
                            )}
                          </span>
                          {follow.user.host && (
                            <Globe className="w-4 h-4 text-(--text-muted)" />
                          )}
                          {follow.listCount > 0 && (
                            <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <Trans>{follow.listCount} lists</Trans>
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-(--text-muted)">
                          @{follow.user.username}
                          {follow.user.host && `@${follow.user.host}`}
                        </div>
                        {follow.lists.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {follow.lists.map((list) => (
                              <span
                                key={list.id}
                                className="px-2 py-0.5 text-xs rounded bg-(--bg-tertiary) text-(--text-secondary)"
                              >
                                {list.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-(--text-muted) mt-1">
                          <Trans>Followed {formatDate(follow.createdAt)}</Trans>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => setUserToUnfollow(follow)}
                        aria-label={t`Unfollow`}
                      >
                        <UserMinus className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unfollow Confirmation Modal */}
        {userToUnfollow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-(--bg-primary) rounded-xl shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h2 className="text-xl font-bold text-(--text-primary)">
                    <Trans>Unfollow User</Trans>
                  </h2>
                </div>

                <p className="text-(--text-secondary) mb-4">
                  <Trans>
                    Are you sure you want to unfollow{" "}
                    <strong>
                      @{userToUnfollow.user.username}
                      {userToUnfollow.user.host && `@${userToUnfollow.user.host}`}
                    </strong>
                    ?
                  </Trans>
                </p>

                {userToUnfollow.listCount > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <Trans>
                        This user is in {userToUnfollow.listCount} list(s). Unfollowing won't remove
                        them from lists.
                      </Trans>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {userToUnfollow.lists.map((list) => (
                        <span
                          key={list.id}
                          className="px-2 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        >
                          {list.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onPress={() => setUserToUnfollow(null)}
                    className="flex-1"
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button
                    variant="danger"
                    onPress={handleUnfollow}
                    isDisabled={isUnfollowing}
                    className="flex-1"
                  >
                    {isUnfollowing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserMinus className="w-4 h-4 mr-2" />
                        <Trans>Unfollow</Trans>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
