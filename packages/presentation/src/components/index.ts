/**
 * Shared UI Components
 *
 * Reusable components that can be used across RevealUI applications.
 * These components are framework-agnostic and follow design system principles.
 */

// Shared touch hit-area primitive (was previously re-exported via the button).
export { TouchTarget } from './_button-shared.js';
// New components (v0.2)
export { Accordion, AccordionItem } from './accordion.js';
// Components exported below were implemented but previously unexported
export { Alert, AlertActions, AlertBody, AlertDescription, AlertTitle } from './alert.js';
// Product-native quartet (Phase 3 PR-1 — receipt motif)
export { type AuditEvent, AuditLine, type AuditLineProps } from './audit-line.js';
// Layout components
export { AuthLayout, type AuthLayoutProps } from './auth-layout.js';
export { Avatar, AvatarButton } from './avatar.js';
export { AvatarGroup } from './avatar-group.js';
export { BuiltWithRevealUI } from './BuiltWithRevealUI.js';
// The owned action button. `Button` is the sovereign export; `ButtonCVA` is a
// deprecated alias kept for one minor to ease 0.x consumers and stacked
// branches — migrate imports to `Button` (see CHANGELOG).
export {
  Button,
  Button as ButtonCVA,
  type ButtonProps,
  buttonVariants,
} from './Button.js';
export { Badge, BadgeButton } from './badge.js';
export { RevealUIMark, type RevealUIMarkProps } from './brand-mark.js';
export { Breadcrumb, type BreadcrumbItem } from './breadcrumb.js';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card.js';
export {
  Checkbox as CheckboxCVA,
  CheckboxIndicator,
  type CheckboxIndicatorProps,
  type CheckboxProps,
} from './Checkbox.js';
export { Callout } from './callout.js';
export { Checkbox, CheckboxField, CheckboxGroup } from './checkbox-headless.js';
export { CodeBlock } from './code-block.js';
export { Combobox, ComboboxDescription, ComboboxLabel, ComboboxOption } from './combobox.js';
export { DescriptionDetails, DescriptionList, DescriptionTerm } from './description-list.js';
export { Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle } from './dialog.js';
export { Divider } from './divider.js';
export { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from './drawer.js';
export {
  Dropdown,
  DropdownButton,
  DropdownDescription,
  DropdownDivider,
  DropdownHeader,
  DropdownHeading,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownShortcut,
} from './dropdown.js';
export { EmptyState } from './empty-state.js';
export { FormLabel, type FormLabelProps } from './FormLabel.js';
export {
  Description,
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  Label as FieldLabel,
  Legend,
} from './fieldset.js';
export { FormField, type FormFieldProps } from './form-field.js';
export { Heading, Subheading } from './heading.js';
export { Input as InputCVA, type InputProps } from './Input.js';
export { Input, InputGroup } from './input-headless.js';
export { Kbd, KbdShortcut } from './kbd.js';
export { Label, Label as ControlLabel, type LabelProps } from './Label.js';
export {
  type LinkBehavior,
  LinkButton,
  type LinkButtonOwnProps,
  type LinkButtonProps,
} from './LinkButton.js';
export { Link } from './link.js';
export { Listbox, ListboxDescription, ListboxLabel, ListboxOption } from './listbox.js';
export {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from './navbar.js';
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
} from './Pagination.js';
export {
  PricingTable,
  type PricingTableProps,
  type PricingTier,
} from './pricing-table.js';
export { Progress } from './progress.js';
export { Radio, RadioField, RadioGroup } from './radio.js';
export { Rating } from './rating.js';
export {
  ReceiptCard,
  type ReceiptCardProps,
  type ReceiptIntegrity,
} from './receipt-card.js';
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
} from './Select.js';
export { Select } from './select-headless.js';
export {
  Sidebar,
  SidebarBody,
  SidebarDivider,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from './sidebar.js';
export { SidebarLayout } from './sidebar-layout.js';
export { Skeleton, SkeletonCard, SkeletonText } from './skeleton.js';
export { Slider } from './slider.js';
export {
  SplitAuthLayout,
  type SplitAuthLayoutProps,
} from './split-auth-layout.js';
export { StackedLayout } from './stacked-layout.js';
export { Stat, StatGroup } from './stat.js';
export { StatusDot, type StatusDotProps, type StatusDotStatus } from './status-dot.js';
export { Stepper, type StepperStep } from './stepper.js';
export { Switch, SwitchField, SwitchGroup } from './switch.js';
export { Textarea as TextareaCVA, type TextareaProps } from './Textarea.js';
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table.js';
export { Tab, TabList, TabPanel, Tabs } from './tabs.js';
export { Code, Strong, Text, TextLink } from './text.js';
export { Textarea } from './textarea-headless.js';
export { Timeline, TimelineItem } from './timeline.js';
export { ToastProvider, useToast } from './toast.js';
export { Tooltip } from './tooltip.js';
export { type Verdict, VerdictChip, type VerdictChipProps } from './verdict-chip.js';
export { RevealUIWordmark, type RevealUIWordmarkProps } from './wordmark.js';
