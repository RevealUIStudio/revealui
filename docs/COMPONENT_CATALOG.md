---
visibility: public
status: verified
title: "RevealUI Component Catalog"
description: "Complete reference for @revealui/presentation UI components"
category: reference
audience: developer
---

**Last Updated:** 2026-07-11
**Packages:** `@revealui/presentation`, `@revealui/core`
**Total Components:** **61 native components in `@revealui/presentation`** (this catalog also documents admin and rich-text UI in `@revealui/core`, listed separately below).

> Counting rule (enforced in CI by `pnpm validate:claims`; canonical source `scripts/validate/claim-drift.ts` `countUIComponents()`, canonical value in `apps/marketing/app/content/site.ts` `METRICS`): the 61 figure counts `.tsx` files directly in `packages/presentation/src/components/`, excluding `_`-prefixed internal helpers. The package's `packages/presentation/src/primitives/` subpath (Box, Flex, Grid, Text, Heading, Slot; 6 files, listed under Primitives below) ships from the same package but is a separate directory the validator does not scan, so it is not part of the 61. `@revealui/core` admin/rich-text counts below are catalog-maintained, not CI-gated.

---

## Table of Contents

### Presentation Components (@revealui/presentation)
1. [Primitives](#primitives) (6 components, `primitives/` subpath)
2. [Form Controls](#form-controls) (17 components)
3. [Data Display](#data-display) (14 components)
4. [Navigation](#navigation) (7 components)
5. [Feedback](#feedback) (8 components)
6. [Layout](#layout) (5 components)
7. [Headless Components](#headless-components) (5 components)
8. [Utility & Brand](#utility--brand) (5 components)

### Core Components (@revealui/core)
9. [Admin Dashboard Components](#admin-dashboard-components) (4 components)
10. [Admin UI Components](#admin-ui-components) (8 components)
11. [admin Hooks](#admin-hooks) (3 hooks)
12. [Rich Text Editor](#rich-text-editor) (10 components)

---

## Primitives

Low-level layout components for building UIs.

### Box

Basic container component with polymorphic rendering.

**Props:**
```typescript
interface BoxProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'span' | 'section' | 'article' | 'header' | 'footer' | 'main' | 'aside' | 'nav'
}
```

**Usage:**
```tsx
import { Box } from '@revealui/presentation/primitives'

<Box as="section" className="p-4">
  Content here
</Box>
```

---

### Flex

Flexbox container with utility props.

**Props:**
```typescript
interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  wrap?: boolean | 'wrap' | 'nowrap' | 'wrap-reverse'
  gap?: number | string
}
```

**Usage:**
```tsx
import { Flex } from '@revealui/presentation/primitives'

<Flex direction="column" align="center" gap={16}>
  <div>Item 1</div>
  <div>Item 2</div>
</Flex>
```

---

### Grid

CSS Grid container with utility props.

**Props:**
```typescript
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number | string
  rows?: number | string
  gap?: number | string
}
```

**Usage:**
```tsx
import { Grid } from '@revealui/presentation/primitives'

<Grid columns={3} gap={16}>
  <div>Cell 1</div>
  <div>Cell 2</div>
  <div>Cell 3</div>
</Grid>
```

---

### Text

Styled text component.

**Props:**
```typescript
extends React.HTMLAttributes<HTMLElement>
```

**Usage:**
```tsx
import { Text } from '@revealui/presentation'

<Text className="text-muted-foreground">
  Description text
</Text>
```

---

### Heading

Semantic heading component.

**Props:**
```typescript
interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6
}
```

**Usage:**
```tsx
import { Heading } from '@revealui/presentation'

<Heading level={2}>Section Title</Heading>
```

---

### Slot

Merges props and renders children directly (composition utility).

**Usage:**
```tsx
import { Slot } from '@revealui/presentation/primitives'

// Used internally for `asChild` pattern
<Button asChild>
  <a href="/link">Link Button</a>
</Button>
```

---

## Form Controls

Interactive form input components.

### Button (exported as `ButtonCVA`)

Brand-token-driven button with `variant`/`size` props; re-themes automatically with the active brand token (`--rvui-brand`). This is the canonical button used across the marketing, admin, and docs apps. Source: `Button.tsx`.

> Naming note (verified against `packages/presentation/src/components/index.ts`): this component is exported as **`ButtonCVA`**, not bare `Button`. The bare `Button` export resolves to a different, Catalyst-style `color`-prop button from `button-headless.tsx`. See [button-headless](#button-headless) below. This is an intentional package-wide `*CVA` naming convention, not a typo; importing `Button` when you want variant/size props is the most common integration mistake this catalog can prevent.

**Props:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'ghost' | 'link' | 'outline' | 'primary' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'clear'
  asChild?: boolean
  isLoading?: boolean
  glow?: boolean   // brand-glow halo for emphasis CTAs
  shine?: boolean  // hover light-sweep; ignored when asChild is set
}
```

**Variants:**
- `default` - Primary token-driven button
- `destructive` - Destructive-token button for dangerous actions
- `ghost` - Transparent button
- `link` - Text link style
- `outline` - Outlined button
- `primary` - Primary accent (alias of `default`)
- `secondary` - Secondary accent

**Sizes:**
- `default` - h-11 px-4 py-2.5
- `sm` - h-10 px-3
- `lg` - h-12 px-8 py-3
- `icon` - size-11 (square)
- `clear` - No size styling

**Usage:**
```tsx
import { Button as ButtonCVA } from '@revealui/presentation'

<ButtonCVA variant="primary" size="lg">
  Click Me
</ButtonCVA>

<ButtonCVA variant="destructive" size="sm">
  Delete
</ButtonCVA>

<ButtonCVA variant="ghost" size="icon">
  <IconSearch />
</ButtonCVA>

// Render as child element
<ButtonCVA asChild>
  <a href="/link">Link Button</a>
</ButtonCVA>
```

---

### LinkButton

Button-styled element that renders as an anchor by default. Pairs with `LinkBehaviorProvider` to route through any framework `Link` component (e.g. `@revealui/router`, Next.js `next/link`, react-router `Link`) without coupling `@revealui/presentation` to a specific routing library. Available from `0.5.0`.

**Props:**
```typescript
interface LinkButtonOwnProps {
  /** URL the button navigates to. Required for normal usage. */
  href?: string
  /** External link — adds `target="_blank" rel="noopener noreferrer"` and renders a native <a> regardless of provider. */
  external?: boolean
  variant?: 'default' | 'destructive' | 'ghost' | 'link' | 'outline' | 'primary' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'clear'
  /** Show a loading spinner and disable interaction. Sets aria-busy="true". */
  isLoading?: boolean
  /** Brand-glow halo for emphasis CTAs, driven by the `--rvui-shadow-glow` token. */
  glow?: boolean
  /** Subtle light sweep across the button on hover. */
  shine?: boolean
  /** Visually disabled + ARIA-disabled. Anchor href preserved; click prevented; tabIndex=-1. */
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

// Polymorphic — render as a different component for this single instance
type LinkButtonProps<T extends React.ElementType = 'a'> = LinkButtonOwnProps & { as?: T } & ...
```

**Usage:**
```tsx
import { LinkButton, LinkBehaviorProvider } from '@revealui/presentation/client'
import { Link } from '@revealui/router'

// 1. App-level wiring (recommended): one Provider at root, every LinkButton routes through MyLink
<LinkBehaviorProvider component={Link} hrefProp="to">
  <App />
</LinkBehaviorProvider>

// 2. Default usage — renders <a href="/contact"> via the provider Link
<LinkButton href="/contact">Book a call</LinkButton>

// 3. External link — opts out of provider, always native <a target="_blank">
<LinkButton href="https://docs.revealui.com" external variant="outline">
  Read the docs ↗
</LinkButton>

// 4. Per-instance polymorphic override (escape hatch)
<LinkButton as="a" href="#anchor" variant="ghost">Jump to section</LinkButton>
```

**Behavior matrix:**

| Author writes | Without provider | With `<LinkBehaviorProvider component={MyLink} hrefProp="to">` |
|---|---|---|
| `<LinkButton href="/x">…</LinkButton>` | `<a href="/x">…</a>` | `<MyLink to="/x">…</MyLink>` |
| `<LinkButton href="/x" external>…</LinkButton>` | `<a href="/x" target="_blank" rel="noopener noreferrer">…</a>` | same — `external` always opts out of provider |
| `<LinkButton as={X} href="/x">…</LinkButton>` | `<X href="/x">…</X>` (per-instance override drops provider) | `<X href="/x">…</X>` |

**Why use it instead of `<ButtonCVA asChild><Link/></ButtonCVA>`:** the asChild pattern is fragile (forgetting `asChild` produces `<button><a>` interactive-nesting violations), and per-instance Link wiring is repetitive across a CTA-heavy marketing surface. `LinkButton` collapses the two-component composition into a single primitive and lets one `LinkBehaviorProvider` at the app root wire every CTA in the tree.

**Accessibility:**
- Disabled anchors get `aria-disabled="true"` + `tabIndex={-1}` + `pointer-events: none` (anchor `href` preserved — semantics unchanged).
- External links auto-add `rel="noopener noreferrer"` for tab-nap protection.
- Loading state sets `aria-busy="true"`.
- Children wrapped in `TouchTarget` for ≥44×44 mobile tap area, matching `Button`.

---

### Input

Text input field.

**Props:**
```typescript
type InputProps = React.InputHTMLAttributes<HTMLInputElement>
```

**Usage:**
```tsx
import { Input } from '@revealui/presentation'

<Input
  type="text"
  placeholder="Enter your name"
  defaultValue="John Doe"
/>

<Input
  type="email"
  placeholder="email@example.com"
/>
```

---

### Textarea

Multi-line text input.

**Props:**
```typescript
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>
```

**Usage:**
```tsx
import { Textarea } from '@revealui/presentation'

<Textarea
  placeholder="Enter your message"
  rows={4}
/>
```

---

### Select

Native `<select>` wrapper (headless-styled). Renders a real `<select>` element, so native props (`defaultValue`, `<option>` children, etc.) work as expected.

> Naming note (verified against `packages/presentation/src/components/index.ts`): the bare `Select` export resolves to `select-headless.tsx` (this entry). A separate Radix-style compound select (`Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, `SelectLabel`, `SelectSeparator`) lives in `Select.tsx` and is exported as **`SelectCVA`**, following the same bare-name-vs-`*CVA` convention as `Button`/`ButtonCVA`.

**Props:**
```typescript
type SelectProps = {
  className?: string
  multiple?: boolean
  disabled?: boolean
  invalid?: boolean
} & Omit<React.ComponentPropsWithoutRef<'select'>, 'className'>
```

**Usage:**
```tsx
import { Select } from '@revealui/presentation'

<Select defaultValue="option1">
  <option value="option1">Option 1</option>
  <option value="option2">Option 2</option>
  <option value="option3">Option 3</option>
</Select>
```

---

### Checkbox

Checkbox input with label support. Controlled via `checked`/`onCheckedChange`, not the native `checked`/`onChange` pair. Those are omitted from the base `InputHTMLAttributes` extension and replaced.

**Props:**
```typescript
interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'checked' | 'defaultChecked' | 'type' | 'onChange'> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?(checked: boolean | 'indeterminate'): void
}
```

**Usage:**
```tsx
import { Checkbox } from '@revealui/presentation'

<Checkbox id="terms" defaultChecked />
<label htmlFor="terms">Accept terms</label>

// Controlled
<Checkbox checked={accepted} onCheckedChange={(checked) => setAccepted(checked === true)} />
```

---

### Radio

Radio button input.

**Props:**
```typescript
extends React.InputHTMLAttributes<HTMLInputElement>
```

**Usage:**
```tsx
import { Radio, RadioField, RadioGroup } from '@revealui/presentation'

<RadioGroup>
  <RadioField>
    <Radio name="choice" value="option1" />
    <Label>Option 1</Label>
  </RadioField>
  <RadioField>
    <Radio name="choice" value="option2" />
    <Label>Option 2</Label>
  </RadioField>
</RadioGroup>
```

---

### Switch

Toggle switch component.

**Props:**
```typescript
// Native RevealUI implementation - check component file for specific props
```

**Usage:**
```tsx
import { Switch } from '@revealui/presentation'

<Switch checked={enabled} onChange={setEnabled} />
```

---

### Label

Form label component.

**Props:**
```typescript
extends React.LabelHTMLAttributes<HTMLLabelElement>
```

**Usage:**
```tsx
import { Label } from '@revealui/presentation'

<Label htmlFor="email">Email Address</Label>
<Input id="email" type="email" />
```

---

### FormLabel

Enhanced form label with additional styling.

**Props:**
```typescript
extends React.LabelHTMLAttributes<HTMLLabelElement>
```

**Usage:**
```tsx
import { FormLabel } from '@revealui/presentation'

<FormLabel htmlFor="password">Password</FormLabel>
<Input id="password" type="password" />
```

---

### Fieldset

Fieldset container for grouping form controls.

**Usage:**
```tsx
import { Fieldset, Legend } from '@revealui/presentation'

<Fieldset>
  <Legend>Account Information</Legend>
  <Label>Name</Label>
  <Input />
</Fieldset>
```

---

### Combobox

Autocomplete combo box with native accessibility.

**Usage:**
```tsx
import { Combobox, ComboboxLabel, ComboboxOption } from '@revealui/presentation'

// See component file for detailed API
<Combobox>
  {/* Options */}
</Combobox>
```

---

### Listbox

Listbox select component with native accessibility.

**Usage:**
```tsx
import { Listbox, ListboxLabel, ListboxOption } from '@revealui/presentation'

// See component file for detailed API
<Listbox>
  {/* Options */}
</Listbox>
```

---

### Dropdown

Dropdown menu component with native accessibility.

**Usage:**
```tsx
import { Dropdown, DropdownMenu, DropdownItem } from '@revealui/presentation'

// See component file for detailed API
<Dropdown>
  {/* Menu items */}
</Dropdown>
```

---

### Additional Form Controls

Present in `packages/presentation/src/components/` but not yet given a full props/usage writeup here. Verify props against source before use.

| Component | Source | Purpose |
|-----------|--------|---------|
| `FormField` | `form-field.tsx` | Wraps a label, an input/select/textarea, an error message, and helper text; links label to input via a shared `id`. |
| `Rating` | `rating.tsx` | Star-style rating input/display. |
| `Slider` | `slider.tsx` | Range input control. |
| `SelectCVA` | `Select.tsx` | Radix-style compound select (`SelectCVA`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, `SelectLabel`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`). See the naming note under [Select](#select) above. |

---

## Headless Components

Unstyled, accessible components for custom styling.

### button-headless

Catalyst-style button with its own `color` / `outline` / `plain` palette system (20 fixed color palettes). Used internally to compose `Dropdown`. **This is what the bare `Button` export resolves to.** See the naming note under [Button (exported as `ButtonCVA`)](#button) above.

**Props:**
```typescript
type ButtonProps =
  | { color?: <one of 20 fixed palette keys>; outline?: never; plain?: never }
  | { color?: never; outline: true; plain?: never }
  | { color?: never; outline?: never; plain: true }
```
`color`, `outline`, and `plain` are mutually exclusive (enforced at the type level).

**Usage:**
```tsx
import { Button } from '@revealui/presentation'

<Button color="dark/zinc">Save</Button>
<Button outline>Cancel</Button>
<Button plain>Dismiss</Button>
```

**Location:** `@revealui/presentation/components/button-headless`

---

### input-headless

Headless input primitive.

**Location:** `@revealui/presentation/components/input-headless`

---

### textarea-headless

Headless textarea primitive.

**Location:** `@revealui/presentation/components/textarea-headless`

---

### select-headless

Headless select primitive.

**Location:** `@revealui/presentation/components/select-headless`

---

### checkbox-headless

Headless checkbox primitive.

**Location:** `@revealui/presentation/components/checkbox-headless`

---

## Data Display

Components for displaying data and content.

### Card

Card container with compound components.

**Compound Components:**
- `Card` - Main container
- `CardHeader` - Header section
- `CardTitle` - Title heading
- `CardDescription` - Description text
- `CardContent` - Main content area
- `CardFooter` - Footer section

**Usage:**
```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@revealui/presentation'

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

---

### Table

Table component for tabular data.

**Usage:**
```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@revealui/presentation'

<Table>
  <TableHead>
    <TableRow>
      <TableHeader>Header 1</TableHeader>
      <TableHeader>Header 2</TableHeader>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow>
      <TableCell>Cell 1</TableCell>
      <TableCell>Cell 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

### Description List

Description list component for key-value pairs.

**Usage:**
```tsx
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@revealui/presentation'

// See component file for detailed API
```

---

### Avatar

User avatar component. Falls back to `initials` when `src` is omitted or fails to load. Also exports `AvatarButton` (same props, renders as a clickable button/link).

**Props:**
```typescript
type AvatarProps = {
  src?: string | null
  square?: boolean
  initials?: string
  alt?: string
  className?: string
}
```

**Usage:**
```tsx
import { Avatar, AvatarButton } from '@revealui/presentation'

<Avatar src="/avatar.jpg" alt="User Name" />
<Avatar initials="JV" square alt="Joshua Vaughn" />
<AvatarButton src="/avatar.jpg" alt="User Name" onClick={openMenu} />
```

---

### Badge

Badge component for status indicators. Also exports `BadgeButton` (same color palette, renders as a clickable button or, with `href`, an anchor).

**Props:**
```typescript
type BadgeProps = {
  color?: 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan'
    | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose' | 'zinc'
    | 'brand' | 'success' | 'warning' | 'danger' | 'muted'  // default 'zinc'
} & React.ComponentPropsWithoutRef<'span'>
```

**Usage:**
```tsx
import { Badge, BadgeButton } from '@revealui/presentation'

<Badge>New</Badge>
<Badge color="lime">Active</Badge>
<Badge color="danger">Failed</Badge>
<BadgeButton color="brand" href="/billing">Upgrade</BadgeButton>
```

---

### Divider

Visual divider/separator.

**Usage:**
```tsx
import { Divider } from '@revealui/presentation'

<Divider />

<div>Section 1</div>
<Divider />
<div>Section 2</div>
```

---

### Heading (Component)

Styled heading component.

**Usage:**
```tsx
import { Heading, Subheading } from '@revealui/presentation'

<Heading>Page Title</Heading>
<Subheading>Section Title</Subheading>
```

---

### Text (Component)

Styled text component.

**Usage:**
```tsx
import { Code, Strong, Text, TextLink } from '@revealui/presentation'

<Text>Body text content</Text>
<Text>
  Rendered as <Strong>bold</Strong>, <Code>inline code</Code>,
  or <TextLink href="/docs">inline link</TextLink>.
</Text>
```

---

### Additional Data Display Components

Present in `packages/presentation/src/components/` but not yet given a full props/usage writeup here. Verify props against source before use.

| Component | Source | Purpose |
|-----------|--------|---------|
| `Accordion` / `AccordionItem` | `accordion.tsx` | Collapsible disclosure panels for showing/hiding grouped content. |
| `AvatarGroup` | `avatar-group.tsx` | Stacks multiple `Avatar` components with overlap and an optional "+N" overflow indicator. |
| `CodeBlock` | `code-block.tsx` | Syntax-highlighted code display with copy-to-clipboard. |
| `PricingTable` | `pricing-table.tsx` | Plan/tier comparison table; highlights the active tier and reports tier selection via a callback. |
| `Stat` | `stat.tsx` | Labeled numeric/metric display (KPI tile). |
| `Timeline` / `TimelineItem` | `timeline.tsx` | Vertical timeline of dated events. |

---

## Navigation

Navigation components.

### Link

Navigation link component.

**Usage:**
```tsx
import { Link } from '@revealui/presentation'

<Link href="/about">About</Link>
```

---

### Navbar

Navigation bar component.

**Usage:**
```tsx
import { Navbar, NavbarItem, NavbarSection } from '@revealui/presentation'

<Navbar>
  {/* Navigation items */}
</Navbar>
```

---

### Sidebar

Sidebar navigation component.

**Usage:**
```tsx
import { Sidebar, SidebarBody, SidebarItem, SidebarSection } from '@revealui/presentation'

<Sidebar>
  {/* Sidebar content */}
</Sidebar>
```

---

### Pagination

Pagination controls.

**Props:**
```typescript
// Check component file for specific props
```

**Usage:**
```tsx
import { Pagination } from '@revealui/presentation'

<Pagination
  currentPage={1}
  totalPages={10}
  onPageChange={(page) => console.log(page)}
/>
```

---

### Additional Navigation Components

Present in `packages/presentation/src/components/` but not yet given a full props/usage writeup here. Verify props against source before use.

| Component | Source | Purpose |
|-----------|--------|---------|
| `Breadcrumb` | `breadcrumb.tsx` | Hierarchical page-path navigation trail. |
| `Stepper` | `stepper.tsx` | Multi-step progress indicator for wizards and flows. |
| `Tabs` | `tabs.tsx` | Tabbed panel navigation. |

---

## Feedback

User feedback components.

### Alert

Alert/notification component.

**Usage:**
```tsx
import { Alert, AlertBody, AlertDescription, AlertTitle } from '@revealui/presentation'

<Alert>
  <AlertTitle>Heads up</AlertTitle>
  <AlertDescription>Information message</AlertDescription>
</Alert>

<Alert>
  <AlertTitle>Something went wrong</AlertTitle>
  <AlertDescription>Error message</AlertDescription>
</Alert>
```

---

### Dialog

Modal dialog component with native accessibility.

**Compound Components:**
- `Dialog` - Main dialog wrapper
- `DialogTitle` - Dialog title
- `DialogDescription` - Dialog description
- `DialogBody` - Dialog content
- `DialogActions` - Dialog action buttons

**Props:**
```typescript
interface DialogProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
  // + native Dialog props (open, onClose, etc.)
}
```

**Usage:**
```tsx
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions
} from '@revealui/presentation'

<Dialog open={isOpen} onClose={() => setIsOpen(false)} size="lg">
  <DialogTitle>Delete Account</DialogTitle>
  <DialogDescription>
    Are you sure you want to delete your account? This action cannot be undone.
  </DialogDescription>
  <DialogBody>
    <p>Additional information or form fields</p>
  </DialogBody>
  <DialogActions>
    <Button variant="outline" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="destructive" onClick={handleDelete}>
      Delete
    </Button>
  </DialogActions>
</Dialog>
```

**Sizes:**
- `xs` - sm:max-w-xs
- `sm` - sm:max-w-sm
- `md` - sm:max-w-md
- `lg` - sm:max-w-lg (default)
- `xl` - sm:max-w-xl
- `2xl` - sm:max-w-2xl
- `3xl` - sm:max-w-3xl
- `4xl` - sm:max-w-4xl
- `5xl` - sm:max-w-5xl

---

### Toast

Global toast notification queue, mounted via a portal to `document.body`.

**Package:** `@revealui/presentation`

**API:**
```typescript
function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement

function useToast(): {
  addToast: (toast: { title: string; description?: string; variant?: 'default' | 'success' | 'error' | 'warning' | 'info'; duration?: number }) => string
  removeToast: (id: string) => void
}
```

**Usage:**
```tsx
import { ToastProvider, useToast } from '@revealui/presentation'

// Once, near the app root:
<ToastProvider>
  <App />
</ToastProvider>

// From any descendant:
const { addToast } = useToast();
addToast({ title: 'Saved', description: 'Your changes were saved.', variant: 'success' });
```

`useToast` throws if called outside a `ToastProvider`. Toasts auto-dismiss after `duration` ms (default 5000; pass `0` to persist until dismissed).

---

### Additional Feedback Components

Present in `packages/presentation/src/components/` but not yet given a full props/usage writeup here. Verify props against source before use.

| Component | Source | Purpose |
|-----------|--------|---------|
| `Callout` | `callout.tsx` | Inline highlighted message box (`info` / `warning` / `error` / `success` / `tip` variants). |
| `Tooltip` | `tooltip.tsx` | Hover/focus-triggered contextual label. |
| `Drawer` / `DrawerHeader` / `DrawerBody` / `DrawerFooter` | `drawer.tsx` | Slide-in side-panel overlay. |
| `Skeleton` / `SkeletonText` / `SkeletonCard` | `skeleton.tsx` | Loading-state placeholder blocks. |
| `Progress` | `progress.tsx` | Determinate/indeterminate progress bar. |

---

## Layout

Page layout components.

### auth-layout

Authentication page layout.

**Usage:**
```tsx
import { AuthLayout } from '@revealui/presentation'

<AuthLayout>
  {/* Auth forms */}
</AuthLayout>
```

---

### sidebar-layout

Layout with sidebar navigation.

**Usage:**
```tsx
import { SidebarLayout } from '@revealui/presentation'

<SidebarLayout>
  {/* Page content with sidebar */}
</SidebarLayout>
```

---

### stacked-layout

Stacked page layout.

**Usage:**
```tsx
import { StackedLayout } from '@revealui/presentation'

<StackedLayout>
  {/* Stacked content sections */}
</StackedLayout>
```

---

### Additional Layout Components

Present in `packages/presentation/src/components/` but not yet given a full props/usage writeup here. Verify props against source before use.

| Component | Source | Purpose |
|-----------|--------|---------|
| `EmptyState` | `empty-state.tsx` | Placeholder for empty lists/collections with an optional icon and action. |
| `SplitAuthLayout` | `split-auth-layout.tsx` | Two-panel auth screen layout (brand panel + form panel) with responsive stacking. |

---

## Utility & Brand

Low-level display helpers and brand assets that ship from `packages/presentation/src/components/` but don't fit the categories above. Verify props against source before use.

| Component | Source | Purpose |
|-----------|--------|---------|
| `IconChevronDown`, `IconCheck`, `IconAlertCircle`, etc. | `icon.tsx` | Icon set of 40+ stroke icons sharing a common 24x24 base wrapper. |
| `Kbd` / `KbdShortcut` | `kbd.tsx` | Styled keyboard-key label for documenting shortcuts. |
| `RevealUIMark` | `brand-mark.tsx` | The RevealUI logomark (faceted "R"); inherits `currentColor`. |
| `RevealUIWordmark` | `wordmark.tsx` | Logomark plus "RevealUI" wordmark lockup; the text is real HTML, not SVG, so it inherits page fonts. |
| `BuiltWithRevealUI` | `BuiltWithRevealUI.tsx` | "Built with RevealUI" attribution badge; positionable inline or fixed to a corner, with a light/dark color scheme. |

---

## Admin Dashboard Components

Components for the RevealUI admin interface (packages/core/src/client/admin/components/).

### AdminDashboard

Main admin dashboard component.

**Package:** `@revealui/core/client/admin`

**Props:**
```typescript
interface AdminDashboardProps {
  config: RevealConfig
}
```

**Usage:**
```tsx
import { AdminDashboard } from '@revealui/core/client/admin'

<AdminDashboard config={revealConfig} />
```

**Features:**
- Dashboard view with collection list
- Collection browse/edit views
- Document creation and editing
- Pagination and search

---

### CollectionList

Displays a list of documents in a collection.

**Package:** `@revealui/core/client/admin`

**Props:**
```typescript
interface CollectionListProps {
  collection: RevealCollectionConfig
  documents: RevealDocument[]
  totalDocs: number
  page: number
  totalPages: number
  onEdit: (document: RevealDocument) => void
  onDelete: (id: string) => void
  onPageChange: (page: number) => void
  loading?: boolean
  deleting?: string | null
}
```

**Usage:**
```tsx
import { CollectionList } from '@revealui/core/client/admin'

<CollectionList
  collection={collection}
  documents={documents}
  totalDocs={100}
  page={1}
  totalPages={10}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onPageChange={handlePageChange}
/>
```

---

### DocumentForm

Form for creating/editing admin documents.

**Package:** `@revealui/core/client/admin`

**Props:**
```typescript
interface DocumentFormProps {
  collection: RevealCollectionConfig
  document?: RevealDocument
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  saving?: boolean
}
```

**Usage:**
```tsx
import { DocumentForm } from '@revealui/core/client/admin'

<DocumentForm
  collection={collection}
  document={existingDoc}
  onSave={handleSave}
  onCancel={handleCancel}
  saving={isSaving}
/>
```

---

### GlobalForm

Form for creating/editing RevealUI global (singleton) documents.

**Package:** `@revealui/core/client/admin`

**Props:**
```typescript
interface GlobalFormProps {
  global: RevealGlobalConfig
  document?: RevealDocument
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  isLoading?: boolean
}
```

**Usage:**
```tsx
import { GlobalForm } from '@revealui/core/client/admin'

<GlobalForm
  global={globalConfig}
  document={existingDoc}
  onSave={handleSave}
  onCancel={handleCancel}
  isLoading={isSaving}
/>
```

---

## Admin UI Components

Form components for the admin interface (packages/core/src/client/ui/).

**Package:** `@revealui/core/client/ui`

### TextInput (admin)

admin text input field with form integration.

**Props:**
```typescript
interface TextInputProps {
  path: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  disabled?: boolean
}
```

**Usage:**
```tsx
import { TextInput } from '@revealui/core/client/ui'

<TextInput
  path="title"
  value={title}
  onChange={setTitle}
  placeholder="Enter title"
/>
```

---

### FieldLabel

Label component for form fields.

**Props:**
```typescript
interface FieldLabelProps {
  htmlFor?: string
  label: string
  required?: boolean
  className?: string
}
```

**Usage:**
```tsx
import { FieldLabel } from '@revealui/core/client/ui'

<FieldLabel htmlFor="title" label="Title" required />
```

---

### Button (admin)

admin button component.

**Props:**
```typescript
interface ButtonProps {
  children: React.ReactNode
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
}
```

**Usage:**
```tsx
import { Button } from '@revealui/core/client/ui'

<Button variant="primary" size="lg" onClick={handleClick}>
  Save Document
</Button>
```

---

### SelectInput

admin select dropdown input.

**Props:**
```typescript
interface SelectInputProps {
  path: string
  value?: string
  options: Array<{ label: string; value: string }>
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}
```

**Usage:**
```tsx
import { SelectInput } from '@revealui/core/client/ui'

<SelectInput
  path="status"
  value={status}
  options={[
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' }
  ]}
  onChange={setStatus}
/>
```

---

### Textarea (admin)

admin textarea component.

**Props:**
```typescript
interface TextareaProps {
  path: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  rows?: number
  disabled?: boolean
}
```

**Usage:**
```tsx
import { Textarea } from '@revealui/core/client/ui'

<Textarea
  path="description"
  value={description}
  onChange={setDescription}
  rows={4}
/>
```

---

### Checkbox (admin)

admin checkbox component.

**Props:**
```typescript
interface CheckboxProps {
  path: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  className?: string
  disabled?: boolean
}
```

**Usage:**
```tsx
import { Checkbox } from '@revealui/core/client/ui'

<Checkbox
  path="featured"
  checked={isFeatured}
  onChange={setIsFeatured}
  label="Featured Post"
/>
```

---

### ModalProvider

Context provider for modal state management.

**Props:**
```typescript
interface ModalProviderProps {
  children: React.ReactNode
}
```

**Usage:**
```tsx
import { ModalProvider } from '@revealui/core/client/ui'

<ModalProvider>
  <App />
</ModalProvider>
```

**Hook:**
```tsx
import { useModal } from '@revealui/core/client/ui'

const { toggleModal, closeModal, isModalOpen } = useModal()
```

---

### FieldsDrawer

Drawer component for form fields in rich text editor.

**Props:**
```typescript
interface FieldsDrawerProps {
  data: Record<string, unknown>
  drawerSlug: string
  drawerTitle: string
  featureKey: string
  schemaPath: string
  schemaPathSuffix?: string
  handleDrawerSubmit: (fields: unknown, data: Record<string, unknown>) => void
}
```

**Usage:**
```tsx
import { FieldsDrawer } from '@revealui/core/client/ui'

<FieldsDrawer
  data={formData}
  drawerSlug="image-upload"
  drawerTitle="Upload Image"
  featureKey="upload"
  schemaPath="image"
  handleDrawerSubmit={handleSubmit}
/>
```

---

## admin Hooks

Form state management hooks from `@revealui/core/client/ui`.

### useFormFields

Hook for accessing multiple form fields.

**Usage:**
```typescript
import { useFormFields } from '@revealui/core/client/ui'

// Selector function approach
const [fields] = useFormFields((fields) => fields)

// Options approach
const fields = useFormFields({ fields: ['title', 'description'] })
```

---

### useField

Hook for accessing a single field.

**Usage:**
```typescript
import { useField } from '@revealui/core/client/ui'

const { value, setValue, path } = useField({ path: 'title' })
```

---

## Rich Text Editor

Lexical-based rich text editor components (packages/core/src/client/richtext/).

**Package:** `@revealui/core/client/richtext`

### RichTextEditor

Main rich text editor component powered by Lexical.

**Props:**
```typescript
interface RichTextEditorProps {
  editorConfig?: RichTextEditorConfig
  initialValue?: SerializedEditorState | string | null
  onChange?: (state: EditorState, editor: LexicalEditor) => void
  onSerializedChange?: (json: SerializedEditorState) => void
  className?: string
  placeholder?: string
}
```

**Usage:**
```tsx
import { RichTextEditor } from '@revealui/core/client/richtext'

<RichTextEditor
  initialValue={content}
  onChange={handleChange}
  placeholder="Start typing..."
/>
```

**Features:**
- Rich text formatting (bold, italic, underline)
- Headings, lists, quotes
- Links and images
- Code blocks
- Tables
- Toolbar and floating toolbar
- Extensible plugin system

---

### ImageNodeComponent

Component for rendering image nodes in the rich text editor.

**Package:** `@revealui/core/client/richtext/components`

**Usage:** Used internally by ImageNode in the Lexical editor.

---

### ImageUploadButton

Button component for uploading images to the rich text editor.

**Package:** `@revealui/core/client/richtext/components`

**Usage:** Used internally by the image upload feature.

---

### ImageNode

Lexical custom node for images.

**Package:** `@revealui/core/client/richtext/nodes`

**Usage:** Registered automatically in RichTextEditor when image feature is enabled.

---

### ToolbarPlugin

Rich text editor toolbar plugin.

**Package:** `@revealui/core/client/richtext/plugins`

**Features:**
- Text formatting buttons (bold, italic, underline)
- Heading levels (H1-H6)
- Lists (ordered, unordered, checklist)
- Alignment controls
- Link insertion
- Code blocks

**Usage:** Automatically included in RichTextEditor.

---

### FloatingToolbarPlugin

Floating toolbar that appears on text selection.

**Package:** `@revealui/core/client/richtext/plugins`

**Features:**
- Appears on text selection
- Quick access to formatting options
- Link editing

**Usage:** Automatically included in RichTextEditor.

---

### ImagePlugin

Plugin for image upload and management.

**Package:** `@revealui/core/client/richtext/plugins`

**Features:**
- Image upload
- Image resizing
- Image alignment
- Alt text editing

**Usage:** Automatically included when image feature is enabled.

---

### Additional Rich Text Editor Plugins

Present in `packages/core/src/client/richtext/plugins/` but not yet given a full features/usage writeup here. Verify against source before use.

| Plugin | Purpose |
|--------|---------|
| `CollaborationPlugin` | Wires Lexical to a Yjs CRDT provider for real-time collaborative editing, including agent/human cursor presence. |
| `CursorsOverlayPlugin` | Renders and fades remote collaborator cursor overlays; times out inactive cursors. |
| `PastePlugin` | Sanitizes and converts pasted HTML clipboard content into Lexical nodes; blocks `javascript:`/`vbscript:`/`data:` URLs. |

---

## Component Patterns

### Composition with `asChild`

Many components support the `asChild` prop for composition:

```tsx
// Button as a link
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>

// Button as Next.js Link
<Button asChild>
  <Link href="/profile">View Profile</Link>
</Button>
```

### Polymorphic Components

Primitives support polymorphic rendering via the `as` prop:

```tsx
<Box as="section">Section content</Box>
<Box as="article">Article content</Box>
<Box as="nav">Navigation</Box>
```

### Compound Components

Some components provide compound components for composition:

```tsx
// Card
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>

// Dialog
<Dialog>
  <DialogTitle>Title</DialogTitle>
  <DialogDescription>Description</DialogDescription>
  <DialogBody>Body</DialogBody>
  <DialogActions>Actions</DialogActions>
</Dialog>
```

---

## Styling

All components use:
- **Tailwind CSS** for styling
- **class-variance-authority** for variant management (where applicable)
- **cn utility** for className merging
- **Native hooks** for accessible, unstyled primitives (focus trap, roving tabindex, transitions)

### Custom Styling

All components accept a `className` prop for custom styling:

```tsx
<Button className="w-full mt-4">
  Full Width Button
</Button>

<Card className="shadow-xl border-2">
  Custom styled card
</Card>
```

---

## Accessibility

Components follow accessibility best practices:

- ✅ Semantic HTML elements
- ✅ ARIA attributes where needed
- ✅ Keyboard navigation support
- ✅ Focus management
- ✅ Screen reader support

Components like Dialog, Combobox, and Listbox use native RevealUI hooks for built-in accessibility features.

---

## Component Summary by Package

### @revealui/presentation (61 components in `components/`, per the validated count; plus 6 in the separate `primitives/` subpath)
- 6 Primitives (Box, Flex, Grid, Text, Heading, Slot), `primitives/` subpath, not counted in the 61
- 17 Form Controls (Button, LinkButton, Input, Textarea, Select, Checkbox, Radio, Switch, Label, FormLabel, Fieldset, Combobox, Listbox, Dropdown, FormField, Rating, Slider)
- 14 Data Display (Card, Table, Description List, Avatar, Badge, Divider, Heading, Text, Accordion, AvatarGroup, CodeBlock, PricingTable, Stat, Timeline)
- 7 Navigation (Link, Navbar, Sidebar, Pagination, Breadcrumb, Stepper, Tabs)
- 8 Feedback (Alert, Dialog, Toast, Callout, Tooltip, Drawer, Skeleton, Progress)
- 5 Layout (auth-layout, sidebar-layout, stacked-layout, EmptyState, SplitAuthLayout)
- 5 Headless variants (button, input, textarea, select, checkbox)
- 5 Utility & Brand (Icon set, Kbd, RevealUIMark, RevealUIWordmark, BuiltWithRevealUI)

### @revealui/core (25 components, catalog-maintained, not CI-gated)
- 4 Admin Dashboard Components (AdminDashboard, CollectionList, DocumentForm, GlobalForm)
- 8 Admin UI Components (TextInput, Button, SelectInput, Textarea, Checkbox, FieldLabel, ModalProvider, FieldsDrawer)
- 10 Rich Text Editor (RichTextEditor, ImageNode, ImageNodeComponent, ImageUploadButton, ToolbarPlugin, FloatingToolbarPlugin, ImagePlugin, CollaborationPlugin, CursorsOverlayPlugin, PastePlugin)
- 3 Form Hooks (useFormFields, useField, useModal)

---

## Prop-Table Verification Scope

This pass (2026-07-11) verified every per-component entry in `packages/presentation/src/components/` against real source files (61 files) and added rows for the 25 that had no catalog entry. Full prop tables were spot-verified against TypeScript source for the 10 most-used components (by import frequency across `apps/`): `Label`, `Input`, `Button` (`ButtonCVA`), `Badge`, `Card`, `Select`, `Textarea`, `LinkButton`, `Checkbox`, `Avatar`. Four of those ten had real drift, now fixed: `Button`/`Select` were documented under the wrong export name (see the naming notes on each entry), and `LinkButton`/`Checkbox`/`Avatar`/`Badge` prop tables were missing real props (`glow`, `shine`, `onCheckedChange`, `square`, `initials`, the full color union, `AvatarButton`, `BadgeButton`).

The remaining detailed entries (`Box`, `Flex`, `Grid`, `Text`, `Heading`, `Slot`, `Input`, `Textarea`, `Radio`, `Switch`, `Label`, `FormLabel`, `Fieldset`, `Combobox`, `Listbox`, `Dropdown`, headless variants, `Table`, `Description List`, `Divider`, `Heading`/`Text` (Component), `Link`, `Navbar`, `Sidebar`, `Pagination`, `Alert`, `Dialog`, `Toast`, layout components, and the `@revealui/core` admin/rich-text entries) are carried forward from the prior pass, not re-verified line-by-line in this sweep. The 25 newly added rows (in the "Additional \<Category\> Components" tables) intentionally carry name + one-line purpose only, no prop tables, so they don't imply a verification depth this pass didn't do.

Prop tables regenerate against source, not against this document. When in doubt, read the linked `.tsx` file. It is always the source of truth (see the repo's code-over-docs convention).

---

## Related Documentation

- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Styling reference
- [class-variance-authority](https://cva.style/docs) - Variant management
- [Lexical Documentation](https://lexical.dev) - Rich text editor framework
- [Package Reference](./REFERENCE.md) - Framework package reference
- [Admin Guide](./ADMIN_GUIDE.md) - Admin dashboard and content guide

---

**Last Updated:** 2026-07-11
**Packages:** `@revealui/presentation` (61 components, per the validated count; see the counting-rule note at the top of this document), `@revealui/core` (25 components, catalog-maintained)
