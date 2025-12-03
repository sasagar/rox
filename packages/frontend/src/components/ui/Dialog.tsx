import {
  Dialog as AriaDialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
  Heading,
} from "react-aria-components";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

/**
 * Props for the Dialog component
 */
export interface DialogProps {
  /** Dialog title */
  title: string;
  /** Dialog content */
  children: ReactNode;
  /** Trigger element (button, link, etc.) */
  trigger: ReactNode;
  /** Optional footer actions (buttons) */
  actions?: ReactNode;
  /** Optional close callback */
  onClose?: () => void;
}

/**
 * Accessible dialog/modal component built on React Aria Components
 * Provides WAI-ARIA compliant modal with keyboard navigation and focus management
 *
 * @param title - Dialog title displayed in the header
 * @param children - Main dialog content
 * @param trigger - Element that opens the dialog when clicked
 * @param actions - Optional footer actions (usually buttons)
 * @param onClose - Callback when dialog is closed
 *
 * @example
 * ```tsx
 * <Dialog
 *   title="Confirm Action"
 *   trigger={<Button>Open Dialog</Button>}
 *   actions={
 *     <>
 *       <Button variant="secondary" onPress={close}>Cancel</Button>
 *       <Button variant="danger" onPress={() => { handleDelete(); close(); }}>
 *         Delete
 *       </Button>
 *     </>
 *   }
 * >
 *   <p>Are you sure you want to delete this item?</p>
 * </Dialog>
 * ```
 */
export function Dialog({ title, children, trigger, actions, onClose }: DialogProps) {
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <Modal className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl">
          <AriaDialog className="p-6 outline-none">
            {({ close }) => (
              <>
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <Heading className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {title}
                  </Heading>
                  <button
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => {
                      close();
                      onClose?.();
                    }}
                    aria-label="Close dialog"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="mb-6 text-gray-700 dark:text-gray-300">{children}</div>

                {/* Footer */}
                {actions && <div className="flex justify-end gap-2">{actions}</div>}
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

/**
 * Props for the ConfirmDialog component
 */
export interface ConfirmDialogProps {
  /** Confirmation message */
  message: string;
  /** Dialog title (default: "Confirm") */
  title?: string;
  /** Confirm button text (default: "Confirm") */
  confirmText?: string;
  /** Cancel button text (default: "Cancel") */
  cancelText?: string;
  /** Trigger element */
  trigger: ReactNode;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Variant for confirm button (default: "danger") */
  confirmVariant?: "primary" | "secondary" | "danger";
}

/**
 * Pre-configured confirmation dialog
 * Useful for delete confirmations and other yes/no actions
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   title="Delete Note"
 *   message="Are you sure you want to delete this note? This action cannot be undone."
 *   confirmText="Delete"
 *   confirmVariant="danger"
 *   trigger={<Button variant="danger">Delete</Button>}
 *   onConfirm={() => deleteNote(noteId)}
 * />
 * ```
 */
export function ConfirmDialog({
  message,
  title = "Confirm",
  confirmText = "Confirm",
  cancelText = "Cancel",
  trigger,
  onConfirm,
  confirmVariant = "danger",
}: ConfirmDialogProps) {
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <Modal className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl">
          <AriaDialog className="p-6 outline-none">
            {({ close }) => (
              <>
                <Heading className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">
                  {title}
                </Heading>
                <p className="mb-6 text-gray-700 dark:text-gray-300">{message}</p>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onPress={close}>
                    {cancelText}
                  </Button>
                  <Button
                    variant={confirmVariant}
                    onPress={() => {
                      onConfirm();
                      close();
                    }}
                  >
                    {confirmText}
                  </Button>
                </div>
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
