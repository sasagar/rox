"use client";

/**
 * Drive Picker Dialog
 *
 * Modal dialog for selecting existing files from user's drive.
 * Supports multiple selection with a configurable maximum.
 * Includes folder navigation support.
 */

import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  Dialog as AriaDialog,
  Modal,
  ModalOverlay,
  Heading,
} from "react-aria-components";
import {
  X,
  Check,
  HardDrive,
  FileImage,
  FileVideo,
  FileAudio,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  Home,
  Plus,
} from "lucide-react";
import { tokenAtom } from "../../lib/atoms/auth";
import {
  listFiles,
  listFolders,
  createFolder,
  getFolderPath,
  type DriveFile,
  type DriveFolder,
} from "../../lib/api/drive";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";

/**
 * Props for DrivePickerDialog
 */
export interface DrivePickerDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when files are selected */
  onSelect: (files: DriveFile[]) => void;
  /** Maximum number of files that can be selected */
  maxFiles?: number;
  /** Currently selected file count (from other sources like new uploads) */
  currentFileCount?: number;
  /** File types to show (default: all) */
  fileTypes?: ("image" | "video" | "audio" | "other")[];
}

/**
 * Get appropriate icon for file type
 */
function getFileIcon(type: string) {
  if (type.startsWith("image/")) {
    return <FileImage className="w-8 h-8 text-blue-500" />;
  }
  if (type.startsWith("video/")) {
    return <FileVideo className="w-8 h-8 text-purple-500" />;
  }
  if (type.startsWith("audio/")) {
    return <FileAudio className="w-8 h-8 text-green-500" />;
  }
  return <File className="w-8 h-8 text-gray-500" />;
}

/**
 * Drive Picker Dialog Component
 *
 * Displays a modal with user's drive files for selection.
 * Supports pagination via "load more" button.
 */
