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
import { Trash2, Plus, RefreshCw, Smile, Edit2, X, Upload, Download, Globe, Archive } from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
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
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadEmojis = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<EmojisResponse>("/api/emojis");
      setEmojis(response.emojis);
    } catch (err) {
      console.error("Failed to load emojis:", err);
      setError("Failed to load custom emojis");
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

  const handleZipImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

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

      const response = await fetch("/api/emojis/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
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
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : t`Failed to import emojis`,
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      e.target.value = "";
    }
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

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <AdminNav currentPath="/admin/emojis" />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Smile className="w-5 h-5" />
                <Trans>Custom Emojis</Trans>
              </CardTitle>
              <div className="flex gap-2">
                {activeTab === "local" && (
                  <>
                    <Button variant="secondary" size="sm" onPress={() => loadEmojis()}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      <Trans>Refresh</Trans>
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onPress={() => {
                        resetForm();
                        setShowAddForm(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      <Trans>Add Emoji</Trans>
                    </Button>
                  </>
                )}
                {activeTab === "remote" && (
                  <Button variant="secondary" size="sm" onPress={() => loadRemoteEmojis()}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    <Trans>Refresh</Trans>
                  </Button>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mt-4 border-b dark:border-gray-700">
              <button
                onClick={() => setActiveTab("local")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "local"
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Smile className="w-4 h-4 inline mr-1" />
                <Trans>Local Emojis</Trans>
              </button>
              <button
                onClick={() => setActiveTab("remote")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "remote"
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Globe className="w-4 h-4 inline mr-1" />
                <Trans>Remote Emojis</Trans>
              </button>
              <button
                onClick={() => setActiveTab("import")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "import"
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Archive className="w-4 h-4 inline mr-1" />
                <Trans>Bulk Import</Trans>
              </button>
            </div>
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
                        setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                      }
                      placeholder={t`emoji_name`}
                      className="w-full px-3 py-2 border rounded-md"
                      pattern="[a-z0-9_]+"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <Trans>Lowercase letters, numbers, and underscores only</Trans>
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
                            {categoryEmojis.map((emoji) => (
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
                                {emoji.isSensitive && (
                                  <span className="text-xs text-orange-500 mt-1">NSFW</span>
                                )}
                                {/* Action buttons */}
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
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Stats */}
                <div className="mt-6 pt-4 border-t dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                  <Trans>Total: {emojis.length} emojis</Trans>
                  {categories.length > 0 && (
                    <span className="ml-4">
                      <Trans>{categories.length} categories</Trans>
                    </span>
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
                  <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors">
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
    </Layout>
  );
}
