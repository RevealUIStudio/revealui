'use client'

/**
 * @revealui/presentation/client
 *
 * Client-only components that use React hooks and must be used in Client Components.
 */

// Native UI Components - All Client Only
export { Alert, AlertActions, AlertBody, AlertDescription, AlertTitle } from './components/alert.js'
export { Avatar } from './components/avatar.js'
export { Badge } from './components/badge.js'
export { Button, TouchTarget } from './components/button-headless.js'
// CVA Components that use hooks
export {
  Checkbox as CheckboxCVA,
  CheckboxIndicator,
  type CheckboxIndicatorProps,
  type CheckboxProps,
} from './components/Checkbox.js'
export { Checkbox, CheckboxField, CheckboxGroup } from './components/checkbox-headless.js'
export {
  Combobox,
  ComboboxDescription,
  ComboboxLabel,
  ComboboxOption,
} from './components/combobox.js'
export {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from './components/description-list.js'
export {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from './components/dialog.js'
export { Divider } from './components/divider.js'
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
} from './components/dropdown.js'
export {
  Description,
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  Label as FieldsetLabel,
  Legend,
} from './components/fieldset.js'
export { Heading } from './components/heading.js'
export { Input, InputGroup } from './components/input-headless.js'
export { Link } from './components/link.js'
export {
  Listbox,
  ListboxDescription,
  ListboxLabel,
  ListboxOption,
} from './components/listbox.js'
export {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from './components/navbar.js'
export { Radio, RadioField, RadioGroup } from './components/radio.js'
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
} from './components/Select.js'
export { Select } from './components/select-headless.js'
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
} from './components/sidebar.js'
export { SidebarLayout } from './components/sidebar-layout.js'
export { StackedLayout } from './components/stacked-layout.js'
export { Switch, SwitchField, SwitchGroup } from './components/switch.js'
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/table.js'
export { Text } from './components/text.js'
export { Textarea } from './components/textarea-headless.js'
