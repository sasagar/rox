"use client";

/**
 * Lists Page Component
 *
 * Displays all lists owned by the current user with create/edit/delete actions.
 *
 * @module pages/lists
 */

import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { useAtom, useSetAtom } from "jotai";
import { List as ListIcon, Plus, Loader2 } from "lucide-react";
import { Layout } from "../../components/layout/Layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { ListCard } from "../../components/list/ListCard";
import { ListCreateModal } from "../../components/list/ListCreateModal";
import { ListEditModal } from "../../components/list/ListEditModal";
import { ListDeleteConfirmDialog } from "../../components/list/ListDeleteConfirmDialog";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import {
  myListsAtom,
  myListsLoadingAtom,
  myListsErrorAtom,
  addListAtom,
  updateListAtom,
  removeListAtom,
} from "../../lib/atoms/lists";
import { listsApi, type List, type ListWithMemberCount } from "../../lib/api/lists";
import { apiClient } from "../../lib/api/client";

/**
 * Lists page - displays all lists owned by the current user
 */
export default function ListsPage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [lists, setLists] = useAtom(myListsAtom);
  const [loading, setLoading] = useAtom(myListsLoadingAtom);
  const [error, setError] = useAtom(myListsErrorAtom);
  const addList = useSetAtom(addListAtom);
  const updateList = useSetAtom(updateListAtom);
  const removeList = useSetAtom(removeListAtom);

  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingList, setEditingList] = useState<ListWithMemberCount | null>(null);
  const [deletingList, setDeletingList] = useState<ListWithMemberCount | null>(null);
  const [hasFetchedLists, setHasFetchedLists] = useState(false);

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      // No token at all, redirect to login
      if (!token) {
        window.location.href = "/login";
        return;
      }

      // Token exists but no user data, try to restore session
      if (!currentUser) {
        try {
          apiClient.setToken(token);
          const response = await apiClient.get<{ user: any }>("/api/auth/session");
          setCurrentUser(response.user);
          setIsLoading(false);
        } catch (error) {
          console.error("Failed to restore session:", error);
          // Token is invalid, redirect to login
          window.location.href = "/login";
          return;
        }
      } else {
        // Already have user data, just stop loading
        setIsLoading(false);
      }
    };
    restoreSession();
  }, [token, currentUser, setCurrentUser]);

  // Fetch lists when user is loaded (only once)
  useEffect(() => {
    const fetchLists = async () => {
      if (!currentUser || !token || hasFetchedLists) return;

      apiClient.setToken(token);
      setLoading(true);
      setError(null);

      try {
        const userLists = await listsApi.list();
        setLists(userLists);
        setHasFetchedLists(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lists");
      } finally {
        setLoading(false);
      }
    };

    if (currentUser && token && !hasFetchedLists) {
      fetchLists();
    }
  }, [currentUser, token, hasFetchedLists, setLists, setLoading, setError]);

  // Handle list created
  const handleListCreated = (list: List) => {
    // Add with memberCount: 0 since it's new
    addList({ ...list, memberCount: 0 });
  };

  // Handle list updated
  const handleListUpdated = (list: List) => {
    updateList(list);
    setEditingList(null);
  };

  // Handle list deleted
  const handleListDeleted = () => {
    if (deletingList) {
      removeList(deletingList.id);
      setDeletingList(null);
    }
  };

  // Show loading while checking auth
  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  const pageHeader = (
    <PageHeader
      title={<Trans>My Lists</Trans>}
      icon={<ListIcon className="w-6 h-6" />}
      actions={[
        {
          key: "create",
          label: <Trans>Create List</Trans>,
          icon: <Plus className="w-4 h-4" />,
          onPress: () => setShowCreateModal(true),
          variant: "primary",
        },
      ]}
    />
  );

  return (
    <Layout header={pageHeader}>
      <div className="max-w-2xl mx-auto">
        {/* Lists Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-(--text-muted)" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <Button
              variant="ghost"
              onPress={() => {
                if (token) {
                  apiClient.setToken(token);
                  setLoading(true);
                  setError(null);
                  listsApi.list()
                    .then(setLists)
                    .catch(err => setError(err instanceof Error ? err.message : "Failed to load lists"))
                    .finally(() => setLoading(false));
                }
              }}
              className="text-primary-500 hover:text-primary-600"
            >
              <Trans>Try again</Trans>
            </Button>
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-(--text-muted)">
            <ListIcon className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
              <Trans>No lists yet</Trans>
            </p>
            <p className="text-sm mt-1 mb-4">
              <Trans>Create your first list to organize users</Trans>
            </p>
            <Button
              variant="primary"
              onPress={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <Trans>Create List</Trans>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                isOwner={true}
                showActions={true}
                onEdit={() => setEditingList(list)}
                onDelete={() => setDeletingList(list)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <ListCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleListCreated}
      />

      {/* Edit Modal */}
      {editingList && (
        <ListEditModal
          isOpen={true}
          onClose={() => setEditingList(null)}
          list={editingList}
          onUpdated={handleListUpdated}
        />
      )}

      {/* Delete Confirm Dialog */}
      {deletingList && (
        <ListDeleteConfirmDialog
          isOpen={true}
          onClose={() => setDeletingList(null)}
          list={deletingList}
          onDeleted={handleListDeleted}
        />
      )}
    </Layout>
  );
}
