"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import { toastsAtom, removeToastAtom, type Toast as ToastType } from "../../lib/atoms/toast";

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

  const bgColor = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  }[toast.type];

  const icon = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  }[toast.type];

  return (
    <div
      className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md`}
      style={{ animation: "slide-in 0.3s ease-out" }}
      role="alert"
    >
      <span className="text-xl font-bold">{icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-white hover:text-gray-200 font-bold text-xl leading-none"
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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
