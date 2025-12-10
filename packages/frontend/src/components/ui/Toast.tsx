"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import { toastsAtom, removeToastAtom, type Toast as ToastType } from "../../lib/atoms/toast";

/**
 * Get toast styles based on type
 */
function getToastStyles(type: ToastType["type"]) {
  switch (type) {
    case "success":
      // Light, subtle success style
      return {
        container: "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200",
        icon: "text-green-600 dark:text-green-400",
        closeButton: "text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200",
      };
    case "error":
      // More prominent error style
      return {
        container: "bg-red-500 text-white",
        icon: "text-white",
        closeButton: "text-white hover:text-gray-200",
      };
    case "info":
      // Moderate info style
      return {
        container: "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
        icon: "text-blue-600 dark:text-blue-400",
        closeButton: "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200",
      };
    default:
      return {
        container: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
        icon: "text-gray-600 dark:text-gray-400",
        closeButton: "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
      };
  }
}

/**
 * Individual toast notification component
 */
function ToastItem({ toast }: { toast: ToastType }) {
  const [, removeToast] = useAtom(removeToastAtom);

  // Auto-dismiss toast after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  const styles = getToastStyles(toast.type);

  const icon = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  }[toast.type];

  return (
    <div
      className={`${styles.container} px-4 py-3 rounded-lg shadow-md flex items-center gap-3 min-w-[280px] max-w-md`}
      style={{ animation: "slide-in 0.3s ease-out" }}
      role="alert"
    >
      <span className={`text-lg font-semibold ${styles.icon}`}>{icon}</span>
      <span className="flex-1 text-sm">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className={`${styles.closeButton} font-bold text-lg leading-none cursor-pointer`}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Toast container component
 * Renders all active toast notifications in a fixed position
 */
export function ToastContainer() {
  const [toasts] = useAtom(toastsAtom);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
