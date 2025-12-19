"use client";

/**
 * List Delete Confirm Dialog Component
 *
 * Confirmation dialog before deleting a list.
 * Built with React Aria Components for accessibility.
 *
 * @module components/list/ListDeleteConfirmDialog
 */

import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, Modal, ModalOverlay, Heading } from "react-aria-components";
import { Button } from "../ui/Button";
import { listsApi, type List } from "../../lib/api/lists";
import { useAtom } from "jotai";
import { addToastAtom } from "../../lib/atoms/toast";

/**
 * Props for ListDeleteConfirmDialog component
 */
export interface ListDeleteConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog should close */
  onClose: () => void;
  /** List to delete */
  list: List;
  /** Callback when list is successfully deleted */
  onDeleted?: () => void;
}

/**
 * Confirmation dialog for deleting a list
 *
 * Features:
 * - Warning message with list name
 * - Explains that deletion is permanent
 * - Delete/Cancel buttons (danger variant)
 * - Loading state during deletion
 *
 * @example
 * ```tsx
 * <ListDeleteConfirmDialog
 *   isOpen={showDelete}
 *   onClose={() => setShowDelete(false)}
 *   list={selectedList}
 *   onDeleted={() => navigateToLists()}
 * />
 * ```
 */
export function ListDeleteConfirmDialog({
  isOpen,
  onClose,
  list,
  onDeleted,
}: ListDeleteConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [, addToast] = useAtom(addToastAtom);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await listsApi.delete(list.id);
      addToast({
        type: "success",
        message: "List deleted successfully",
      });
      onDeleted?.();
      onClose();
    } catch (error) {
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete list",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      isDismissable={!isLoading}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    >
      <Modal className="w-full max-w-sm bg-(--card-bg) rounded-xl shadow-xl overflow-hidden outline-none">
        <Dialog className="outline-none">
          {({ close }) => (
            <div className="p-6">
              {/* Warning icon */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>

              {/* Title */}
              <Heading
                slot="title"
                className="text-lg font-semibold text-(--text-primary) text-center mb-2"
              >
                <Trans>Delete this list?</Trans>
              </Heading>

              {/* Description */}
              <p className="text-sm text-(--text-muted) text-center mb-2">
                <span className="font-medium text-(--text-secondary)">"{list.name}"</span>
              </p>
              <p className="text-sm text-(--text-muted) text-center mb-6">
                <Trans>This action cannot be undone. All members will be removed from the list.</Trans>
              </p>

              {/* Actions */}
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  onPress={() => close()}
                  isDisabled={isLoading}
                  className="min-w-25"
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="danger"
                  onPress={handleDelete}
                  isDisabled={isLoading}
                  className="min-w-25"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <Trans>Deleting...</Trans>
                    </div>
                  ) : (
                    <Trans>Delete</Trans>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
