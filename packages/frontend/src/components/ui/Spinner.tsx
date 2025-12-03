"use client";

/**
 * Loading spinner component for buttons and content areas
 */

interface SpinnerProps {
  /** Size of the spinner */
  size?: "xs" | "sm" | "md" | "lg";
  /** Color variant */
  variant?: "primary" | "white" | "gray";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Circular loading spinner with animation
 */
export function Spinner({ size = "md", variant = "primary", className = "" }: SpinnerProps) {
  const sizeClass = {
    xs: "w-3 h-3 border",
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-3",
  }[size];

  const colorClass = {
    primary: "border-primary-500 border-t-transparent",
    white: "border-white border-t-transparent",
    gray: "border-gray-500 border-t-transparent",
  }[variant];

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Loading spinner with text label
 */
export function SpinnerWithLabel({
  label,
  size = "md",
  variant = "primary",
}: {
  label: string;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "primary" | "white" | "gray";
}) {
  return (
    <div className="flex items-center gap-2">
      <Spinner size={size} variant={variant} />
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  );
}
