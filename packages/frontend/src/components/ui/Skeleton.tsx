"use client";

/**
 * Skeleton loading component for content placeholders
 * Provides animated loading state while content is being fetched
 */

interface SkeletonProps {
  /** Width of the skeleton (CSS value) */
  width?: string;
  /** Height of the skeleton (CSS value) */
  height?: string;
  /** Border radius (default: 'md') */
  rounded?: "sm" | "md" | "lg" | "full" | "none";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Base skeleton component with pulse animation
 */
export function Skeleton({ width, height, rounded = "md", className = "" }: SkeletonProps) {
  const roundedClass = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
    none: "",
  }[rounded];

  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 animate-pulse ${roundedClass} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton for a note card in the timeline
 */
export function NoteCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      {/* User info skeleton */}
      <div className="flex items-center gap-3 mb-3">
        <Skeleton width="40px" height="40px" rounded="full" />
        <div className="flex-1">
          <Skeleton width="120px" height="16px" className="mb-2" />
          <Skeleton width="80px" height="12px" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mb-3">
        <Skeleton width="100%" height="12px" className="mb-2" />
        <Skeleton width="90%" height="12px" className="mb-2" />
        <Skeleton width="70%" height="12px" />
      </div>

      {/* Action buttons skeleton */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <Skeleton width="60px" height="32px" rounded="lg" />
        <Skeleton width="60px" height="32px" rounded="lg" />
        <Skeleton width="60px" height="32px" rounded="lg" />
      </div>
    </div>
  );
}

/**
 * Timeline skeleton showing multiple note cards
 */
export function TimelineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <NoteCardSkeleton key={i} />
      ))}
    </div>
  );
}
