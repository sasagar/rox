"use client";

/**
 * Admin Custom Emojis Page
 *
 * Allows administrators to manage custom emojis for the instance.
 * Features: add, edit, delete, and categorize custom emojis.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Trash2, Plus, RefreshCw, Smile, Edit2, X, Upload, Download, Globe, Archive, CheckSquare, Square, FolderInput } from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { AdminNav } from "../../components/admin/AdminNav";

interface CustomEmoji {
  id: string;
  name: string;
  category: string | null;
  aliases: string[];
  url: string;
  isSensitive: boolean;
  license: string | null;
  host?: string | null;
}

interface EmojisResponse {
  emojis: CustomEmoji[];
  total: number;
  limit: number;
  offset: number;
}

interface CategoriesResponse {
  categories: string[];
}

interface RemoteEmojisResponse {
  emojis: CustomEmoji[];
  hosts: string[];
  total: number;
}

interface ImportResult {
  success: number;
  skipped: number;
  failed: number;
  details: Array<{
    name: string;
    status: "success" | "skipped" | "failed";
    reason?: string;
  }>;
}

type TabType = "local" | "remote" | "import";

export default function AdminEmojisPage() {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [totalEmojis, setTotalEmojis] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("local");

  // Remote emojis state
  const [remoteEmojis, setRemoteEmojis] = useState<CustomEmoji[]>([]);
  const [remoteHosts, setRemoteHosts] = useState<string[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [filterHost, setFilterHost] = useState<string>("");
  const [adoptingEmoji, setAdoptingEmoji] = useState<string | null>(null);

  // ZIP import state
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmoji, setEditingEmoji] = useState<CustomEmoji | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [aliases, setAliases] = useState("");
  const [license, setLicense] = useState("");
  const [isSensitive, setIsSensitive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk selection state
  const [selectedEmojis, setSelectedEmojis] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");

  const loadEmojis = useCallback(async (loadAll = false) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      // First, get initial batch and total count
      const response = await apiClient.get<EmojisResponse>("/api/emojis?limit=100");
      setTotalEmojis(response.total);

      if (loadAll && response.total > response.emojis.length) {
        // Load all emojis if requested and there are more
        setIsLoadingMore(true);
        const allResponse = await apiClient.get<EmojisResponse>(`/api/emojis?limit=${response.total}`);
        setEmojis(allResponse.emojis);
        setIsLoadingMore(false);
      } else {
        setEmojis(response.emojis);
      }
    } catch (err) {
      console.error("Failed to load emojis:", err);
      setError("Failed to load custom emojis");
      setIsLoadingMore(false);
    }
  }, [token]);

  const loadCategories = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<CategoriesResponse>("/api/emojis/categories");
      setCategories(response.categories);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [token]);

  const loadRemoteEmojis = useCallback(async () => {
    if (!token) return;

    setIsLoadingRemote(true);
    try {
      apiClient.setToken(token);
      const params = filterHost ? `?host=${encodeURIComponent(filterHost)}` : "";
      const response = await apiClient.get<RemoteEmojisResponse>(`/api/emojis/remote${params}`);
      setRemoteEmojis(response.emojis);
      setRemoteHosts(response.hosts);
    } catch (err) {
      console.error("Failed to load remote emojis:", err);
      addToast({
        type: "error",
        message: t`Failed to load remote emojis`,
      });
    } finally {
      setIsLoadingRemote(false);
    }
  }, [token, filterHost, addToast]);

  const handleAdoptEmoji = async (emoji: CustomEmoji) => {
    if (!token || !emoji.id) return;

    setAdoptingEmoji(emoji.id);
    try {
      apiClient.setToken(token);
      await apiClient.post("/api/emojis/adopt", {
        emojiId: emoji.id,
      });

      addToast({
        type: "success",
        message: t`Emoji ":${emoji.name}:" adopted as local emoji`,
      });

      // Reload both local and remote emojis
      await Promise.all([loadEmojis(), loadRemoteEmojis()]);
    } catch (err) {
      console.error("Failed to adopt emoji:", err);
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t`Failed to adopt emoji`,
      });
    } finally {
      setAdoptingEmoji(null);
    }
  };

  const processZipFile = async (file: File) => {
    if (!token) return;

    // Validate file type
    if (!file.name.endsWith(".zip")) {
      addToast({
        type: "error",
        message: t`Please select a ZIP file`,
      });
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      addToast({
        type: "error",
        message: t`File too large. Maximum size: 50MB`,
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use AbortController for timeout (5 minutes for large imports)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      const response = await fetch("/api/emojis/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = "Import failed";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Response might not be JSON
          errorMessage = `Import failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const result: ImportResult = await response.json();
      setImportResult(result);

      addToast({
        type: result.failed > 0 ? "info" : "success",
        message: t`Import complete: ${result.success} added, ${result.skipped} skipped, ${result.failed} failed`,
      });

      // Reload emojis and categories
      await Promise.all([loadEmojis(), loadCategories()]);
    } catch (err) {
      console.error("Failed to import emojis:", err);
      let errorMessage = t`Failed to import emojis`;
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMessage = t`Import timed out. The server may still be processing. Please check back later.`;
        } else {
          errorMessage = err.message;
        }
      }
      addToast({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsImporting(false);
      setIsDragging(false);
    }
  };

  const handleZipImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processZipFile(file);
    // Reset file input
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processZipFile(file);
  };

  // Check admin access and load emojis
  useEffect(() => {
    const checkAccess = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        apiClient.setToken(token);

        // Check if user is admin and restore session
        const sessionResponse = await apiClient.get<{ user: { isAdmin?: boolean } }>(
          "/api/auth/session",
        );
        if (!sessionResponse.user?.isAdmin) {
          window.location.href = "/timeline";
          return;
        }

        // Update currentUser atom to ensure sidebar shows
        setCurrentUser(sessionResponse.user as any);

        await Promise.all([loadEmojis(), loadCategories()]);
      } catch (err) {
        console.error("Access check failed:", err);
        setError("Access denied");
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadEmojis, loadCategories, setCurrentUser]);

  // Load remote emojis when switching to remote tab
  useEffect(() => {
    if (activeTab === "remote" && remoteEmojis.length === 0) {
      loadRemoteEmojis();
    }
  }, [activeTab, remoteEmojis.length, loadRemoteEmojis]);

  const resetForm = () => {
    setName("");
    setUrl("");
    setCategory("");
    setAliases("");
    setLicense("");
    setIsSensitive(false);
    setEditingEmoji(null);
    setShowAddForm(false);
    setSelectedFile(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/gif", "image/webp", "image/apng"];
    if (!allowedTypes.includes(file.type)) {
      addToast({
        type: "error",
        message: t`Invalid file type. Allowed: PNG, GIF, WebP, APNG`,
      });
      return;
    }

    // Validate file size (256KB max)
    if (file.size > 256 * 1024) {
      addToast({
        type: "error",
        message: t`File too large. Maximum size: 256KB`,
      });
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

    try {
      apiClient.setToken(token);

      // Upload file using FormData
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/emojis/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      setUrl(data.url);

      addToast({
        type: "success",
        message: t`File uploaded successfully`,
      });
    } catch (err) {
      console.error("Failed to upload file:", err);
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t`Failed to upload file`,
      });
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddEmoji = async () => {
    if (!token || !name.trim() || !url.trim()) return;

    setIsAdding(true);
    try {
      apiClient.setToken(token);
      await apiClient.post("/api/emojis/create", {
        name: name.trim().toLowerCase(),
        url: url.trim(),
        category: category.trim() || null,
        aliases: aliases.trim() ? aliases.split(",").map((a) => a.trim()) : [],
        license: license.trim() || null,
        isSensitive,
      });

      addToast({
        type: "success",
        message: t`Emoji ":${name}:" added successfully`,
      });

      resetForm();
      await Promise.all([loadEmojis(), loadCategories()]);
    } catch (err) {
      console.error("Failed to add emoji:", err);
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t`Failed to add emoji`,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateEmoji = async () => {
    if (!token || !editingEmoji || !name.trim()) return;

    setIsAdding(true);
    try {
      apiClient.setToken(token);
      await apiClient.patch(`/api/emojis/${editingEmoji.id}`, {
        name: name.trim().toLowerCase(),
        category: category.trim() || null,
        aliases: aliases.trim() ? aliases.split(",").map((a) => a.trim()) : [],
        license: license.trim() || null,
        isSensitive,
      });

      addToast({
        type: "success",
        message: t`Emoji updated successfully`,
      });

      resetForm();
      await Promise.all([loadEmojis(), loadCategories()]);
    } catch (err) {
      console.error("Failed to update emoji:", err);
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t`Failed to update emoji`,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteEmoji = async (emoji: CustomEmoji) => {
    if (!token) return;
    if (!confirm(t`Are you sure you want to delete ":${emoji.name}:"?`)) return;

    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/emojis/${emoji.id}`);

      addToast({
        type: "success",
        message: t`Emoji ":${emoji.name}:" deleted`,
      });

      await Promise.all([loadEmojis(), loadCategories()]);
    } catch (err) {
      console.error("Failed to delete emoji:", err);
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t`Failed to delete emoji`,
      });
    }
  };

  const handleEditEmoji = (emoji: CustomEmoji) => {
    setEditingEmoji(emoji);
    setName(emoji.name);
    setUrl(emoji.url);
    setCategory(emoji.category || "");
    setAliases(emoji.aliases.join(", "));
    setLicense(emoji.license || "");
    setIsSensitive(emoji.isSensitive);
    setShowAddForm(true);
  };

  // Bulk selection handlers
  const toggleBulkMode = () => {
    setIsBulkMode(!isBulkMode);
    if (isBulkMode) {
      setSelectedEmojis(new Set());
    }
  };

  const toggleEmojiSelection = (emojiId: string) => {
    setSelectedEmojis((prev) => {
      const next = new Set(prev);
      if (next.has(emojiId)) {
        next.delete(emojiId);
      } else {
        next.add(emojiId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedEmojis(new Set(filteredEmojis.map((e) => e.id)));
  };

  const loadAndSelectAll = async () => {
    // Load all emojis first, then select them
    if (emojis.length < totalEmojis) {
      setIsLoadingMore(true);
      try {
        apiClient.setToken(token!);
        const allResponse = await apiClient.get<EmojisResponse>(`/api/emojis?limit=${totalEmojis}`);
        const allEmojis = allResponse.emojis;
        setEmojis(allEmojis);
        // Apply filters and select all matching
        const filtered = allEmojis.filter((emoji) => {
          if (filterCategory && emoji.category !== filterCategory) return false;
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              emoji.name.toLowerCase().includes(query) ||
              emoji.aliases.some((a) => a.toLowerCase().includes(query))
            );
          }
          return true;
        });
        setSelectedEmojis(new Set(filtered.map((e) => e.id)));
      } catch (err) {
        console.error("Failed to load all emojis:", err);
        addToast({
          type: "error",
          message: t`Failed to load all emojis`,
        });
      } finally {
        setIsLoadingMore(false);
      }
    } else {
      // All emojis already loaded, just select filtered
      setSelectedEmojis(new Set(filteredEmojis.map((e) => e.id)));
    }
  };

  const deselectAll = () => {
    setSelectedEmojis(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedEmojis.size === 0) return;

    const confirmed = window.confirm(
      t`Are you sure you want to delete ${selectedEmojis.size} emojis? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      apiClient.setToken(token!);
      const idsToDelete = Array.from(selectedEmojis);
      const BATCH_SIZE = 1000;
      let totalDeleted = 0;
      const allDeletedIds: string[] = [];

      // Process in batches of 1000
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const batch = idsToDelete.slice(i, i + BATCH_SIZE);
        const result = await apiClient.post<{
          success: number;
          notFound: number;
          details: { deleted: string[]; notFound: string[] };
        }>("/api/emojis/bulk-delete", {
          ids: batch,
        });
        totalDeleted += result.success;
        allDeletedIds.push(...result.details.deleted);
      }

      addToast({
        type: "success",
        message: t`Deleted ${totalDeleted} emojis`,
      });

      // Remove deleted emojis from state and update total count
      setEmojis((prev) => prev.filter((e) => !allDeletedIds.includes(e.id)));
      setTotalEmojis((prev) => Math.max(0, prev - totalDeleted));
      setSelectedEmojis(new Set());
      setIsBulkMode(false);
    } catch (err) {
      console.error("Failed to bulk delete emojis:", err);
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t`Failed to delete emojis`,
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkCategoryUpdate = async () => {
    if (selectedEmojis.size === 0) return;

    setIsBulkUpdating(true);
    try {
      apiClient.setToken(token!);
      const idsToUpdate = Array.from(selectedEmojis);
      const BATCH_SIZE = 1000;
      let totalUpdated = 0;
      const allUpdatedIds: string[] = [];

      // Process in batches of 1000
      for (let i = 0; i < idsToUpdate.length; i += BATCH_SIZE) {
        const batch = idsToUpdate.slice(i, i + BATCH_SIZE);
        const result = await apiClient.post<{
          success: number;
          notFound: number;
          details: { updated: string[]; notFound: string[] };
        }>("/api/emojis/bulk-update", {
          ids: batch,
          category: bulkCategory || null,
        });
        totalUpdated += result.success;
        allUpdatedIds.push(...result.details.updated);
      }

      addToast({
        type: "success",
        message: t`Updated ${totalUpdated} emojis`,
      });

      // Update emojis in state
      setEmojis((prev) =>
        prev.map((e) =>
          allUpdatedIds.includes(e.id) ? { ...e, category: bulkCategory || null } : e,
        ),
      );
      setShowBulkCategoryModal(false);
      setBulkCategory("");
      setSelectedEmojis(new Set());
      setIsBulkMode(false);
      loadCategories();
    } catch (err) {
      console.error("Failed to bulk update emojis:", err);
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t`Failed to update emojis`,
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Filter emojis
  const filteredEmojis = emojis.filter((emoji) => {
    if (filterCategory && emoji.category !== filterCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        emoji.name.toLowerCase().includes(query) ||
        emoji.aliases.some((a) => a.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Group emojis by category
  const groupedEmojis = filteredEmojis.reduce(
    (acc, emoji) => {
      const cat = emoji.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(emoji);
      return acc;
    },
    {} as Record<string, CustomEmoji[]>,
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
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

  // Build actions based on active tab
  const headerActions = [];
  if (activeTab === "local") {
    headerActions.push({
      key: "bulk-mode",
      label: isBulkMode ? <Trans>Exit Bulk Mode</Trans> : <Trans>Bulk Edit</Trans>,
      icon: isBulkMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />,
      onPress: toggleBulkMode,
      variant: isBulkMode ? "primary" : "secondary",
    });
    headerActions.push({
      key: "refresh",
      label: <Trans>Refresh</Trans>,
      icon: <RefreshCw className="w-4 h-4" />,
      onPress: () => loadEmojis(),
      variant: "secondary",
    });
    if (!isBulkMode) {
      headerActions.push({
        key: "add",
        label: <Trans>Add Emoji</Trans>,
        icon: <Plus className="w-4 h-4" />,
        onPress: () => {
          resetForm();
          setShowAddForm(true);
        },
        variant: "primary",
      });
    }
  } else if (activeTab === "remote") {
    headerActions.push({
      key: "refresh",
      label: <Trans>Refresh</Trans>,
      icon: <RefreshCw className="w-4 h-4" />,
      onPress: () => loadRemoteEmojis(),
      variant: "secondary",
    });
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title={<Trans>Custom Emojis</Trans>}
          subtitle={<Trans>Manage custom emojis for your instance</Trans>}
          icon={<Smile className="w-6 h-6" />}
          tabs={[
            { key: "local", label: <Trans>Local Emojis</Trans>, icon: <Smile className="w-4 h-4" /> },
            { key: "remote", label: <Trans>Remote Emojis</Trans>, icon: <Globe className="w-4 h-4" /> },
            { key: "import", label: <Trans>Bulk Import</Trans>, icon: <Archive className="w-4 h-4" /> },
          ]}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as TabType)}
          actions={headerActions as any}
        />

        <AdminNav currentPath="/admin/emojis" />

        <Card>
          <CardHeader className="sr-only">
            <CardTitle>
              <Trans>Emoji Management</Trans>
            </CardTitle>
          </CardHeader>

          <CardContent>
            {/* Add/Edit Form */}
            {showAddForm && (
              <div className="mb-6 p-4 bg-(--bg-tertiary) rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">
                    {editingEmoji ? <Trans>Edit Emoji</Trans> : <Trans>Add New Emoji</Trans>}
                  </h3>
                  <button
                    onClick={resetForm}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <Trans>Name</Trans> *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                      }
                      placeholder={t`emoji_name`}
                      className="w-full px-3 py-2 border rounded-md"
                      pattern="[a-z0-9_-]+"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <Trans>Lowercase letters, numbers, underscores, and hyphens only</Trans>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <Trans>Image</Trans> *
                    </label>
                    {editingEmoji ? (
                      <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                        <img src={getProxiedImageUrl(url) || ""} alt="" className="w-6 h-6 object-contain" />
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {url}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-md cursor-pointer hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
                          <input
                            type="file"
                            accept="image/png,image/gif,image/webp"
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={isUploading}
                          />
                          {isUploading ? (
                            <>
                              <Spinner size="xs" />
                              <span className="text-sm">
                                <Trans>Uploading...</Trans>
                              </span>
                            </>
                          ) : selectedFile ? (
                            <>
                              <img src={getProxiedImageUrl(url) || ""} alt="" className="w-6 h-6 object-contain" />
                              <span className="text-sm text-green-600">{selectedFile.name}</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                <Trans>Click to upload (PNG, GIF, WebP, max 256KB)</Trans>
                              </span>
                            </>
                          )}
                        </label>
                        {url && !selectedFile && (
                          <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/emoji.png"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <Trans>Category</Trans>
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder={t`e.g., reactions, animals`}
                      className="w-full px-3 py-2 border rounded-md"
                      list="category-list"
                    />
                    <datalist id="category-list">
                      {categories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <Trans>Aliases</Trans>
                    </label>
                    <input
                      type="text"
                      value={aliases}
                      onChange={(e) => setAliases(e.target.value)}
                      placeholder={t`comma, separated, aliases`}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      <Trans>License</Trans>
                    </label>
                    <input
                      type="text"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      placeholder={t`e.g., CC BY 4.0`}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isSensitive"
                      checked={isSensitive}
                      onChange={(e) => setIsSensitive(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="isSensitive" className="text-sm">
                      <Trans>Sensitive content (NSFW)</Trans>
                    </label>
                  </div>
                </div>

                {/* Preview */}
                {url && (
                  <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
                    <p className="text-sm font-medium mb-2">
                      <Trans>Preview</Trans>
                    </p>
                    <div className="flex items-center gap-3">
                      <img
                        src={getProxiedImageUrl(url) || ""}
                        alt={`:${name}:`}
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className="text-gray-600 dark:text-gray-400">
                        :{name || "emoji_name"}:
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="primary"
                    onPress={editingEmoji ? handleUpdateEmoji : handleAddEmoji}
                    isDisabled={isAdding || !name.trim() || (!editingEmoji && !url.trim())}
                  >
                    {isAdding ? (
                      <Spinner size="xs" />
                    ) : editingEmoji ? (
                      <Trans>Update Emoji</Trans>
                    ) : (
                      <Trans>Add Emoji</Trans>
                    )}
                  </Button>
                  <Button variant="secondary" onPress={resetForm}>
                    <Trans>Cancel</Trans>
                  </Button>
                </div>
              </div>
            )}

            {/* LOCAL EMOJIS TAB */}
            {activeTab === "local" && (
              <>
                {/* Bulk Actions Bar */}
                {isBulkMode && (
                  <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                        {selectedEmojis.size > 0 ? (
                          <Trans>{selectedEmojis.size} selected</Trans>
                        ) : (
                          <Trans>Click emojis to select</Trans>
                        )}
                      </span>
                      <div className="flex gap-2 ml-auto">
                        {emojis.length < totalEmojis ? (
                          <>
                            <Button variant="secondary" size="sm" onPress={selectAllFiltered}>
                              <CheckSquare className="w-4 h-4 mr-1" />
                              <Trans>Select Visible ({filteredEmojis.length})</Trans>
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onPress={loadAndSelectAll}
                              isDisabled={isLoadingMore}
                            >
                              {isLoadingMore ? (
                                <Spinner size="xs" />
                              ) : (
                                <>
                                  <CheckSquare className="w-4 h-4 mr-1" />
                                  <Trans>Select All ({totalEmojis})</Trans>
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button variant="secondary" size="sm" onPress={selectAllFiltered}>
                            <CheckSquare className="w-4 h-4 mr-1" />
                            <Trans>Select All</Trans>
                          </Button>
                        )}
                        {selectedEmojis.size > 0 && (
                          <>
                            <Button variant="secondary" size="sm" onPress={deselectAll}>
                              <Square className="w-4 h-4 mr-1" />
                              <Trans>Deselect</Trans>
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onPress={() => setShowBulkCategoryModal(true)}
                            >
                              <FolderInput className="w-4 h-4 mr-1" />
                              <Trans>Set Category</Trans>
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onPress={handleBulkDelete}
                              isDisabled={isBulkDeleting}
                            >
                              {isBulkDeleting ? (
                                <Spinner size="xs" />
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  <Trans>Delete</Trans>
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="mb-4 flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t`Search emojis...`}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="">{t`All Categories`}</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Emoji List */}
                {emojis.length === 0 ? (
                  <div className="text-center py-12">
                    <Smile className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-500 dark:text-gray-400">
                      <Trans>No custom emojis yet</Trans>
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      <Trans>Add your first custom emoji to get started</Trans>
                    </p>
                  </div>
                ) : filteredEmojis.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Trans>No emojis match your search</Trans>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedEmojis)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([categoryName, categoryEmojis]) => (
                        <div key={categoryName}>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                            {categoryName}
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {categoryEmojis.map((emoji) => {
                              const isSelected = selectedEmojis.has(emoji.id);
                              return (
                                <div
                                  key={emoji.id}
                                  onClick={isBulkMode ? () => toggleEmojiSelection(emoji.id) : undefined}
                                  className={`flex flex-col items-center p-3 bg-(--bg-tertiary) rounded-lg group relative transition-all ${
                                    isBulkMode
                                      ? `cursor-pointer ${
                                          isSelected
                                            ? "ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/30"
                                            : "hover:ring-2 hover:ring-primary-300"
                                        }`
                                      : ""
                                  }`}
                                >
                                  {/* Selection checkbox in bulk mode */}
                                  {isBulkMode && (
                                    <div className="absolute top-1 left-1">
                                      {isSelected ? (
                                        <CheckSquare className="w-5 h-5 text-primary-500" />
                                      ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                      )}
                                    </div>
                                  )}
                                  <img
                                    src={getProxiedImageUrl(emoji.url) || ""}
                                    alt={`:${emoji.name}:`}
                                    className="w-10 h-10 object-contain mb-2"
                                  />
                                  <span
                                    className="text-xs text-center truncate w-full"
                                    title={`:${emoji.name}:`}
                                  >
                                    :{emoji.name}:
                                  </span>
                                  {emoji.isSensitive && (
                                    <span className="text-xs text-orange-500 mt-1">NSFW</span>
                                  )}
                                  {/* Action buttons (hidden in bulk mode) */}
                                  {!isBulkMode && (
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleEditEmoji(emoji)}
                                        className="p-1 bg-white dark:bg-gray-700 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-600"
                                        title={t`Edit`}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteEmoji(emoji)}
                                        className="p-1 bg-white dark:bg-gray-700 rounded shadow hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500"
                                        title={t`Delete`}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Stats and Load More */}
                <div className="mt-6 pt-4 border-t dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {emojis.length < totalEmojis ? (
                      <Trans>Showing {emojis.length} of {totalEmojis} emojis</Trans>
                    ) : (
                      <Trans>Total: {totalEmojis} emojis</Trans>
                    )}
                    {categories.length > 0 && (
                      <span className="ml-4">
                        <Trans>{categories.length} categories</Trans>
                      </span>
                    )}
                  </div>
                  {emojis.length < totalEmojis && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => loadEmojis(true)}
                      isDisabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Spinner size="xs" />
                          <span className="ml-1"><Trans>Loading...</Trans></span>
                        </>
                      ) : (
                        <Trans>Load All ({totalEmojis - emojis.length} more)</Trans>
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* REMOTE EMOJIS TAB */}
            {activeTab === "remote" && (
              <>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <Trans>
                      Remote emojis are collected from reactions received from other servers.
                      You can adopt them as local emojis to use on your instance.
                    </Trans>
                  </p>

                  {/* Host filter */}
                  {remoteHosts.length > 0 && (
                    <div className="flex gap-4">
                      <select
                        value={filterHost}
                        onChange={(e) => {
                          setFilterHost(e.target.value);
                        }}
                        className="px-3 py-2 border rounded-md"
                      >
                        <option value="">{t`All Servers`}</option>
                        {remoteHosts.map((host) => (
                          <option key={host} value={host}>
                            {host}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {isLoadingRemote ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" />
                  </div>
                ) : remoteEmojis.length === 0 ? (
                  <div className="text-center py-12">
                    <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-500 dark:text-gray-400">
                      <Trans>No remote emojis collected yet</Trans>
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      <Trans>Remote emojis will appear here when users from other servers react with custom emojis</Trans>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {remoteEmojis
                        .filter((emoji) => !filterHost || emoji.host === filterHost)
                        .map((emoji) => (
                          <div
                            key={emoji.id}
                            className="flex flex-col items-center p-3 bg-(--bg-tertiary) rounded-lg group relative"
                          >
                            <img
                              src={getProxiedImageUrl(emoji.url) || ""}
                              alt={`:${emoji.name}:`}
                              className="w-10 h-10 object-contain mb-2"
                            />
                            <span
                              className="text-xs text-center truncate w-full"
                              title={`:${emoji.name}:`}
                            >
                              :{emoji.name}:
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate w-full text-center">
                              @{emoji.host}
                            </span>
                            {/* Adopt button */}
                            <button
                              onClick={() => handleAdoptEmoji(emoji)}
                              disabled={adoptingEmoji === emoji.id}
                              className="mt-2 px-2 py-1 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded flex items-center gap-1 disabled:opacity-50"
                              title={t`Adopt as local emoji`}
                            >
                              {adoptingEmoji === emoji.id ? (
                                <Spinner size="xs" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              <Trans>Adopt</Trans>
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Stats */}
                    <div className="mt-6 pt-4 border-t dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                      <Trans>Total: {remoteEmojis.length} remote emojis from {remoteHosts.length} servers</Trans>
                    </div>
                  </>
                )}
              </>
            )}

            {/* BULK IMPORT TAB */}
            {activeTab === "import" && (
              <>
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">
                    <Trans>Bulk Import Emojis</Trans>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <Trans>
                      Upload a ZIP file containing emoji images. You can optionally include a meta.json file
                      to specify emoji names, categories, and other metadata.
                    </Trans>
                  </p>

                  {/* ZIP format info */}
                  <div className="p-4 bg-(--bg-tertiary) rounded-lg mb-4">
                    <h4 className="font-medium text-sm mb-2">
                      <Trans>ZIP Format</Trans>
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                      <li><Trans>Supported formats: PNG, GIF, WebP, APNG</Trans></li>
                      <li><Trans>Maximum file size per emoji: 256KB</Trans></li>
                      <li><Trans>Maximum ZIP size: 50MB</Trans></li>
                      <li><Trans>Emoji names are derived from filenames if no meta.json is provided</Trans></li>
                    </ul>

                    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-600">
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mb-1">
                        meta.json (optional):
                      </p>
                      <pre className="text-xs font-mono text-gray-500 dark:text-gray-500 overflow-x-auto">
{`[
  {
    "name": "emoji_name",
    "file": "emoji_name.png",
    "category": "reactions",
    "aliases": ["alias1", "alias2"],
    "license": "CC BY 4.0",
    "isSensitive": false
  }
]`}
                      </pre>
                    </div>
                  </div>

                  {/* Upload area */}
                  <label
                    className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      isDragging
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                        : "hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleZipImport}
                      className="hidden"
                      disabled={isImporting}
                    />
                    {isImporting ? (
                      <>
                        <Spinner size="lg" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          <Trans>Importing emojis...</Trans>
                        </span>
                      </>
                    ) : isDragging ? (
                      <>
                        <Archive className="w-12 h-12 text-primary-500" />
                        <span className="text-sm text-primary-500 font-medium">
                          <Trans>Drop ZIP file here</Trans>
                        </span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          <Trans>Click to select a ZIP file or drag and drop</Trans>
                        </span>
                      </>
                    )}
                  </label>
                </div>

                {/* Import results */}
                {importResult && (
                  <div className="p-4 bg-(--bg-tertiary) rounded-lg">
                    <h4 className="font-medium mb-3">
                      <Trans>Import Results</Trans>
                    </h4>
                    <div className="flex gap-4 mb-4">
                      <div className="text-center px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {importResult.success}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          <Trans>Added</Trans>
                        </div>
                      </div>
                      <div className="text-center px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {importResult.skipped}
                        </div>
                        <div className="text-xs text-yellow-600 dark:text-yellow-400">
                          <Trans>Skipped</Trans>
                        </div>
                      </div>
                      <div className="text-center px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {importResult.failed}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">
                          <Trans>Failed</Trans>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    {importResult.details.length > 0 && (
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-gray-500 dark:text-gray-400">
                            <tr>
                              <th className="pb-2"><Trans>Emoji</Trans></th>
                              <th className="pb-2"><Trans>Status</Trans></th>
                              <th className="pb-2"><Trans>Reason</Trans></th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.details.map((detail, index) => (
                              <tr key={index} className="border-t dark:border-gray-700">
                                <td className="py-1">:{detail.name}:</td>
                                <td className="py-1">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      detail.status === "success"
                                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                        : detail.status === "skipped"
                                          ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                                          : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                    }`}
                                  >
                                    {detail.status}
                                  </span>
                                </td>
                                <td className="py-1 text-gray-500 dark:text-gray-400">
                                  {detail.reason || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk Category Modal */}
      {showBulkCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                <Trans>Set Category</Trans>
              </h3>
              <button
                onClick={() => {
                  setShowBulkCategoryModal(false);
                  setBulkCategory("");
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <Trans>Set category for {selectedEmojis.size} selected emojis</Trans>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                <Trans>Category</Trans>
              </label>
              <div className="flex gap-2">
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">{t`Uncategorized`}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  placeholder={t`Or enter new category`}
                  className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onPress={() => {
                  setShowBulkCategoryModal(false);
                  setBulkCategory("");
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                onPress={handleBulkCategoryUpdate}
                isDisabled={isBulkUpdating}
              >
                {isBulkUpdating ? <Spinner size="xs" /> : <Trans>Apply</Trans>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
