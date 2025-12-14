"use client";

/**
 * List Edit Modal Component
 *
 * Modal dialog for editing an existing user list.
 * Built with React Aria Components for accessibility.
 *
 * @module components/list/ListEditModal
 */

import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { X, Loader2, Bell, BellOff, BellRing } from "lucide-react";
import {
  Dialog,
  Modal,
  ModalOverlay,
  Heading,
  Button as AriaButton,
  TextField,
  Label,
  Input,
  Select,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";
import { Switch } from "../ui/Switch";
import { Button } from "../ui/Button";
import { listsApi, type List } from "../../lib/api/lists";
import type { ListNotifyLevel } from "shared";
import { useAtom } from "jotai";
import { addToastAtom } from "../../lib/atoms/toast";

/**
 * Props for ListEditModal component
 */
export interface ListEditModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** List to edit */
  list: List;
  /** Callback when list is successfully updated */
  onUpdated?: (list: List) => void;
}

/**
 * Modal dialog for editing a list
 *
 * Features:
 * - Pre-filled name input
 * - Toggle for public/private visibility
 * - Save/Cancel buttons
 * - Validation (name required)
 * - Toast feedback on success/error
 *
 * @example
 * ```tsx
 * <ListEditModal
 *   isOpen={showEdit}
 *   onClose={() => setShowEdit(false)}
 *   list={selectedList}
 *   onUpdated={(list) => handleListUpdated(list)}
 * />
 * ```
 */
export function ListEditModal({ isOpen, onClose, list, onUpdated }: ListEditModalProps) {
  const [name, setName] = useState(list.name);
  const [isPublic, setIsPublic] = useState(list.isPublic);
  const [notifyLevel, setNotifyLevel] = useState<ListNotifyLevel>(list.notifyLevel);
  const [isLoading, setIsLoading] = useState(false);
  const [, addToast] = useAtom(addToastAtom);

  // Update form when list changes
  useEffect(() => {
    setName(list.name);
    setIsPublic(list.isPublic);
    setNotifyLevel(list.notifyLevel);
  }, [list]);

  const hasChanges = name !== list.name || isPublic !== list.isPublic || notifyLevel !== list.notifyLevel;

  const handleSubmit = async () => {
    if (!name.trim() || !hasChanges) return;

    setIsLoading(true);
    try {
      const updates: { name?: string; isPublic?: boolean; notifyLevel?: ListNotifyLevel } = {};
      if (name !== list.name) updates.name = name.trim();
      if (isPublic !== list.isPublic) updates.isPublic = isPublic;
      if (notifyLevel !== list.notifyLevel) updates.notifyLevel = notifyLevel;

      const updatedList = await listsApi.update(list.id, updates);
      addToast({
        type: "success",
        message: "List updated successfully",
      });
      onUpdated?.(updatedList);
      onClose();
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update list",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset to original values
    setName(list.name);
    setIsPublic(list.isPublic);
    setNotifyLevel(list.notifyLevel);
    onClose();
  };

  const getNotifyLevelIcon = (level: ListNotifyLevel) => {
    switch (level) {
      case "none":
        return <BellOff className="w-4 h-4" />;
      case "all":
        return <BellRing className="w-4 h-4" />;
      case "original":
        return <Bell className="w-4 h-4" />;
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    >
      <Modal className="w-full max-w-md bg-(--card-bg) rounded-xl shadow-xl overflow-hidden flex flex-col outline-none">
        <Dialog className="flex flex-col outline-none">
          {({ close }) => (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-(--border-color)">
                <Heading slot="title" className="text-lg font-semibold text-(--text-primary)">
                  <Trans>Edit List</Trans>
                </Heading>
                <AriaButton
                  onPress={close}
                  className="p-2 hover:bg-(--bg-secondary) rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-(--text-muted)" />
                </AriaButton>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* List name input */}
                <TextField
                  value={name}
                  onChange={setName}
                  maxLength={100}
                  isRequired
                  autoFocus
                  className="flex flex-col gap-1"
                >
                  <Label className="text-sm font-medium text-(--text-secondary)">
                    <Trans>List Name</Trans>
                  </Label>
                  <Input
                    placeholder="My List"
                    className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--input-bg) text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </TextField>

                {/* Public/Private switch */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-(--text-secondary)">
                      <Trans>Public</Trans>
                    </p>
                    <p className="text-xs text-(--text-muted)">
                      <Trans>Anyone can see this list</Trans>
                    </p>
                  </div>
                  <Switch isSelected={isPublic} onChange={setIsPublic} aria-label="Public list" />
                </div>

                {/* Notification level select */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-(--text-secondary)">
                    <Trans>Notifications</Trans>
                  </p>
                  <p className="text-xs text-(--text-muted)">
                    <Trans>Get notified when list members post</Trans>
                  </p>
                  <Select
                    selectedKey={notifyLevel}
                    onSelectionChange={(key) => setNotifyLevel(key as ListNotifyLevel)}
                    className="w-full"
                  >
                    <AriaButton className="flex items-center justify-between w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--input-bg) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <span className="flex items-center gap-2">
                        {getNotifyLevelIcon(notifyLevel)}
                        <SelectValue />
                      </span>
                      <span className="text-(--text-muted)">▼</span>
                    </AriaButton>
                    <Popover className="w-[--trigger-width] bg-(--card-bg) border border-(--border-color) rounded-lg shadow-lg overflow-hidden">
                      <ListBox className="outline-none">
                        <ListBoxItem
                          id="none"
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-(--bg-secondary) focus:bg-(--bg-secondary) outline-none"
                        >
                          <BellOff className="w-4 h-4" />
                          <Trans>Off</Trans>
                        </ListBoxItem>
                        <ListBoxItem
                          id="all"
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-(--bg-secondary) focus:bg-(--bg-secondary) outline-none"
                        >
                          <BellRing className="w-4 h-4" />
                          <Trans>All posts</Trans>
                        </ListBoxItem>
                        <ListBoxItem
                          id="original"
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-(--bg-secondary) focus:bg-(--bg-secondary) outline-none"
                        >
                          <Bell className="w-4 h-4" />
                          <Trans>Original posts only</Trans>
                        </ListBoxItem>
                      </ListBox>
                    </Popover>
                  </Select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-(--border-color)">
                <Button variant="secondary" onPress={handleClose} isDisabled={isLoading}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="primary"
                  onPress={handleSubmit}
                  isDisabled={!name.trim() || !hasChanges || isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <Trans>Saving...</Trans>
                    </div>
                  ) : (
                    <Trans>Save</Trans>
                  )}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
