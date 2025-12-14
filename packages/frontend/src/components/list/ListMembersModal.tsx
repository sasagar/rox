"use client";

/**
 * List Members Modal Component
 *
 * Modal displaying all members of a list with management options.
 * Built with React Aria Components for accessibility.
 *
 * @module components/list/ListMembersModal
 */

import { useState, useEffect, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import { X, Users, Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  Modal,
  ModalOverlay,
  Heading,
  Button as AriaButton,
} from "react-aria-components";
import { listsApi, type List, type ListMembership } from "../../lib/api/lists";
import { Button } from "../ui/Button";
import { ListMemberCard } from "./ListMemberCard";
import { AddMemberModal } from "./AddMemberModal";

/**
 * Props for ListMembersModal component
 */
export interface ListMembersModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** List to show members for */
  list: List;
  /** Whether the current user is the list owner */
  isOwner?: boolean;
  /** Callback when member count changes */
  onMemberCountChanged?: (delta: number) => void;
}

/**
 * List Members Modal
 *
 * Features:
 * - Displays all members with pagination
 * - For owners: remove members, toggle reply settings
 * - Click on member to navigate to their profile
 * - Load more pagination
 *
 * @example
 * ```tsx
 * <ListMembersModal
 *   isOpen={showMembers}
 *   onClose={() => setShowMembers(false)}
 *   list={selectedList}
 *   isOwner={true}
 *   onMemberCountChanged={(delta) => updateCount(delta)}
 * />
 * ```
 */
export function ListMembersModal({
  isOpen,
  onClose,
  list,
  isOwner,
  onMemberCountChanged,
}: ListMembersModalProps) {
  const [members, setMembers] = useState<ListMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [showAddMember, setShowAddMember] = useState(false);

  const limit = 20;

  // Fetch members
  const fetchMembers = useCallback(
    async (currentOffset = 0) => {
      if (!isOpen) return;

      try {
        if (currentOffset > 0) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const response = await listsApi.getMemberships(list.id, limit, currentOffset);

        if (currentOffset > 0) {
          setMembers((prev) => [...prev, ...response]);
        } else {
          setMembers(response);
        }

        setHasMore(response.length >= limit);
        setOffset(currentOffset + response.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load members");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [isOpen, list.id],
  );

  // Load on open
  useEffect(() => {
    if (isOpen) {
      setMembers([]);
      setHasMore(true);
      setOffset(0);
      fetchMembers(0);
    }
  }, [isOpen, fetchMembers]);

  // Handle member removed
  const handleMemberRemoved = (membershipId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    onMemberCountChanged?.(-1);
  };

  // Handle member updated
  const handleMemberUpdated = (updated: ListMembership) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m)),
    );
  };

  // Handle member added from AddMemberModal
  const handleMemberAdded = (membership: ListMembership) => {
    setMembers((prev) => [membership, ...prev]);
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
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
                  <Users className="w-5 h-5 text-(--text-muted)" />
                  <Heading
                    slot="title"
                    className="text-lg font-semibold text-(--text-primary)"
                  >
                    <Trans>Members of "{list.name}"</Trans>
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
                    <Button
                      variant="secondary"
                      onPress={() => fetchMembers(0)}
                    >
                      <Trans>Try again</Trans>
                    </Button>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-12 text-(--text-muted)">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">
                      <Trans>No members yet</Trans>
                    </p>
                    <p className="text-sm mt-1">
                      <Trans>Add users to this list from their profile</Trans>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {members.map((membership) => (
                      <ListMemberCard
                        key={membership.id}
                        membership={membership}
                        listId={list.id}
                        isOwner={isOwner}
                        onRemoved={() => handleMemberRemoved(membership.id)}
                        onUpdated={handleMemberUpdated}
                        onClose={close}
                      />
                    ))}

                    {/* Load more */}
                    {hasMore && (
                      <div className="flex justify-center py-4">
                        <Button
                          variant="secondary"
                          onPress={() => fetchMembers(offset)}
                          isDisabled={loadingMore}
                        >
                          {loadingMore ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <Trans>Loading...</Trans>
                            </div>
                          ) : (
                            <Trans>Load more</Trans>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer with add member button (owner only) */}
              {isOwner && (
                <div className="p-4 border-t border-(--border-color)">
                  <Button
                    variant="secondary"
                    onPress={() => setShowAddMember(true)}
                    className="w-full"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    <Trans>Add member</Trans>
                  </Button>
                </div>
              )}
            </>
          )}
        </Dialog>
      </Modal>

      {/* Add Member Modal */}
      {isOwner && (
        <AddMemberModal
          isOpen={showAddMember}
          onClose={() => setShowAddMember(false)}
          list={list}
          onMemberAdded={handleMemberAdded}
          onMemberCountChanged={onMemberCountChanged}
        />
      )}
    </ModalOverlay>
  );
}
