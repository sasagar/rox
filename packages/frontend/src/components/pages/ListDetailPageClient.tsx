"use client";

/**
 * List Detail Page Client Component
 *
 * Displays list timeline with header showing list info and actions.
 * Used by the /lists/[listId] page.
 *
 * @module components/pages/ListDetailPageClient
 */

import { useState, useEffect, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import { useAtom, useAtomValue } from "jotai";
import { List as ListIcon, Users, Lock, Globe, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { Layout } from "../layout/Layout";
import { PageHeader } from "../ui/PageHeader";
import { Spinner } from "../ui/Spinner";
import { ErrorMessage } from "../ui/ErrorMessage";
import { ListTimeline } from "../list/ListTimeline";
import { ListEditModal } from "../list/ListEditModal";
import { ListDeleteConfirmDialog } from "../list/ListDeleteConfirmDialog";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { listsApi, type List, type ListWithMemberCount } from "../../lib/api/lists";
import { apiClient } from "../../lib/api/client";

/**
 * Props for ListDetailPageClient component
 */
export interface ListDetailPageClientProps {
  /** List ID from URL */
  listId: string;
}

/**
 * List detail page client component
 *
 * Features:
 * - List header with name, member count, visibility
 * - Timeline of notes from list members
 * - Edit/delete actions for list owner
 * - Back navigation to lists page
 *
 * @param listId - The ID of the list to display
 */
export function ListDetailPageClient({ listId }: ListDetailPageClientProps) {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const token = useAtomValue(tokenAtom);

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [list, setList] = useState<ListWithMemberCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        // Allow unauthenticated access for public lists
        setIsAuthChecking(false);
        return;
      }

      if (!currentUser) {
        try {
          apiClient.setToken(token);
          const response = await apiClient.get<{ user: any }>("/api/auth/session");
          setCurrentUser(response.user);
        } catch (_error) {
          // Continue without auth - may be viewing public list
        }
      }
      setIsAuthChecking(false);
    };
    restoreSession();
  }, [token, currentUser, setCurrentUser]);

  // Fetch list details
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Ensure token is set before API calls
    if (token) {
      apiClient.setToken(token);
    }

    try {
      const listData = await listsApi.show(listId);
      // Get member count by fetching memberships
      const members = await listsApi.getMemberships(listId, 1, 0);
      // The show endpoint returns List, we need to add memberCount
      // For now, we'll use a workaround - fetch the list from user's lists if owner
      setList({
        ...listData,
        memberCount: members.length > 0 ? members.length : 0,
      } as ListWithMemberCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }, [listId, token]);

  // Load list on mount (after auth check)
  useEffect(() => {
    if (!isAuthChecking) {
      fetchList();
    }
  }, [isAuthChecking, fetchList]);

  // Handle list updated
  const handleListUpdated = (updatedList: List) => {
    setList((prev) => (prev ? { ...prev, ...updatedList } : null));
    setShowEditModal(false);
  };

  // Handle list deleted
  const handleListDeleted = () => {
    // Navigate back to lists page
    window.location.href = "/lists";
  };

  // Check if current user is the list owner
  const isOwner = currentUser && list && currentUser.id === list.userId;

  // Show loading while checking auth
  if (isAuthChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <Spinner size="lg" />
      </div>
    );
  }

  // Show loading while fetching list
  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  // Show error if list not found
  if (error || !list) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <ErrorMessage
            title={<Trans>List not found</Trans>}
            message={error || "The list you're looking for doesn't exist or is private."}
          />
          <a href="/lists" className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:underline">
            <ArrowLeft className="w-4 h-4" />
            <Trans>Back to lists</Trans>
          </a>
        </div>
      </Layout>
    );
  }

  // Build actions for owner
  const headerActions = isOwner
    ? [
        {
          key: "edit",
          label: <Trans>Edit</Trans>,
          icon: <Pencil className="w-4 h-4" />,
          onPress: () => setShowEditModal(true),
          variant: "secondary" as const,
        },
        {
          key: "delete",
          label: <Trans>Delete</Trans>,
          icon: <Trash2 className="w-4 h-4" />,
          onPress: () => setShowDeleteDialog(true),
          variant: "danger" as const,
        },
      ]
    : [];

  // Build subtitle with member count and visibility
  const subtitle = (
    <span className="flex items-center gap-3 text-sm text-(--text-muted)">
      <span className="flex items-center gap-1">
        <Users className="w-4 h-4" />
        {list.memberCount} {list.memberCount === 1 ? <Trans>member</Trans> : <Trans>members</Trans>}
      </span>
      <span className="flex items-center gap-1">
        {list.isPublic ? (
          <>
            <Globe className="w-4 h-4" />
            <Trans>Public</Trans>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            <Trans>Private</Trans>
          </>
        )}
      </span>
    </span>
  );

  const pageHeader = (
    <PageHeader
      title={list.name}
      subtitle={subtitle}
      icon={<ListIcon className="w-6 h-6" />}
      backHref="/lists"
      actions={headerActions}
    />
  );

  return (
    <Layout header={pageHeader}>
      <div className="max-w-2xl mx-auto">
        {/* List Timeline */}
        <ListTimeline listId={listId} />
      </div>

      {/* Edit Modal */}
      {isOwner && (
        <ListEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          list={list}
          onUpdated={handleListUpdated}
        />
      )}

      {/* Delete Confirm Dialog */}
      {isOwner && (
        <ListDeleteConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          list={list}
          onDeleted={handleListDeleted}
        />
      )}
    </Layout>
  );
}
