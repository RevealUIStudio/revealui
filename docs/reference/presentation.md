# @revealui/presentation

50+ native UI components for building RevealUI apps. Zero external UI dependencies — only `clsx` and `cva`.

```bash
npm install @revealui/presentation
```

## Subpath Exports

| Import path | Environment | Purpose |
|-------------|-------------|---------|
| `@revealui/presentation` | Both | All components, primitives, utilities |
| `@revealui/presentation/server` | Server only | RSC-safe subset (no client hooks) |

---

## Component Reference

### Layout

#### `StackedLayout`
Full-page layout with a fixed navbar and scrollable content area.

```tsx
import { StackedLayout } from '@revealui/presentation'

<StackedLayout navbar={<Navbar />} sidebar={<Sidebar />}>
  {children}
</StackedLayout>
```

#### `SidebarLayout`
Split layout with a collapsible sidebar panel and main content.

```tsx
import { SidebarLayout } from '@revealui/presentation'

<SidebarLayout sidebar={<AppSidebar />}>
  {children}
</SidebarLayout>
```

#### `AuthLayout`
Centered layout for sign-in and sign-up pages.

```tsx
import { AuthLayout } from '@revealui/presentation'

<AuthLayout title="Sign in to your account" logo={<Logo />}>
  <SignInForm />
</AuthLayout>
```

---

### Navigation

#### `Navbar`
Horizontal navigation bar with logo, links, and actions slots.

```tsx
import { Navbar, NavbarSection, NavbarItem, NavbarLabel } from '@revealui/presentation'

<Navbar>
  <NavbarSection>
    <NavbarItem href="/">Home</NavbarItem>
    <NavbarItem href="/docs">Docs</NavbarItem>
  </NavbarSection>
  <NavbarSection className="ml-auto">
    <NavbarItem href="/login">Sign in</NavbarItem>
  </NavbarSection>
</Navbar>
```

#### `Sidebar`
Vertical navigation sidebar with sections and items.

```tsx
import { Sidebar, SidebarSection, SidebarItem, SidebarLabel } from '@revealui/presentation'

<Sidebar>
  <SidebarSection>
    <SidebarLabel>Main</SidebarLabel>
    <SidebarItem href="/dashboard" current>Dashboard</SidebarItem>
    <SidebarItem href="/posts">Posts</SidebarItem>
  </SidebarSection>
</Sidebar>
```

#### `Breadcrumb`
Breadcrumb trail with configurable separators.

```tsx
import { Breadcrumb } from '@revealui/presentation'

<Breadcrumb items={[
  { label: 'Home', href: '/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Getting Started' },
]} />
```

#### `Tabs`
Horizontal tab navigation.

```tsx
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@revealui/presentation'

<Tabs defaultValue="overview">
  <TabList>
    <Tab value="overview">Overview</Tab>
    <Tab value="settings">Settings</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="overview"><Overview /></TabPanel>
    <TabPanel value="settings"><Settings /></TabPanel>
  </TabPanels>
</Tabs>
```

---

### Inputs

#### `Button`
Primary interactive element. Supports variants, sizes, and loading state.

```tsx
import { Button } from '@revealui/presentation'

<Button variant="primary" size="md" disabled={loading}>
  Save changes
</Button>
<Button variant="secondary" href="/docs">View docs</Button>
<Button variant="destructive" onClick={handleDelete}>Delete</Button>
```

**Props:** `variant` (`primary | secondary | outline | ghost | destructive`), `size` (`sm | md | lg`), `href`, `disabled`, `loading`

#### `Input`
Text input with optional label, description, and error state.

```tsx
import { Input } from '@revealui/presentation'

<Input
  label="Email address"
  type="email"
  placeholder="you@example.com"
  description="We'll never share your email."
  error={errors.email}
/>
```

#### `Textarea`
Multi-line text input.

```tsx
import { Textarea } from '@revealui/presentation'

<Textarea label="Message" rows={4} placeholder="Your message..." />
```

#### `Select`
Dropdown select with label and error state.

```tsx
import { Select } from '@revealui/presentation'

<Select label="Role" value={role} onChange={setRole}>
  <option value="admin">Admin</option>
  <option value="editor">Editor</option>
  <option value="viewer">Viewer</option>
</Select>
```

#### `Checkbox`
Single checkbox with label and description.

```tsx
import { Checkbox } from '@revealui/presentation'

<Checkbox label="Subscribe to updates" description="Get notified about new releases." />
```

#### `Fieldset`
Groups related form inputs with a legend.

```tsx
import { Fieldset, Legend, Field, Label } from '@revealui/presentation'

<Fieldset>
  <Legend>Notification preferences</Legend>
  <Field><Label>Email</Label><Input type="email" /></Field>
</Fieldset>
```

