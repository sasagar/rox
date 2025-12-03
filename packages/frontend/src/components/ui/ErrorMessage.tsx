"use client";

import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";

/**
 * Error message component with optional retry functionality
 */

export interface ErrorMessageProps {
  /** Error title/message */
  title: ReactNode;
  /** Optional detailed error message */
  message?: ReactNode;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Show retry button loading state */
  isRetrying?: boolean;
  /** Error type for styling */
  variant?: "error" | "warning" | "info";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Enhanced error message component with details and retry functionality
 */
export function ErrorMessage({
  title,
  message,
  onRetry,
  isRetrying = false,
  variant = "error",
  className = "",
}: ErrorMessageProps) {
  const bgColor = {
    error: "bg-red-50 border-red-200",
    warning: "bg-orange-50 border-orange-200",
    info: "bg-blue-50 border-blue-200",
  }[variant];

  const textColor = {
    error: "text-red-800",
    warning: "text-orange-800",
    info: "text-blue-800",
  }[variant];

  const iconColor = {
    error: "text-red-600",
    warning: "text-orange-600",
    info: "text-blue-600",
  }[variant];

  const icon = {
    error: "⚠️",
    warning: "⚠️",
    info: "ℹ️",
  }[variant];

  return (
    <div className={`rounded-lg border ${bgColor} p-4 ${className}`} role="alert">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className={`text-2xl ${iconColor}`}>{icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={`font-semibold ${textColor} mb-1`}>{title}</h3>

          {/* Detailed message */}
          {message && (
            <p className={`text-sm ${textColor} opacity-90 wrap-break-word`}>{message}</p>
          )}

          {/* Retry button */}
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className={`mt-3 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                variant === "error"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : variant === "warning"
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRetrying ? <Trans>Retrying...</Trans> : <Trans>Retry</Trans>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline error message for forms
 */
export function InlineError({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm text-red-600 ${className}`}>
      <span className="text-red-600">⚠️</span>
      <span>{message}</span>
    </div>
  );
}
