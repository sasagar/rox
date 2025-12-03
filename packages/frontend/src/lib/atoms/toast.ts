import { atom } from "jotai";

/**
 * Toast notification types
 */
export type ToastType = "success" | "error" | "info";

/**
 * Toast notification interface
 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // milliseconds, default 5000
}

/**
 * Toast queue atom
 * Stores all active toast notifications
 */
export const toastsAtom = atom<Toast[]>([]);

/**
 * Helper atom to add a toast notification
 */
export const addToastAtom = atom(null, (get, set, toast: Omit<Toast, "id">) => {
  const newToast: Toast = {
    ...toast,
    id: `toast-${Date.now()}-${Math.random()}`,
    duration: toast.duration ?? 5000,
  };
  set(toastsAtom, [...get(toastsAtom), newToast]);
  return newToast.id;
});

/**
 * Helper atom to remove a toast notification
 */
export const removeToastAtom = atom(null, (get, set, id: string) => {
  set(
    toastsAtom,
    get(toastsAtom).filter((toast) => toast.id !== id),
  );
});
