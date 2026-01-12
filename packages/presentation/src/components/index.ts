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
} from './Button'
// Headless UI components
export { Button, TouchTarget } from './button-headless'
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card'
export {
  Checkbox as CheckboxCVA,
  CheckboxIndicator,
  type CheckboxIndicatorProps,
  type CheckboxProps,
} from './Checkbox'
export { Checkbox, CheckboxField, CheckboxGroup } from './checkbox-headless'
export { FormLabel, type FormLabelProps } from './FormLabel'
export { Input as InputCVA, type InputProps } from './Input'
export { Input, InputGroup } from './input-headless'
export { Label, type LabelProps } from './Label'
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
} from './Pagination'
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
} from './Select'
export { Select } from './select-headless'
export { Textarea as TextareaCVA, type TextareaProps } from './Textarea'
export { Textarea } from './textarea-headless'
