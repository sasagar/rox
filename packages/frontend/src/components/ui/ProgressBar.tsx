"use client";

/**
 * Progress bar component for showing upload/download progress
 */

interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Show percentage text */
  showPercent?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Color variant */
  variant?: "primary" | "success" | "error" | "info";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Progress bar with smooth animation and percentage display
 */
export function ProgressBar({
  value,
  showPercent = false,
  size = "md",
  variant = "primary",
  className = "",
}: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  const heightClass = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  }[size];

  const colorClass = {
    primary: "bg-primary-500",
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  }[variant];

  return (
    <div className={className}>
      <div
        className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${heightClass}`}
      >
        <div
          className={`${heightClass} ${colorClass} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showPercent && (
        <div className="text-xs text-gray-600 dark:text-gray-400 text-right mt-1">
          {Math.round(clampedValue)}%
        </div>
      )}
    </div>
  );
}

/**
 * Indeterminate progress bar with animated stripes
 */
export function IndeterminateProgress({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden h-2 ${className}`}
    >
      <div
        className="h-2 bg-primary-500 rounded-full animate-indeterminate"
        role="progressbar"
        aria-busy="true"
      />
    </div>
  );
}
