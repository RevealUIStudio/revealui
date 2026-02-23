/**
 * Shared UI Components
 *
 * Reusable components that can be used across RevealUI applications.
 * These components are framework-agnostic and follow design system principles.
 */

// New components (v0.2)
export { Accordion, AccordionItem } from './accordion.js'
// Layout components
export { AuthLayout } from './auth-layout.js'
export { AvatarGroup } from './avatar-group.js'
// CVA components (PascalCase files with types)
export {
  Button as ButtonCVA,
  type ButtonProps,
  buttonVariants,
} from './Button.js'
export { Breadcrumb, type BreadcrumbItem } from './breadcrumb.js'
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
export { Callout } from './callout.js'
export { Checkbox, CheckboxField, CheckboxGroup } from './checkbox-headless.js'
export { CodeBlock } from './code-block.js'
export { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from './drawer.js'
export { EmptyState } from './empty-state.js'
export { FormLabel, type FormLabelProps } from './FormLabel.js'
export { Input as InputCVA, type InputProps } from './Input.js'
export { Input, InputGroup } from './input-headless.js'
export { Kbd, KbdShortcut } from './kbd.js'
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
export { Progress } from './progress.js'
export { Rating } from './rating.js'
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
export { Skeleton, SkeletonCard, SkeletonText } from './skeleton.js'
export { Slider } from './slider.js'
export { Stat, StatGroup } from './stat.js'
export { Stepper, type StepperStep } from './stepper.js'
export { Textarea as TextareaCVA, type TextareaProps } from './Textarea.js'
export { Tab, TabList, TabPanel, Tabs } from './tabs.js'
export { Textarea } from './textarea-headless.js'
export { Timeline, TimelineItem } from './timeline.js'
export { ToastProvider, useToast } from './toast.js'
export { Tooltip } from './tooltip.js'
