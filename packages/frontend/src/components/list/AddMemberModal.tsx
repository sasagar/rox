"use client";

/**
 * Add Member Modal Component
 *
 * Modal for searching and adding users to a list.
 * Features user search with debouncing and displays member status.
 * Built with React Aria Components for accessibility.
 *
 * @module components/list/AddMemberModal
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import { X, Search, Loader2, UserPlus, Check, Users } from "lucide-react";
import {
  Dialog,
  Modal,
  ModalOverlay,
  Heading,
  Button as AriaButton,
  Input,
  Label,
  TextField,
} from "react-aria-components";
import { useAtom } from "jotai";
import { usersApi } from "../../lib/api/users";
import { listsApi, type List, type ListMembership } from "../../lib/api/lists";
import { addToastAtom } from "../../lib/atoms/toast";
import { tokenAtom } from "../../lib/atoms/auth";
import { apiClient } from "../../lib/api/client";
import type { User } from "../../lib/types/user";

/**
 * Props for AddMemberModal component
 */
export interface AddMemberModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** List to add members to */
  list: List;
  /** Callback when a member is added */
  onMemberAdded?: (membership: ListMembership) => void;
  /** Callback when member count changes */
  onMemberCountChanged?: (delta: number) => void;
}

/**
 * User search result item
 */
interface UserResultProps {
  user: User;
  isMember: boolean;
  isLoading: boolean;
  onAdd: () => void;
}

function UserResult({ user, isMember, isLoading, onAdd }: UserResultProps) {
  const displayName = user.displayName || user.username;
  const handle = user.host ? `@${user.username}@${user.host}` : `@${user.username}`;

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={isMember || isLoading}
      className="flex items-center gap-3 p-3 w-full hover:bg-(--bg-secondary) transition-colors rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-(--bg-tertiary) overflow-hidden shrink-0">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-(--text-muted)">
            <Users className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-(--text-primary) truncate">{displayName}</p>
        <p className="text-sm text-(--text-muted) truncate">{handle}</p>
      </div>

      {/* Status/Action */}
      <div className="shrink-0">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-(--text-muted)" />
        ) : isMember ? (
          <div className="flex items-center gap-1 text-green-500">
            <Check className="w-4 h-4" />
            <span className="text-sm">
              <Trans>Added</Trans>
            </span>
          </div>
        ) : (
          <UserPlus className="w-5 h-5 text-primary-500" />
        )}
      </div>
    </button>
  );
}

/**
 * Add Member Modal
 *
 * Features:
 * - Search users by username/display name
 * - Debounced search (150ms)
 * - Shows member status (already added indicator)
 * - Click to add user to list
 *
 * @example
 * ```tsx
 * <AddMemberModal
 *   isOpen={showAddMember}
 *   onClose={() => setShowAddMember(false)}
 *   list={selectedList}
 *   onMemberAdded={(membership) => handleMemberAdded(membership)}
 *   onMemberCountChanged={(delta) => updateCount(delta)}
 * />
 * ```
 */
export function AddMemberModal({
  isOpen,
  onClose,
  list,
  onMemberAdded,
  onMemberCountChanged,
}: AddMemberModalProps) {
  const [, addToast] = useAtom(addToastAtom);
  const [token] = useAtom(tokenAtom);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [memberUserIds, setMemberUserIds] = useState<Set<string>>(new Set());
  const [loadingUserIds, setLoadingUserIds] = useState<Set<string>>(new Set());

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch current members when modal opens
  useEffect(() => {
    const fetchMembers = async () => {
      if (!isOpen || !token) return;

      apiClient.setToken(token);
      try {
        // Fetch all members to know who is already added
        const memberships = await listsApi.getMemberships(list.id, 100, 0);
        setMemberUserIds(new Set(memberships.filter((m) => m.user).map((m) => m.user!.id)));
      } catch (_err) {
        // Ignore errors, just start with empty set
      }
    };

    if (isOpen) {
      fetchMembers();
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, list.id, token]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSearching(false);
      setMemberUserIds(new Set());
      setLoadingUserIds(new Set());
    }
  }, [isOpen]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Search users with debounce
  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);

      // Clear pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (newQuery.trim().length === 0) {
        setResults([]);
        setSearching(false);
        return;
      }

      // Debounce API call
      debounceTimerRef.current = setTimeout(async () => {
        if (!token) return;

        setSearching(true);
        apiClient.setToken(token);

        try {
          const users = await usersApi.search(newQuery.trim(), { limit: 10 });
          setResults(users);
        } catch (err) {
          addToast({
            type: "error",
            message: err instanceof Error ? err.message : "Search failed",
          });
          setResults([]);
        } finally {
          setSearching(false);
        }
      }, 150);
    },
    [token, addToast],
  );

  // Add user to list
  const handleAddUser = async (user: User) => {
    if (!token || memberUserIds.has(user.id)) return;

    setLoadingUserIds((prev) => new Set(prev).add(user.id));
    apiClient.setToken(token);

    try {
      const membership = await listsApi.push(list.id, user.id);
      setMemberUserIds((prev) => new Set(prev).add(user.id));
      onMemberAdded?.(membership);
      onMemberCountChanged?.(1);
      addToast({
        type: "success",
        message: `Added ${user.displayName || user.username} to list`,
      });
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to add member",
      });
    } finally {
      setLoadingUserIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(user.id);
        return newSet;
      });
    }
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
                  <UserPlus className="w-5 h-5 text-(--text-muted)" />
                  <Heading
                    slot="title"
                    className="text-lg font-semibold text-(--text-primary)"
                  >
                    <Trans>Add member to "{list.name}"</Trans>
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

              {/* Search Input */}
              <div className="p-4 border-b border-(--border-color)">
                <TextField className="w-full">
                  <Label className="sr-only">
                    <Trans>Search users</Trans>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
                    <Input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      placeholder="Search users..."
                      className="w-full pl-10 pr-4 py-2 bg-(--bg-secondary) border border-(--border-color) rounded-lg text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-(--text-muted)" />
                    )}
                  </div>
                </TextField>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto p-2">
                {query.trim().length === 0 ? (
                  <div className="text-center py-12 text-(--text-muted)">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">
                      <Trans>Search for users to add to this list</Trans>
                    </p>
                  </div>
                ) : searching ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-(--text-muted)" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-center py-12 text-(--text-muted)">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">
                      <Trans>No users found</Trans>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {results.map((user) => (
                      <UserResult
                        key={user.id}
                        user={user}
                        isMember={memberUserIds.has(user.id)}
                        isLoading={loadingUserIds.has(user.id)}
                        onAdd={() => handleAddUser(user)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
