import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Button variant styles using Class Variance Authority
 * Defines visual variants (primary, secondary, danger, ghost) and sizes (sm, md, lg)
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary-500 text-white hover:bg-primary-600",
        secondary:
          "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600",
        danger: "bg-red-600 text-white hover:bg-red-700",
        ghost: "hover:bg-gray-100 dark:hover:bg-gray-700",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4 py-2",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

/**
 * Props for the Button component
 * Extends React Aria ButtonProps with custom variant and size options
 */
export interface ButtonProps
  extends Omit<AriaButtonProps, "className">, VariantProps<typeof buttonVariants> {
  /** Additional CSS class names */
  className?: string;
}

/**
 * Accessible button component built on React Aria Components
 * Provides WAI-ARIA compliant button with customizable variants and sizes
 *
 * @param variant - Visual variant: 'primary' | 'secondary' | 'danger' | 'ghost' (default: 'primary')
 * @param size - Size variant: 'sm' | 'md' | 'lg' (default: 'md')
 * @param className - Additional CSS classes to apply
 * @param props - All other React Aria ButtonProps
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md" onPress={() => console.log('clicked')}>
 *   Click me
 * </Button>
 * ```
 */
export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <AriaButton className={buttonVariants({ variant, size, className })} {...props} />;
}
