'use client';

/**
 * @revealui/presentation/client
 *
 * Client-only components that use React hooks and must be used in Client Components.
 */

// New components (v0.2)
export { Accordion, AccordionItem } from './components/accordion.js';
// Native UI Components - All Client Only
export {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from './components/alert.js';
export { Avatar } from './components/avatar.js';
export { AvatarGroup } from './components/avatar-group.js';
export { Badge } from './components/badge.js';
export { Breadcrumb, type BreadcrumbItem } from './components/breadcrumb.js';
export { Button, TouchTarget } from './components/button-headless.js';
// CVA Components that use hooks
export {
  Checkbox as CheckboxCVA,
  CheckboxIndicator,
  type CheckboxIndicatorProps,
  type CheckboxProps,
} from './components/Checkbox.js';
export { Callout } from './components/callout.js';
export { Checkbox, CheckboxField, CheckboxGroup } from './components/checkbox-headless.js';
export { CodeBlock } from './components/code-block.js';
export {
  Combobox,
  ComboboxDescription,
  ComboboxLabel,
  ComboboxOption,
} from './components/combobox.js';
export {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from './components/description-list.js';
export {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from './components/dialog.js';
export { Divider } from './components/divider.js';
export { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from './components/drawer.js';
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
  DropdownSection,
  DropdownShortcut,
} from './components/dropdown.js';
export { EmptyState } from './components/empty-state.js';
export {
  Description,
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  Label as FieldsetLabel,
  Legend,
} from './components/fieldset.js';
export { Heading, Subheading } from './components/heading.js';
export { Input, InputGroup } from './components/input-headless.js';
export { Kbd, KbdShortcut } from './components/kbd.js';
export { Link } from './components/link.js';
export {
  Listbox,
  ListboxDescription,
  ListboxLabel,
  ListboxOption,
} from './components/listbox.js';
export {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from './components/navbar.js';
// Server-safe components re-exported for client use
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
} from './components/Pagination.js';
export {
  PricingTable,
  type PricingTableProps,
  type PricingTier,
} from './components/pricing-table.js';
export { Progress } from './components/progress.js';
export { Radio, RadioField, RadioGroup } from './components/radio.js';
export { Rating } from './components/rating.js';
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
} from './components/Select.js';
export { Select } from './components/select-headless.js';
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
} from './components/sidebar.js';
export { SidebarLayout } from './components/sidebar-layout.js';
export { Skeleton, SkeletonCard, SkeletonText } from './components/skeleton.js';
export { Slider } from './components/slider.js';
export { StackedLayout } from './components/stacked-layout.js';
export { Stat, StatGroup } from './components/stat.js';
export { Stepper, type StepperStep } from './components/stepper.js';
export { Switch, SwitchField, SwitchGroup } from './components/switch.js';
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/table.js';
export { Tab, TabList, TabPanel, Tabs } from './components/tabs.js';
export { Code, Strong, Text, TextLink } from './components/text.js';
export { Textarea } from './components/textarea-headless.js';
export { Timeline, TimelineItem } from './components/timeline.js';
export { ToastProvider, useToast } from './components/toast.js';
export { Tooltip } from './components/tooltip.js';
export { type ResolvedTheme, type Theme, useTheme } from './hooks/use-theme.js';
