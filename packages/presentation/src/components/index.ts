/**
 * Shared UI Components
 *
 * Reusable components that can be used across RevealUI applications.
 * These components are framework-agnostic and follow design system principles.
 */

// CVA components (PascalCase files with types)
export {
  Button as ButtonCVA,
  type ButtonProps,
  buttonVariants,
} from './Button.js'
// Native UI components
export { Button, TouchTarget } from './button-headless.js'
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card.js'
export {
  Checkbox as CheckboxCVA,
  CheckboxIndicator,
  type CheckboxIndicatorProps,
  type CheckboxProps,
} from './Checkbox.js'
export { Checkbox, CheckboxField, CheckboxGroup } from './checkbox-headless.js'
export { FormLabel, type FormLabelProps } from './FormLabel.js'
export { Input as InputCVA, type InputProps } from './Input.js'
export { Input, InputGroup } from './input-headless.js'
export { Label, type LabelProps } from './Label.js'
export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  type PaginationEllipsisProps,
  PaginationItem,
  PaginationLink,
  type PaginationLinkProps,
  PaginationNext,
  type PaginationNextProps,
  PaginationPrevious,
  type PaginationPreviousProps,
  type PaginationProps,
} from './Pagination.js'
export {
  Select as SelectCVA,
  SelectContent,
  type SelectContentProps,
  SelectGroup,
  SelectItem,
  type SelectItemProps,
  SelectLabel,
  type SelectLabelProps,
  type SelectProps,
  SelectScrollDownButton,
  type SelectScrollDownButtonProps,
  SelectScrollUpButton,
  type SelectScrollUpButtonProps,
  SelectSeparator,
  type SelectSeparatorProps,
  SelectTrigger,
  type SelectTriggerProps,
  SelectValue,
  type SelectValueProps,
} from './Select.js'
export { Select } from './select-headless.js'
export { Textarea as TextareaCVA, type TextareaProps } from './Textarea.js'
export { Textarea } from './textarea-headless.js'
