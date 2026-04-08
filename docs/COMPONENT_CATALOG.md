---
title: "Component Catalog"
description: "Complete reference for @revealui/presentation UI components"
category: reference
audience: developer
---

# RevealUI Component Catalog

**Last Updated:** 2026-03-03
**Packages:** `@revealui/presentation`, `@revealui/core`
**Total Components:** 64

---

## Table of Contents

### Presentation Components (@revealui/presentation)
1. [Primitives](#primitives) (6 components)
2. [Form Controls](#form-controls) (13 components)
3. [Data Display](#data-display) (8 components)
4. [Navigation](#navigation) (4 components)
5. [Feedback](#feedback) (3 components)
6. [Layout](#layout) (4 components)
7. [Headless Components](#headless-components) (5 components)

### Core Components (@revealui/core)
8. [CMS Admin Components](#cms-admin-components) (3 components)
9. [CMS UI Components](#cms-ui-components) (8 components)
10. [Rich Text Editor](#rich-text-editor) (7 components)

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
import { Text } from '@revealui/presentation/primitives'

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
import { Heading } from '@revealui/presentation/primitives'

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

### Button

Primary action button with variants.

**Props:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'ghost' | 'link' | 'outline' | 'primary' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'clear'
  asChild?: boolean
}
```

**Variants:**
- `default` - Primary blue button
- `destructive` - Red button for dangerous actions
- `ghost` - Transparent button
- `link` - Text link style
- `outline` - Outlined button
- `primary` - Primary accent
- `secondary` - Secondary accent

**Sizes:**
- `default` - h-10 px-4 py-2
- `sm` - h-9 px-3
- `lg` - h-11 px-8
- `icon` - size-10 (square)
- `clear` - No size styling

**Usage:**
```tsx
import { Button } from '@revealui/presentation'

<Button variant="primary" size="lg">
  Click Me
</Button>

<Button variant="destructive" size="sm">
  Delete
</Button>

<Button variant="ghost" size="icon">
  <IconSearch />
</Button>

// Render as child element
<Button asChild>
  <a href="/link">Link Button</a>
</Button>
```

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

Dropdown select input.

**Props:**
```typescript
extends React.SelectHTMLAttributes<HTMLSelectElement>
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

Checkbox input with label support.

**Props:**
```typescript
extends React.InputHTMLAttributes<HTMLInputElement>
```

**Usage:**
```tsx
import { Checkbox } from '@revealui/presentation'

<Checkbox id="terms" defaultChecked />
<label htmlFor="terms">Accept terms</label>
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
import { radio } from '@revealui/presentation'

<radio name="choice" value="option1" />
<label>Option 1</label>

<radio name="choice" value="option2" />
<label>Option 2</label>
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
import { switch } from '@revealui/presentation'

<switch checked={enabled} onChange={setEnabled} />
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
import { fieldset } from '@revealui/presentation'

<fieldset>
  <legend>Account Information</legend>
  <Label>Name</Label>
  <Input />
</fieldset>
```

---

### Combobox

Autocomplete combo box with native accessibility.

**Usage:**
```tsx
import { combobox } from '@revealui/presentation'

// See component file for detailed API
<combobox>
  {/* Options */}
</combobox>
```

---

### Listbox

Listbox select component with native accessibility.

**Usage:**
```tsx
import { listbox } from '@revealui/presentation'

// See component file for detailed API
<listbox>
  {/* Options */}
</listbox>
```

---

### Dropdown

Dropdown menu component with native accessibility.

**Usage:**
```tsx
import { dropdown } from '@revealui/presentation'

// See component file for detailed API
<dropdown>
  {/* Menu items */}
</dropdown>
```

---

## Headless Components

Unstyled, accessible components for custom styling.

### button-headless

Headless button primitive.

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
import { table } from '@revealui/presentation'

<table>
  <thead>
    <tr>
      <th>Header 1</th>
      <th>Header 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Cell 1</td>
      <td>Cell 2</td>
    </tr>
  </tbody>
</table>
```

---

### Description List

Description list component for key-value pairs.

**Usage:**
```tsx
import { descriptionList } from '@revealui/presentation'

// See component file for detailed API
```

---

### Avatar

User avatar component.

**Usage:**
```tsx
import { avatar } from '@revealui/presentation'

<avatar src="/avatar.jpg" alt="User Name" />
```

---

### Badge

Badge component for status indicators.

**Usage:**
```tsx
import { badge } from '@revealui/presentation'

<badge>New</badge>
<badge variant="success">Active</badge>
```

---

### Divider

Visual divider/separator.

**Usage:**
```tsx
import { divider } from '@revealui/presentation'

<divider />

<div>Section 1</div>
<divider />
<div>Section 2</div>
```

---

### Heading (Component)

Styled heading component.

**Usage:**
```tsx
import { heading } from '@revealui/presentation'

<heading>Page Title</heading>
```

---

### Text (Component)

Styled text component.

**Usage:**
```tsx
import { text } from '@revealui/presentation'

<text>Body text content</text>
```

---

## Navigation

Navigation components.

### Link

Navigation link component.

**Usage:**
```tsx
import { link } from '@revealui/presentation'

<link href="/about">About</link>
```

---

### Navbar

Navigation bar component.

**Usage:**
```tsx
import { navbar } from '@revealui/presentation'

<navbar>
  {/* Navigation items */}
</navbar>
```

---

### Sidebar

Sidebar navigation component.

**Usage:**
```tsx
import { sidebar } from '@revealui/presentation'

<sidebar>
  {/* Sidebar content */}
</sidebar>
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

## Feedback

User feedback components.

### Alert

Alert/notification component.

**Usage:**
```tsx
import { alert } from '@revealui/presentation'

<alert variant="info">
  Information message
</alert>

<alert variant="error">
  Error message
</alert>
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

## Layout

Page layout components.

### auth-layout

Authentication page layout.

**Usage:**
```tsx
import { authLayout } from '@revealui/presentation'

<authLayout>
  {/* Auth forms */}
</authLayout>
```

---

### sidebar-layout

Layout with sidebar navigation.

**Usage:**
```tsx
import { sidebarLayout } from '@revealui/presentation'

<sidebarLayout>
  {/* Page content with sidebar */}
</sidebarLayout>
```

---

### stacked-layout

Stacked page layout.

**Usage:**
```tsx
import { stackedLayout } from '@revealui/presentation'

<stackedLayout>
  {/* Stacked content sections */}
</stackedLayout>
```

---

## CMS Admin Components

Components for the RevealUI CMS admin interface (packages/core/src/client/admin/components/).

### AdminDashboard

Main CMS admin dashboard component.

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

Form for creating/editing CMS documents.

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

## CMS UI Components

Form components for the CMS admin interface (packages/core/src/client/ui/).

**Package:** `@revealui/core/client/ui`

### TextInput (CMS)

CMS text input field with form integration.

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

### Button (CMS)

CMS button component.

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

CMS select dropdown input.

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

### Textarea (CMS)

CMS textarea component.

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

### Checkbox (CMS)

CMS checkbox component.

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

## CMS Hooks

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

### @revealui/presentation (58 components)
- 6 Primitives (Box, Flex, Grid, Text, Heading, Slot)
- 13 Form Controls (Button, Input, Textarea, Select, Checkbox, Radio, etc.)
- 8 Data Display (Card, Table, Avatar, Badge, etc.)
- 4 Navigation (Link, Navbar, Sidebar, Pagination)
- 3 Feedback (Alert, Dialog, Toast)
- 4 Layout (auth-layout, sidebar-layout, stacked-layout, empty-state)
- 5 Headless variants

### @revealui/core (21 components)
- 3 Admin Components (AdminDashboard, CollectionList, DocumentForm)
- 8 CMS UI Components (TextInput, Button, SelectInput, Textarea, Checkbox, FieldLabel, ModalProvider, FieldsDrawer)
- 7 Rich Text Editor (RichTextEditor, ImageNode, ImageNodeComponent, ImageUploadButton, ToolbarPlugin, FloatingToolbarPlugin, ImagePlugin)
- 3 Form Hooks (useFormFields, useField, useModal)

---

## Related Documentation

- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Styling reference
- [class-variance-authority](https://cva.style/docs) - Variant management
- [Lexical Documentation](https://lexical.dev) - Rich text editor framework
- [Package Reference](./REFERENCE.md) - Framework package reference
- [Admin Guide](./ADMIN_GUIDE.md) - Admin dashboard and content guide

---

**Last Updated:** 2026-03-03
**Packages:** `@revealui/presentation` (58 components), `@revealui/core` (21 components)
