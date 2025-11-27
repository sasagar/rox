import {
  TextField as AriaTextField,
  Label,
  Input,
  TextArea,
  type TextFieldProps as AriaTextFieldProps,
  type TextAreaProps,
  type InputProps,
} from 'react-aria-components';

/**
 * Props for the TextField component
 * Extends React Aria TextFieldProps with custom label, description, and error handling
 */
export interface TextFieldProps extends AriaTextFieldProps {
  /** Label text displayed above the input */
  label?: string;
  /** Helper text displayed below the input */
  description?: string;
  /** Error message displayed in red below the input */
  errorMessage?: string;
  /** HTML input type (text, password, email, etc.) */
  type?: InputProps['type'];
  /** Whether to render a multiline textarea instead of single-line input */
  multiline?: boolean;
  /** Number of visible text rows for textarea (only applies when multiline=true) */
  rows?: TextAreaProps['rows'];
  /** Placeholder text shown when input is empty */
  placeholder?: string;
}

/**
 * Accessible text input component built on React Aria Components
 * Supports both single-line input and multiline textarea with built-in validation display
 *
 * @param label - Label text to display above the field
 * @param description - Helper text shown below the field (hidden when error is present)
 * @param errorMessage - Error text shown in red below the field
 * @param type - Input type (default: 'text')
 * @param multiline - Render as textarea instead of input (default: false)
 * @param rows - Number of visible textarea rows (default: 4)
 * @param className - Additional CSS classes to apply
 * @param props - All other React Aria TextFieldProps
 *
 * @example
 * ```tsx
 * // Single-line input
 * <TextField
 *   label="Username"
 *   description="Enter your username"
 *   value={username}
 *   onChange={setUsername}
 * />
 *
 * // Password input
 * <TextField
 *   label="Password"
 *   type="password"
 *   errorMessage={error}
 * />
 *
 * // Multiline textarea
 * <TextField
 *   label="Bio"
 *   multiline
 *   rows={5}
 * />
 * ```
 */
export function TextField({
  label,
  description,
  errorMessage,
  type = 'text',
  multiline = false,
  rows = 4,
  placeholder,
  className,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField {...props} className={`flex flex-col gap-1 ${className || ''}`}>
      {label && <Label className="text-sm font-medium text-gray-700">{label}</Label>}
      {multiline ? (
        <TextArea
          rows={rows}
          placeholder={placeholder}
          className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      ) : (
        <Input
          type={type}
          placeholder={placeholder}
          className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      )}
      {description && !errorMessage && (
        <div className="text-sm text-gray-600">{description}</div>
      )}
      {errorMessage && (
        <div className="text-sm text-red-600">{errorMessage}</div>
      )}
    </AriaTextField>
  );
}
