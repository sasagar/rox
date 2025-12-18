import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ReactNode } from "react";
import {
  Button as AriaButton,
  composeRenderProps,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";

/**
 * Card variant styles using Class Variance Authority
 * Defines visual variants for card appearance
 */
const cardVariants = cva(
  "rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  {
    variants: {
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
      shadow: {
        none: "",
        sm: "shadow-sm",
        md: "shadow",
        lg: "shadow-lg",
      },
      hover: {
        true: "transition-shadow hover:shadow-md",
        false: "",
      },
    },
    defaultVariants: {
      padding: "md",
      shadow: "sm",
      hover: false,
    },
  },
);

/**
 * Props for the static Card component (non-interactive)
 */
export interface CardProps extends VariantProps<typeof cardVariants> {
  /** Card content */
  children: ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** ARIA role attribute */
  role?: string;
  /** ARIA label for accessibility */
  "aria-label"?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
}

/**
 * Props for the interactive Card component (with click handler)
 */
export interface InteractiveCardProps
  extends VariantProps<typeof cardVariants>,
    Omit<AriaButtonProps, "children" | "className" | "style"> {
  /** Card content */
  children: ReactNode;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Card component for containing and organizing content
 * Provides consistent styling with customizable padding, shadow, and hover effects
 *
 * For static content display, this component renders a semantic div element.
 * For interactive cards with click handlers, use InteractiveCard instead.
 *
 * @param children - Content to display inside the card
 * @param padding - Padding size: 'none' | 'sm' | 'md' | 'lg' (default: 'md')
 * @param shadow - Shadow depth: 'none' | 'sm' | 'md' | 'lg' (default: 'sm')
 * @param hover - Enable hover effect (default: false)
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * // Basic card (static content)
 * <Card>
 *   <h2>Title</h2>
 *   <p>Content</p>
 * </Card>
 *
 * // Card with custom padding and shadow
 * <Card padding="lg" shadow="lg">
 *   <p>Large padded card</p>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    children,
    padding,
    shadow,
    hover,
    className,
    role,
    "aria-label": ariaLabel,
    tabIndex,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cardVariants({ padding, shadow, hover, className })}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
    >
      {children}
    </div>
  );
});

/**
 * Interactive Card component using React Aria Button
 * Use this for cards that have click handlers or navigation behavior.
 *
 * This component wraps React Aria's Button to provide:
 * - Proper keyboard navigation (Enter/Space to activate)
 * - Focus management and focus ring styling
 * - Screen reader announcements
 * - Touch and pointer event handling
 *
 * @param children - Content to display inside the card
 * @param padding - Padding size: 'none' | 'sm' | 'md' | 'lg' (default: 'md')
 * @param shadow - Shadow depth: 'none' | 'sm' | 'md' | 'lg' (default: 'sm')
 * @param hover - Enable hover effect (default: true for interactive cards)
 * @param className - Additional CSS classes
 * @param onPress - Handler called when the card is pressed
 *
 * @example
 * ```tsx
 * // Interactive card with press handler
 * <InteractiveCard hover onPress={() => console.log('clicked')}>
 *   <p>Click me!</p>
 * </InteractiveCard>
 *
 * // Disabled interactive card
 * <InteractiveCard isDisabled onPress={() => {}}>
 *   <p>Cannot click</p>
 * </InteractiveCard>
 * ```
 */
export const InteractiveCard = forwardRef<HTMLButtonElement, InteractiveCardProps>(
  function InteractiveCard(
    { children, padding, shadow, hover = true, className, ...ariaProps },
    ref,
  ) {
    return (
      <AriaButton
        ref={ref}
        {...ariaProps}
        className={composeRenderProps(className, (className, renderProps) =>
          cardVariants({
            padding,
            shadow,
            hover,
            className: `${className || ""} ${
              renderProps.isFocusVisible
                ? "outline-none ring-2 ring-primary-500 ring-offset-2"
                : ""
            } ${renderProps.isPressed ? "scale-[0.98]" : ""} ${
              renderProps.isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`.trim(),
          }),
        )}
      >
        {children}
      </AriaButton>
    );
  },
);

/**
 * CardHeader component for card titles and headers
 */
export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mb-4 ${className || ""}`}>{children}</div>;
}

/**
 * CardTitle component for card titles
 */
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${className || ""}`}>
      {children}
    </h3>
  );
}

/**
 * CardDescription component for card descriptions
 */
export function CardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-gray-600 dark:text-gray-400 ${className || ""}`}>{children}</p>
  );
}

/**
 * CardContent component for main card content
 */
export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className || ""}>{children}</div>;
}
