import {
  RadioGroup,
  Radio,
  Label,
  type RadioGroupProps,
} from "react-aria-components";
import type { ReactNode } from "react";

/**
 * Filter option definition
 */
export interface FilterOption<T extends string = string> {
  /** Unique value for this option */
  value: T;
  /** Display label */
  label: ReactNode;
  /** Optional count badge */
  count?: number;
}

/**
 * Props for the FilterGroup component
 */
export interface FilterGroupProps<T extends string = string>
  extends Omit<RadioGroupProps, "children" | "value" | "onChange"> {
  /** Filter options to display */
  options: FilterOption<T>[];
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Accessible label for the filter group */
  label: string;
  /** Whether to show the label visually (default: false) */
  showLabel?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Accessible filter group component built on React Aria RadioGroup
 *
 * Features:
 * - Keyboard navigation (arrow keys)
 * - Screen reader support with proper ARIA roles
 * - Visual selection state
 * - Optional count badges
 *
 * @param options - Array of filter options
 * @param value - Currently selected value
 * @param onChange - Callback when selection changes
 * @param label - Accessible label (required for screen readers)
 * @param showLabel - Whether to show label visually (default: false)
 * @param size - Size variant: 'sm' | 'md' (default: 'md')
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * // Basic filter group
 * <FilterGroup
 *   label="Filter by type"
 *   options={[
 *     { value: "all", label: "All" },
 *     { value: "local", label: "Local" },
 *     { value: "remote", label: "Remote" },
 *   ]}
 *   value={filter}
 *   onChange={setFilter}
 * />
 *
 * // With counts
 * <FilterGroup
 *   label="Filter users"
 *   options={[
 *     { value: "all", label: "All", count: 100 },
 *     { value: "active", label: "Active", count: 85 },
 *     { value: "suspended", label: "Suspended", count: 15 },
 *   ]}
 *   value={userFilter}
 *   onChange={setUserFilter}
 * />
 * ```
 */
export function FilterGroup<T extends string = string>({
  options,
  value,
  onChange,
  label,
  showLabel = false,
  size = "md",
  className,
  ...props
}: FilterGroupProps<T>) {
  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-1.5",
  };

  const badgeSizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-xs",
  };

  return (
    <RadioGroup
      {...props}
      value={value}
      onChange={(newValue) => onChange(newValue as T)}
      className={`flex flex-col gap-2 ${className || ""}`}
    >
      <Label
        className={
          showLabel
            ? "text-sm font-medium text-gray-700 dark:text-gray-300"
            : "sr-only"
        }
      >
        {label}
      </Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            className={`group inline-flex items-center ${sizeClasses[size]} rounded-full border cursor-pointer transition-colors focus:outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary-500 data-focus-visible:ring-offset-2 data-selected:bg-primary-600 data-selected:text-white data-selected:border-primary-600 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700`}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`${badgeSizeClasses[size]} rounded-full font-medium group-data-selected:bg-white/20 group-data-selected:text-white bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300`}
              >
                {option.count}
              </span>
            )}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
