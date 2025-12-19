"use client";

/**
 * List Card Component
 *
 * Displays a single list item with name, member count, and visibility indicator.
 * Used in the lists page and list selection modals.
 *
 * @module components/list/ListCard
 */

import { Trans } from "@lingui/react/macro";
import { Lock, Globe, Users, MoreHorizontal, Pencil, Trash2, Bell, BellRing } from "lucide-react";
import { Card } from "../ui/Card";
import { SpaLink } from "../ui/SpaLink";
import { Button } from "../ui/Button";
import { Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import type { ListWithMemberCount } from "../../lib/api/lists";

/**
 * Props for ListCard component
 */
export interface ListCardProps {
  /** List data */
  list: ListWithMemberCount;
  /** Whether the current user is the owner */
  isOwner?: boolean;
  /** Edit button click handler */
  onEdit?: () => void;
  /** Delete button click handler */
  onDelete?: () => void;
  /** Whether to show action menu (edit/delete) */
  showActions?: boolean;
}

/**
 * List Card Component
 *
 * Displays a list with:
 * - List name (clickable to navigate to list timeline)
 * - Member count
 * - Public/private visibility indicator
 * - Optional action menu (edit/delete) for owners
 *
 * @example
 * ```tsx
 * <ListCard
 *   list={myList}
 *   isOwner={true}
 *   onEdit={() => openEditModal(myList)}
 *   onDelete={() => openDeleteDialog(myList)}
 *   showActions
 * />
 * ```
 */
export function ListCard({ list, isOwner, onEdit, onDelete, showActions }: ListCardProps) {
  return (
    <Card hover padding="none" className="relative group">
      <SpaLink
        to={`/lists/${list.id}`}
        className="flex items-center justify-between p-4 w-full"
        aria-label={list.name}
      >
        <div className="flex-1 min-w-0">
          {/* List name */}
          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{list.name}</h3>

          {/* Member count */}
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <Users className="w-4 h-4" />
            <span>
              {list.memberCount}{" "}
              {list.memberCount === 1 ? <Trans>member</Trans> : <Trans>members</Trans>}
            </span>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2 ml-4">
          {/* Notification indicator */}
          {list.notifyLevel !== "none" && (
            <span
              className="text-primary-500"
              title={list.notifyLevel === "all" ? "Notifications: All posts" : "Notifications: Original posts only"}
              aria-label={list.notifyLevel === "all" ? "Notifications enabled for all posts" : "Notifications enabled for original posts"}
            >
              {list.notifyLevel === "all" ? (
                <BellRing className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </span>
          )}

          {/* Visibility indicator */}
          {list.isPublic ? (
            <span
              className="text-gray-400 dark:text-gray-500"
              title="Public"
              aria-label="Public list"
            >
              <Globe className="w-5 h-5" />
            </span>
          ) : (
            <span
              className="text-gray-400 dark:text-gray-500"
              title="Private"
              aria-label="Private list"
            >
              <Lock className="w-5 h-5" />
            </span>
          )}
        </div>
      </SpaLink>

      {/* Action menu for owners */}
      {showActions && isOwner && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <MenuTrigger>
            <Button
              variant="ghost"
              size="sm"
              aria-label="List actions"
              className="p-1"
              onPress={(e) => {
                // Prevent navigation when clicking menu
                e.continuePropagation?.();
              }}
            >
              <MoreHorizontal className="w-5 h-5" />
            </Button>
            <Popover placement="bottom end">
              <Menu
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-35"
                onAction={(key) => {
                  if (key === "edit") onEdit?.();
                  if (key === "delete") onDelete?.();
                }}
              >
                <MenuItem
                  id="edit"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer outline-none"
                >
                  <Pencil className="w-4 h-4" />
                  <Trans>Edit</Trans>
                </MenuItem>
                <MenuItem
                  id="delete"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer outline-none"
                >
                  <Trash2 className="w-4 h-4" />
                  <Trans>Delete</Trans>
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      )}
    </Card>
  );
}
