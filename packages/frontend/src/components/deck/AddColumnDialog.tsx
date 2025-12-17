"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  Dialog,
  Modal,
  ModalOverlay,
  Heading,
} from "react-aria-components";
import {
  LayoutGrid,
  Bell,
  AtSign,
  ListIcon,
  Home,
  Globe,
  Users,
  Radio,
  X,
  Loader2,
} from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "../ui/Button";
import { myListsAtom, myListsLoadingAtom, myListsErrorAtom } from "../../lib/atoms/lists";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { listsApi } from "../../lib/api/lists";
import { useDeckProfiles } from "../../hooks/useDeckProfiles";
import type {
  DeckColumn,
  DeckColumnConfig,
  TimelineType,
} from "../../lib/types/deck";

/**
 * Props for AddColumnDialog
 */
export interface AddColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Column type option for selection
 */
interface ColumnTypeOption {
  type: DeckColumnConfig["type"];
  label: string;
  icon: React.ReactNode;
  description: string;
}

/**
 * Timeline subtype option
 */
interface TimelineOption {
  type: TimelineType;
  label: string;
  icon: React.ReactNode;
}

/**
 * Generate a unique column ID
 */
function generateColumnId(): string {
  return `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Dialog for adding a new column to the deck
 */
export function AddColumnDialog({ isOpen, onClose }: AddColumnDialogProps) {
  const { t } = useLingui();
  const { activeProfile, updateActiveColumns } = useDeckProfiles();
  const [myLists, setMyLists] = useAtom(myListsAtom);
  const [listsLoading, setListsLoading] = useAtom(myListsLoadingAtom);
  const [listsError, setListsError] = useAtom(myListsErrorAtom);
  const currentUser = useAtomValue(currentUserAtom);
  const token = useAtomValue(tokenAtom);
  const columns = activeProfile?.columns ?? [];
  const [selectedType, setSelectedType] = useState<
    DeckColumnConfig["type"] | null
  >(null);
  const [selectedTimeline, setSelectedTimeline] =
    useState<TimelineType>("home");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [hasFetchedLists, setHasFetchedLists] = useState(false);

  // Translated column types
  const columnTypes: ColumnTypeOption[] = useMemo(() => [
    {
      type: "timeline",
      label: t`Timeline`,
      icon: <LayoutGrid className="w-5 h-5" />,
      description: t`View posts from a timeline`,
    },
    {
      type: "notifications",
      label: t`Notifications`,
      icon: <Bell className="w-5 h-5" />,
      description: t`View your notifications`,
    },
    {
      type: "mentions",
      label: t`Mentions`,
      icon: <AtSign className="w-5 h-5" />,
      description: t`View posts mentioning you`,
    },
    {
      type: "list",
      label: t`List`,
      icon: <ListIcon className="w-5 h-5" />,
      description: t`View posts from a list`,
    },
  ], [t]);

  // Translated timeline options
  const timelineOptions: TimelineOption[] = useMemo(() => [
    { type: "home", label: t`Home`, icon: <Home className="w-4 h-4" /> },
    { type: "local", label: t`Local`, icon: <Users className="w-4 h-4" /> },
    { type: "social", label: t`Social`, icon: <Radio className="w-4 h-4" /> },
    { type: "global", label: t`Global`, icon: <Globe className="w-4 h-4" /> },
  ], [t]);

  // Fetch lists function - shared between initial load and retry
  const fetchLists = useCallback(async () => {
    if (!currentUser || !token || listsLoading) return;

    setListsLoading(true);
    setListsError(null);

    try {
      const userLists = await listsApi.list();
      setMyLists(userLists);
      setHasFetchedLists(true);
    } catch (err) {
      setListsError(err instanceof Error ? err.message : t`Failed to load lists`);
    } finally {
      setListsLoading(false);
    }
  }, [currentUser, token, listsLoading, setListsLoading, setListsError, setMyLists, t]);

  // Auto-fetch lists when dialog opens with list type selected
  useEffect(() => {
    let cancelled = false;

    if (isOpen && selectedType === "list" && !hasFetchedLists && !listsLoading) {
      const doFetch = async () => {
        if (!currentUser || !token) return;

        setListsLoading(true);
        setListsError(null);

        try {
          const userLists = await listsApi.list();
          if (!cancelled) {
            setMyLists(userLists);
            setHasFetchedLists(true);
          }
        } catch (err) {
          if (!cancelled) {
            setListsError(err instanceof Error ? err.message : t`Failed to load lists`);
          }
        } finally {
          if (!cancelled) {
            setListsLoading(false);
          }
        }
      };
      doFetch();
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedType, hasFetchedLists, listsLoading, currentUser, token, setListsLoading, setListsError, setMyLists, t]);

  const handleClose = useCallback(() => {
    setSelectedType(null);
    setSelectedTimeline("home");
    setSelectedListId(null);
    onClose();
  }, [onClose]);

  const handleAddColumn = useCallback(() => {
    if (!selectedType) return;

    let config: DeckColumnConfig;

    switch (selectedType) {
      case "timeline":
        config = { type: "timeline", timelineType: selectedTimeline };
        break;
      case "notifications":
        config = { type: "notifications" };
        break;
      case "mentions":
        config = { type: "mentions" };
        break;
      case "list": {
        if (!selectedListId) return;
        const list = myLists.find((l) => l.id === selectedListId);
        config = {
          type: "list",
          listId: selectedListId,
          listName: list?.name,
        };
        break;
      }
      default:
        return;
    }

    const column: DeckColumn = {
      id: generateColumnId(),
      config,
      width: "normal",
    };

    // Add column to the active profile and sync to server
    updateActiveColumns([...columns, column]);
    handleClose();
  }, [selectedType, selectedTimeline, selectedListId, myLists, columns, updateActiveColumns, handleClose]);

  const canAdd =
    selectedType &&
    (selectedType !== "list" || selectedListId);

  // Get selected column type label for confirmation
  const selectedTypeLabel = columnTypes.find((ct) => ct.type === selectedType)?.label;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      isDismissable
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <Modal className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <Dialog className="outline-none">
          {() => (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <Heading
                  slot="title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  <Trans>Add Column</Trans>
                </Heading>
                <Button
                  variant="ghost"
                  onPress={handleClose}
                  className="p-1 rounded-full"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {!selectedType ? (
                  /* Step 1: Select column type */
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <Trans>Select a column type to add:</Trans>
                    </p>
                    {columnTypes.map((option) => (
                      <button
                        type="button"
                        key={option.type}
                        onClick={() => setSelectedType(option.type)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                      >
                        <div className="shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
                          {option.icon}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : selectedType === "timeline" ? (
                  /* Step 2a: Select timeline type */
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedType(null)}
                      className="text-sm text-primary-500 hover:text-primary-600 mb-4 flex items-center gap-1"
                    >
                      ← <Trans>Back</Trans>
                    </button>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <Trans>Select timeline type:</Trans>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {timelineOptions.map((option) => (
                        <button
                          type="button"
                          key={option.type}
                          onClick={() => setSelectedTimeline(option.type)}
                          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                            selectedTimeline === option.type
                              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          }`}
                        >
                          {option.icon}
                          <span className="font-medium">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : selectedType === "list" ? (
                  /* Step 2b: Select list */
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedType(null)}
                      className="text-sm text-primary-500 hover:text-primary-600 mb-4 flex items-center gap-1"
                    >
                      ← <Trans>Back</Trans>
                    </button>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <Trans>Select a list:</Trans>
                    </p>
                    {listsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" aria-label={t`Loading`} />
                      </div>
                    ) : listsError ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-red-500 mb-2">{listsError}</p>
                        <button
                          type="button"
                          onClick={fetchLists}
                          className="text-sm text-primary-500 hover:text-primary-600"
                        >
                          <Trans>Try again</Trans>
                        </button>
                      </div>
                    ) : myLists.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        <Trans>You don't have any lists yet.</Trans>
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {myLists.map((list) => (
                          <button
                            type="button"
                            key={list.id}
                            onClick={() => setSelectedListId(list.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                              selectedListId === list.id
                                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            }`}
                          >
                            <ListIcon className="w-5 h-5 text-gray-500" />
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {list.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {list.memberCount}{" "}
                                <Trans>members</Trans>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Step 2c: Confirmation for other types */
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSelectedType(null)}
                      className="text-sm text-primary-500 hover:text-primary-600 mb-4 flex items-center gap-1"
                    >
                      ← <Trans>Back</Trans>
                    </button>
                    <div className="text-center py-4">
                      <p className="text-gray-600 dark:text-gray-400">
                        <Trans>
                          Add a {selectedTypeLabel} column?
                        </Trans>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="secondary" onPress={handleClose}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="primary"
                  onPress={handleAddColumn}
                  isDisabled={!canAdd}
                >
                  <Trans>Add Column</Trans>
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
