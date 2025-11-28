import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

/**
 * Card variant styles using Class Variance Authority
 * Defines visual variants for card appearance
 */
const cardVariants = cva(
  'rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  {
    variants: {
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
      },
      shadow: {
        none: '',
        sm: 'shadow-sm',
        md: 'shadow',
        lg: 'shadow-lg',
      },
      hover: {
        true: 'transition-shadow hover:shadow-md',
        false: '',
      },
    },
    defaultVariants: {
      padding: 'md',
      shadow: 'sm',
      hover: false,
    },
  }
);

/**
 * Props for the Card component
 */
export interface CardProps extends VariantProps<typeof cardVariants> {
  /** Card content */
  children: ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** ARIA role attribute */
  role?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
}

/**
 * Card component for containing and organizing content
 * Provides consistent styling with customizable padding, shadow, and hover effects
 *
 * @param children - Content to display inside the card
 * @param padding - Padding size: 'none' | 'sm' | 'md' | 'lg' (default: 'md')
 * @param shadow - Shadow depth: 'none' | 'sm' | 'md' | 'lg' (default: 'sm')
 * @param hover - Enable hover effect (default: false)
 * @param className - Additional CSS classes
 * @param onClick - Click handler (makes card interactive)
 *
 * @example
 * ```tsx
 * // Basic card
 * <Card>
 *   <h2>Title</h2>
 *   <p>Content</p>
 * </Card>
 *
 * // Interactive card with hover effect
 * <Card hover onClick={() => console.log('clicked')}>
 *   <p>Click me!</p>
 * </Card>
 *
 * // Card with custom padding and shadow
 * <Card padding="lg" shadow="lg">
 *   <p>Large padded card</p>
 * </Card>
 * ```
 */
export function Card({
  children,
  padding,
  shadow,
  hover,
  className,
  onClick,
  role,
  'aria-label': ariaLabel,
  tabIndex,
}: CardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={cardVariants({ padding, shadow, hover, className })}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
    >
      {children}
    </Component>
  );
}

/**
 * CardHeader component for card titles and headers
 */
export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className || ''}`}>
      {children}
    </div>
  );
}

/**
 * CardTitle component for card titles
 */
export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${className || ''}`}>
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
    <p className={`text-sm text-gray-600 dark:text-gray-400 ${className || ''}`}>
      {children}
    </p>
  );
}

/**
 * CardContent component for main card content
 */
export function CardContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className || ''}>
      {children}
    </div>
  );
}

/**
 * CardFooter component for card actions and footers
 */
export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-4 flex items-center gap-2 ${className || ''}`}>
      {children}
    </div>
  );
}