export function DrivePickerDialog({
  isOpen,
  onClose,
  onSelect,
  maxFiles = 4,
  currentFileCount = 0,
  fileTypes,
}: DrivePickerDialogProps) {
  const [token] = useAtom(tokenAtom);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([]);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const remainingSlots = maxFiles - currentFileCount;

  // Load files and folders when dialog opens or folder changes
  useEffect(() => {
    if (isOpen && token) {
      loadContent();
      if (currentFolderId) {
        loadFolderPath();
      } else {
        setFolderPath([]);
      }
    }
    // Reset selection when dialog opens
    if (isOpen) {
      setSelectedFiles([]);
      setCurrentFolderId(null);
      setFolderPath([]);
    }
  }, [isOpen, token]);

  // Reload content when folder changes
  useEffect(() => {
    if (isOpen && token) {
      loadContent();
      if (currentFolderId) {
        loadFolderPath();
      } else {
        setFolderPath([]);
      }
    }
  }, [currentFolderId]);

  const loadFolderPath = async () => {
    if (!token || !currentFolderId) return;
    try {
      const path = await getFolderPath(currentFolderId, token);
      setFolderPath(path);
    } catch {
      // Ignore error, breadcrumb is optional
    }
  };

  const loadContent = async (untilId?: string) => {
    if (!token) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load folders and files in the current folder
      const [foldersData, filesData] = await Promise.all([
        untilId ? Promise.resolve([]) : listFolders({ parentId: currentFolderId }, token),
        listFiles({ limit: 20, untilId, folderId: currentFolderId }, token),
      ]);

      if (!untilId) {
        setFolders(foldersData);
      }

      // Filter by file types if specified
      let filteredFiles = filesData;
      if (fileTypes && fileTypes.length > 0) {
        filteredFiles = filesData.filter((file) => {
          if (fileTypes.includes("image") && file.type.startsWith("image/")) return true;
          if (fileTypes.includes("video") && file.type.startsWith("video/")) return true;
          if (fileTypes.includes("audio") && file.type.startsWith("audio/")) return true;
          if (fileTypes.includes("other")) {
            const isMedia =
              file.type.startsWith("image/") ||
              file.type.startsWith("video/") ||
              file.type.startsWith("audio/");
            return !isMedia;
          }
          return false;
        });
      }

      if (untilId) {
        setFiles((prev) => [...prev, ...filteredFiles]);
      } else {
        setFiles(filteredFiles);
      }

      setHasMore(filesData.length >= 20);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Failed to load files`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = useCallback(() => {
    const lastFile = files[files.length - 1];
    if (lastFile) {
      loadContent(lastFile.id);
    }
  }, [files]);

  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setFiles([]);
    setFolders([]);
    setHasMore(true);
  };

  const handleCreateFolder = async () => {
    if (!token || !newFolderName.trim()) return;

    try {
      setIsCreatingFolder(true);
      await createFolder(newFolderName.trim(), currentFolderId, token);
      setNewFolderName("");
      setShowNewFolderInput(false);
      // Reload folders
      const foldersData = await listFolders({ parentId: currentFolderId }, token);
      setFolders(foldersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Failed to create folder`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const toggleFileSelection = (file: DriveFile) => {
    setSelectedFiles((prev) => {
      const isSelected = prev.some((f) => f.id === file.id);
      if (isSelected) {
        return prev.filter((f) => f.id !== file.id);
      }
      // Check if we can add more files
      if (prev.length >= remainingSlots) {
        return prev;
      }
      return [...prev, file];
    });
  };

  const isSelected = (file: DriveFile) => selectedFiles.some((f) => f.id === file.id);

  const handleConfirm = () => {
    onSelect(selectedFiles);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <Modal className="w-full max-w-2xl max-h-[80vh] rounded-lg bg-white dark:bg-gray-800 shadow-xl flex flex-col">
        <AriaDialog className="outline-none flex flex-col h-full max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <Heading className="text-lg font-bold text-gray-900 dark:text-gray-100">
                <Trans>Select from Drive</Trans>
              </Heading>
            </div>
            <button
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={onClose}
              aria-label={t`Close`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            <button
              type="button"
              onClick={() => navigateToFolder(null)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700 ${
                currentFolderId === null
                  ? "text-primary-600 dark:text-primary-400 font-medium"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <Home className="w-4 h-4" />
              <Trans>Root</Trans>
            </button>
            {folderPath.map((folder) => (
              <div key={folder.id} className="flex items-center">
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <button
                  type="button"
                  onClick={() => navigateToFolder(folder.id)}
                  className={`px-2 py-1 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700 ${
                    currentFolderId === folder.id
                      ? "text-primary-600 dark:text-primary-400 font-medium"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {folder.name}
                </button>
              </div>
            ))}

            {/* New folder button */}
            <button
              type="button"
              onClick={() => setShowNewFolderInput(true)}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Plus className="w-4 h-4" />
              <Trans>New folder</Trans>
            </button>
          </div>

          {/* New folder input */}
          {showNewFolderInput && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
              <FolderOpen className="w-5 h-5 text-blue-500" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t`Folder name`}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") {
                    setShowNewFolderInput(false);
                    setNewFolderName("");
                  }
                }}
              />
              <Button
                variant="primary"
                size="sm"
                onPress={handleCreateFolder}
                isDisabled={!newFolderName.trim() || isCreatingFolder}
              >
                {isCreatingFolder ? <Spinner size="xs" /> : <Trans>Create</Trans>}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName("");
                }}
              >
                <Trans>Cancel</Trans>
              </Button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {isLoading && files.length === 0 && folders.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : files.length === 0 && folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <HardDrive className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-lg font-medium">
                  {currentFolderId ? <Trans>Empty folder</Trans> : <Trans>No files in drive</Trans>}
                </p>
                <p className="text-sm">
                  <Trans>Upload files to see them here</Trans>
                </p>
              </div>
            ) : (
              <>
                {/* Folders */}
                {folders.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {folders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => navigateToFolder(folder.id)}
                          className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
                        >
                          <Folder className="w-10 h-10 text-yellow-500 mb-1" />
                          <p className="text-xs text-gray-700 dark:text-gray-300 truncate w-full text-center">
                            {folder.name}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider between folders and files */}
                {folders.length > 0 && files.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 mb-4" />
                )}

                {/* File grid */}
                {files.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {files.map((file) => {
                      const selected = isSelected(file);
                      const canSelect = selected || selectedFiles.length < remainingSlots;

                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => canSelect && toggleFileSelection(file)}
                          disabled={!canSelect}
                          className={`
                            relative aspect-square rounded-lg overflow-hidden border-2 transition-all
                            ${selected ? "border-primary-500 ring-2 ring-primary-500/30" : "border-gray-200 dark:border-gray-700"}
                            ${canSelect ? "cursor-pointer hover:border-primary-400" : "cursor-not-allowed opacity-50"}
                            focus:outline-none focus:ring-2 focus:ring-primary-500
                          `}
                        >
                          {/* Thumbnail or icon */}
                          {file.thumbnailUrl || file.type.startsWith("image/") ? (
                            <img
                              src={getProxiedImageUrl(file.thumbnailUrl || file.url) || ""}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                              {getFileIcon(file.type)}
                            </div>
                          )}

                          {/* Selection indicator */}
                          {selected && (
                            <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}

                          {/* File name overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                            <p className="text-xs text-white truncate">{file.name}</p>
                          </div>

                          {/* Sensitive indicator */}
                          {file.isSensitive && (
                            <div className="absolute top-1 left-1 px-1 py-0.5 bg-orange-500 rounded text-[10px] text-white font-medium">
                              NSFW
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Load more button */}
                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={loadMore}
                      isDisabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <Spinner size="xs" />
                          <Trans>Loading...</Trans>
                        </div>
                      ) : (
                        <Trans>Load more</Trans>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <Trans>
                {selectedFiles.length} selected (up to {remainingSlots} remaining)
              </Trans>
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onPress={onClose}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                onPress={handleConfirm}
                isDisabled={selectedFiles.length === 0}
              >
                <Trans>Select</Trans>
              </Button>
            </div>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
