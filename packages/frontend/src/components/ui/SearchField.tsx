import {
  SearchField as AriaSearchField,
  Label,
  Input,
  Button,
  type SearchFieldProps as AriaSearchFieldProps,
} from "react-aria-components";
import { Search, X } from "lucide-react";
import { t, Trans } from "@lingui/macro";

/**
 * Props for the SearchField component
 * Extends React Aria SearchFieldProps with custom styling options
 */
export interface SearchFieldProps extends Omit<AriaSearchFieldProps, "children"> {
  /** Label text displayed above the input (visually hidden by default) */
  label?: string;
  /** Whether to show the label visually (default: false, uses sr-only) */
  showLabel?: boolean;
  /** Placeholder text shown when input is empty */
  placeholder?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * Accessible search input component built on React Aria Components
 *
 * Features:
 * - Built-in search icon
 * - Clear button (appears when input has value)
 * - Keyboard navigation (Escape to clear)
 * - Screen reader support with aria-label
 * - Accessible label (visually hidden by default)
 *
 * @param label - Label text (default: "Search", used for accessibility)
 * @param showLabel - Whether to show label visually (default: false)
 * @param placeholder - Placeholder text
 * @param size - Size variant: 'sm' | 'md' | 'lg' (default: 'md')
 * @param className - Additional CSS classes
 * @param props - All other React Aria SearchFieldProps
 *
 * @example
 * ```tsx
 * // Basic search field
 * <SearchField
 *   placeholder="Search users..."
 *   value={query}
 *   onChange={setQuery}
 * />
 *
 * // With visible label
 * <SearchField
 *   label="Search posts"
 *   showLabel
 *   placeholder="Enter keywords..."
 * />
 *
 * // Small size
 * <SearchField
 *   size="sm"
 *   placeholder="Quick search..."
 * />
 * ```
 */
export function SearchField({
  label,
  showLabel = false,
  placeholder,
  size = "md",
  className,
  ...props
}: SearchFieldProps) {
  const resolvedLabel = label ?? t`Search`;
  const sizeClasses = {
    sm: "h-8 text-sm",
    md: "h-10 text-base",
    lg: "h-12 text-lg",
  };

  const iconSizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const paddingClasses = {
    sm: "pl-8 pr-8",
    md: "pl-9 pr-9",
    lg: "pl-11 pr-11",
  };

  const iconLeftClasses = {
    sm: "left-2.5",
    md: "left-3",
    lg: "left-3.5",
  };

  const iconRightClasses = {
    sm: "right-2",
    md: "right-2.5",
    lg: "right-3",
  };

  return (
    <AriaSearchField {...props} className={`flex flex-col gap-1 ${className || ""}`}>
      <Label className={showLabel ? "text-sm font-medium text-gray-700 dark:text-gray-300" : "sr-only"}>
        {resolvedLabel}
      </Label>
      <div className="relative">
        {/* Search icon */}
        <Search
          className={`absolute ${iconLeftClasses[size]} top-1/2 -translate-y-1/2 ${iconSizeClasses[size]} text-gray-400 dark:text-gray-500 pointer-events-none`}
        />
        <Input
          placeholder={placeholder}
          className={`w-full ${paddingClasses[size]} ${sizeClasses[size]} rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
        />
        {/* Clear button - only shown when there's a value */}
        <Button
          className={`absolute ${iconRightClasses[size]} top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 data-empty:hidden`}
        >
          <X className={iconSizeClasses[size]} />
          <span className="sr-only">
            <Trans>Clear search</Trans>
          </span>
        </Button>
      </div>
    </AriaSearchField>
  );
}