#### `FormLabel`
Standalone label with optional required indicator.

```tsx
import { FormLabel } from '@revealui/presentation'

<FormLabel htmlFor="name" required>Full name</FormLabel>
```

#### `Slider`
Range slider input.

```tsx
import { Slider } from '@revealui/presentation'

<Slider min={0} max={100} step={5} value={volume} onChange={setVolume} />
```

#### `Switch`
Toggle switch for boolean settings.

```tsx
import { Switch } from '@revealui/presentation'

<Switch checked={enabled} onChange={setEnabled} label="Enable notifications" />
```

#### `Radio`
Radio button group.

```tsx
import { Radio, RadioGroup, RadioField } from '@revealui/presentation'

<RadioGroup value={plan} onChange={setPlan}>
  <RadioField><Radio value="free" label="Free" /></RadioField>
  <RadioField><Radio value="pro" label="Pro" /></RadioField>
</RadioGroup>
```

#### `Combobox`
Searchable dropdown (autocomplete).

```tsx
import { Combobox } from '@revealui/presentation'

<Combobox
  options={users}
  displayValue={(u) => u.name}
  onChange={setSelectedUser}
  placeholder="Search users..."
/>
```

#### `Listbox`
Accessible multi-option listbox.

---

### Feedback

#### `Alert`
Informational banner. Variants match intent.

```tsx
import { Alert } from '@revealui/presentation'

<Alert variant="info" title="Heads up">Your trial expires in 3 days.</Alert>
<Alert variant="success">Changes saved.</Alert>
<Alert variant="warning" title="Action required">Verify your email.</Alert>
<Alert variant="error">Something went wrong.</Alert>
```

#### `Callout`
Highlighted block for important inline notes.

```tsx
import { Callout } from '@revealui/presentation'

<Callout type="warning">This action cannot be undone.</Callout>
```

#### `Badge`
Inline status chip.

```tsx
import { Badge } from '@revealui/presentation'

<Badge color="green">Active</Badge>
<Badge color="red">Failed</Badge>
<Badge color="yellow">Pending</Badge>
```

#### `Progress`
Linear progress bar.

```tsx
import { Progress } from '@revealui/presentation'

<Progress value={72} max={100} label="Upload progress" />
```

#### `Skeleton`
Loading placeholder.

```tsx
import { Skeleton } from '@revealui/presentation'

<Skeleton className="h-4 w-48" />
<Skeleton className="h-32 w-full rounded-xl" />
```

#### `Toast`
Transient notification. Use with `useToast()`.

```tsx
import { useToast } from '@revealui/presentation'

const { toast } = useToast()
toast.success('Saved!', { description: 'Your changes were saved.' })
toast.error('Failed', { description: 'Please try again.' })
```

#### `Rating`
Star rating display or input.

```tsx
import { Rating } from '@revealui/presentation'

<Rating value={4} max={5} readOnly />
```

---

### Overlays

#### `Dialog`
Modal dialog with backdrop.

```tsx
import { Dialog } from '@revealui/presentation'

<Dialog open={isOpen} onClose={() => setIsOpen(false)} title="Delete post">
  <p>Are you sure? This cannot be undone.</p>
  <div className="mt-4 flex gap-2">
    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
  </div>
</Dialog>
```

#### `Drawer`
Side panel that slides in from the edge.

```tsx
import { Drawer } from '@revealui/presentation'

<Drawer open={isOpen} onClose={() => setIsOpen(false)} title="Settings" side="right">
  <SettingsPanel />
</Drawer>
```

#### `Dropdown`
Context menu / action menu.

```tsx
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem } from '@revealui/presentation'

<Dropdown>
  <DropdownButton>Actions</DropdownButton>
  <DropdownMenu>
    <DropdownItem onClick={handleEdit}>Edit</DropdownItem>
    <DropdownItem onClick={handleDelete} destructive>Delete</DropdownItem>
  </DropdownMenu>
</Dropdown>
```

#### `Tooltip`
Floating label on hover.

```tsx
import { Tooltip } from '@revealui/presentation'

<Tooltip content="Copy to clipboard">
  <Button>Copy</Button>
</Tooltip>
```

---

### Data Display

#### `Card`
Content container with optional padding and border.

```tsx
import { Card } from '@revealui/presentation'

<Card>
  <h2 className="text-lg font-semibold">Revenue</h2>
  <p className="text-3xl font-bold">$12,400</p>
</Card>
```

#### `Stat`
KPI / metric display with label, value, and trend.

```tsx
import { Stat } from '@revealui/presentation'

<Stat label="Monthly revenue" value="$12,400" change="+8.2%" trend="up" />
```

