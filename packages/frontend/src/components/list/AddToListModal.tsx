"use client";

/**
 * Add To List Modal Component
 *
 * Modal for adding a user to one or more lists.
 * Shows all user's lists with checkboxes to add/remove the target user.
 * Built with React Aria Components for accessibility.
 *
 * @module components/list/AddToListModal
 */

import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { X, List as ListIcon, Loader2, Plus, Check } from "lucide-react";
import {
  Dialog,
  Modal,
  ModalOverlay,
  Heading,
  Button as AriaButton,
} from "react-aria-components";
import { useAtom, useSetAtom } from "jotai";
import { listsApi, type ListWithMemberCount, type List } from "../../lib/api/lists";
import { myListsAtom, addListAtom, updateListMemberCountAtom } from "../../lib/atoms/lists";
import { addToastAtom } from "../../lib/atoms/toast";
import { tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { ListCreateModal } from "./ListCreateModal";

/**
 * Props for AddToListModal component
 */
export interface AddToListModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** User ID to add to lists */
  userId: string;
  /** User display name for the title */
  username: string;
}

/**
 * List item with checkbox for selection
 */
interface ListItemProps {
  list: ListWithMemberCount;
  isInList: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

function ListItem({ list, isInList, isLoading, onToggle }: ListItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isLoading}
      className="flex items-center gap-3 p-3 w-full hover:bg-(--bg-secondary) transition-colors rounded-lg text-left disabled:opacity-50"
    >
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          isInList
            ? "bg-primary-500 border-primary-500"
            : "border-gray-300 dark:border-gray-600"
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin text-white" />
        ) : isInList ? (
          <Check className="w-3 h-3 text-white" />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-(--text-primary) truncate">{list.name}</p>
        <p className="text-sm text-(--text-muted)">
          {list.memberCount} {list.memberCount === 1 ? <Trans>member</Trans> : <Trans>members</Trans>}
        </p>
      </div>
    </button>
  );
}

/**
 * Add To List Modal
 *
 * Features:
 * - Shows all user's lists with current membership status
 * - Toggle to add/remove user from each list
 * - Create new list button
 * - Loading states for individual operations
 *
 * @example
 * ```tsx
 * <AddToListModal
 *   isOpen={showAddToList}
 *   onClose={() => setShowAddToList(false)}
 *   userId={user.id}
 *   username={user.username}
 * />
 * ```
 */
export function AddToListModal({
  isOpen,
  onClose,
  userId,
  username,
}: AddToListModalProps) {
  const [lists, setLists] = useAtom(myListsAtom);
  const addList = useSetAtom(addListAtom);
  const updateMemberCount = useSetAtom(updateListMemberCountAtom);
  const [, addToast] = useAtom(addToastAtom);
  const [token] = useAtom(tokenAtom);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containingListIds, setContainingListIds] = useState<Set<string>>(new Set());
  const [loadingListIds, setLoadingListIds] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);

  // Fetch lists when modal opens for a new user
  useEffect(() => {
    const fetchLists = async () => {
      // Skip if modal is closed, no token, or already fetched for this user
      if (!isOpen || !token || fetchedForUserId === userId) return;

      setLoading(true);
      setError(null);
      apiClient.setToken(token);

      try {
        // Fetch user's lists
        const userLists = await listsApi.list();
        setLists(userLists);

        // Fetch which lists contain this user
        const containingLists = await listsApi.getContaining(userId);
        setContainingListIds(new Set(containingLists.map((l) => l.id)));
        setFetchedForUserId(userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lists");
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, [isOpen, token, userId, fetchedForUserId, setLists]);

  // Reset fetch state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFetchedForUserId(null);
    }
  }, [isOpen]);

  // Manual retry function
  const handleRetry = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);
    apiClient.setToken(token);

    try {
      const userLists = await listsApi.list();
      setLists(userLists);
      const containingLists = await listsApi.getContaining(userId);
      setContainingListIds(new Set(containingLists.map((l) => l.id)));
      setFetchedForUserId(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lists");
    } finally {
      setLoading(false);
    }
  };

  // Handle toggle list membership
  const handleToggle = async (listId: string) => {
    if (!token) return;

    const isInList = containingListIds.has(listId);
    setLoadingListIds((prev) => new Set(prev).add(listId));
    apiClient.setToken(token);

    try {
      if (isInList) {
        // Remove from list
        await listsApi.pull(listId, userId);
        setContainingListIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(listId);
          return newSet;
        });
        updateMemberCount(listId, -1);
        addToast({
          type: "success",
          message: `Removed from list`,
        });
      } else {
        // Add to list
        await listsApi.push(listId, userId);
        setContainingListIds((prev) => new Set(prev).add(listId));
        updateMemberCount(listId, 1);
        addToast({
          type: "success",
          message: `Added to list`,
        });
      }
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update list",
      });
    } finally {
      setLoadingListIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(listId);
        return newSet;
      });
    }
  };

  // Handle list created
  const handleListCreated = async (newList: List) => {
    if (!token) return;

    // Add to local state with memberCount: 0
    addList({ ...newList, memberCount: 0 });
    setShowCreateModal(false);

    // Automatically add the user to the new list
    setLoadingListIds((prev) => new Set(prev).add(newList.id));
    apiClient.setToken(token);

    try {
      await listsApi.push(newList.id, userId);
      setContainingListIds((prev) => new Set(prev).add(newList.id));
      updateMemberCount(newList.id, 1);
      addToast({
        type: "success",
        message: `Added to "${newList.name}"`,
      });
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to add to list",
      });
    } finally {
      setLoadingListIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(newList.id);
        return newSet;
      });
    }
  };

  return (
    <>
      <ModalOverlay
        isOpen={isOpen && !showCreateModal}
        onOpenChange={(open) => !open && onClose()}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      >
        <Modal className="w-full max-w-md max-h-[80vh] bg-(--card-bg) rounded-xl shadow-xl overflow-hidden flex flex-col outline-none">
          <Dialog className="flex flex-col h-full outline-none">
            {({ close }) => (
              <>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-(--border-color)">
                  <div className="flex items-center gap-2">
                    <ListIcon className="w-5 h-5 text-(--text-muted)" />
                    <Heading
                      slot="title"
                      className="text-lg font-semibold text-(--text-primary)"
                    >
                      <Trans>Add @{username} to list</Trans>
                    </Heading>
                  </div>
                  <AriaButton
                    onPress={close}
                    className="p-2 hover:bg-(--bg-secondary) rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-(--text-muted)" />
                  </AriaButton>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-(--text-muted)" />
                    </div>
                  ) : error ? (
                    <div className="text-center py-12">
                      <p className="text-red-500 mb-4">{error}</p>
                      <Button variant="secondary" onPress={handleRetry}>
                        <Trans>Try again</Trans>
                      </Button>
                    </div>
                  ) : lists.length === 0 ? (
                    <div className="text-center py-12 text-(--text-muted)">
                      <ListIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">
                        <Trans>No lists yet</Trans>
                      </p>
                      <p className="text-sm mt-1 mb-4">
                        <Trans>Create a list to organize users</Trans>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {lists.map((list) => (
                        <ListItem
                          key={list.id}
                          list={list}
                          isInList={containingListIds.has(list.id)}
                          isLoading={loadingListIds.has(list.id)}
                          onToggle={() => handleToggle(list.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer with create button */}
                <div className="p-4 border-t border-(--border-color)">
                  <Button
                    variant="secondary"
                    onPress={() => setShowCreateModal(true)}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    <Trans>Create new list</Trans>
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>

      {/* Create List Modal */}
      <ListCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleListCreated}
      />
    </>
  );
}