#### `Table`
Responsive data table.

```tsx
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@revealui/presentation'

<Table>
  <TableHead>
    <TableRow>
      <TableHeader>Name</TableHeader>
      <TableHeader>Status</TableHeader>
    </TableRow>
  </TableHead>
  <TableBody>
    {rows.map((row) => (
      <TableRow key={row.id}>
        <TableCell>{row.name}</TableCell>
        <TableCell><Badge>{row.status}</Badge></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

#### `Avatar` / `AvatarGroup`
User avatar with fallback initials.

```tsx
import { Avatar, AvatarGroup } from '@revealui/presentation'

<Avatar src={user.avatar} name={user.name} size="md" />
<AvatarGroup users={team} max={4} />
```

#### `DescriptionList`
Label-value pair list for detail views.

```tsx
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@revealui/presentation'

<DescriptionList>
  <DescriptionTerm>Plan</DescriptionTerm>
  <DescriptionDetails>Pro — $49/month</DescriptionDetails>
  <DescriptionTerm>Renewal</DescriptionTerm>
  <DescriptionDetails>March 15, 2026</DescriptionDetails>
</DescriptionList>
```

#### `Timeline`
Vertical chronological list.

```tsx
import { Timeline, TimelineItem } from '@revealui/presentation'

<Timeline>
  <TimelineItem date="Mar 4" title="Deployment" description="v1.2.0 deployed to production." />
  <TimelineItem date="Mar 3" title="Review" description="PR #42 approved." />
</Timeline>
```

#### `Stepper`
Multi-step progress indicator.

```tsx
import { Stepper } from '@revealui/presentation'

<Stepper
  steps={['Account', 'Project', 'Database', 'Done']}
  currentStep={2}
/>
```

#### `Pagination`
Page navigation controls.

```tsx
import { Pagination } from '@revealui/presentation'

<Pagination
  currentPage={page}
  totalPages={Math.ceil(total / perPage)}
  onPageChange={setPage}
/>
```

#### `CodeBlock`
Syntax-highlighted code display with a copy button.

```tsx
import { CodeBlock } from '@revealui/presentation'

<CodeBlock
  code={`const x = 1`}
  language="typescript"
  filename="example.ts"
  showCopy
/>
```

#### `Kbd`
Keyboard shortcut display.

```tsx
import { Kbd } from '@revealui/presentation'

<Kbd>⌘K</Kbd>
```

#### `EmptyState`
Placeholder for empty lists or search results.

```tsx
import { EmptyState } from '@revealui/presentation'

<EmptyState
  title="No posts yet"
  description="Create your first post to get started."
  action={<Button href="/posts/new">New post</Button>}
/>
```

---

### Accordion

Collapsible content sections.

```tsx
import { Accordion, AccordionItem } from '@revealui/presentation'

<Accordion>
  <AccordionItem title="What is RevealUI?">
    RevealUI is open-source business infrastructure for software companies.
  </AccordionItem>
  <AccordionItem title="Is it free?">
    The core framework is MIT licensed and free to use.
  </AccordionItem>
</Accordion>
```

---

### Divider

Horizontal rule with optional label.

```tsx
import { Divider } from '@revealui/presentation'

<Divider />
<Divider label="or continue with" />
```

---

## Primitives

Low-level layout primitives that accept any Tailwind classes.

```tsx
import { Box, Flex, Grid, Heading, Text } from '@revealui/presentation'

<Flex gap={4} align="center">
  <Box className="w-12 h-12 rounded-full bg-zinc-200" />
  <Box>
    <Heading level={3}>Jane Smith</Heading>
    <Text color="muted">Admin</Text>
  </Box>
</Flex>

<Grid cols={3} gap={6}>
  {items.map((item) => <Card key={item.id}>{item.name}</Card>)}
</Grid>
```

---

## Utilities

### `cn(...classes)`

Merges Tailwind classes with `clsx`. Use this instead of string concatenation.

```ts
import { cn } from '@revealui/presentation'

<div className={cn('rounded px-4 py-2', isActive && 'bg-blue-600 text-white')} />
```

---

## Headless Primitives

Behaviour-only versions of form controls — bring your own styles.

| Export | Purpose |
|--------|---------|
| `ButtonHeadless` | Accessible button with keyboard handling |
| `InputHeadless` | Uncontrolled input with validation |
| `CheckboxHeadless` | Accessible checkbox |
| `SelectHeadless` | Accessible select |
| `TextareaHeadless` | Uncontrolled textarea |

---

## Related

- [`@revealui/core`](/reference/core) — Uses `presentation` for admin UI components
- [Component catalog](/docs/COMPONENT_CATALOG) — Visual index of all 50+ components
