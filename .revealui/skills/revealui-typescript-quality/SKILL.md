---
name: revealui-typescript-quality
description: TypeScript best practices to eliminate 267 any types and improve code quality
version: "1.0.0"
author: RevealUI Team
tags:
  - typescript
  - type-safety
  - code-quality
compatibility:
  - claude-code
  - universal
allowedTools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# RevealUI TypeScript Quality Standards

Guidelines to eliminate the 267 `any` types in RevealUI and maintain type safety throughout the codebase.

## Critical Goal

**Target**: Reduce `any` types from 267 to 0
**Priority**: High - Type safety prevents runtime errors and improves developer experience

## Rule 1: Never Use `any` - Use These Instead

### Use `unknown` for Truly Unknown Types

```typescript
// ❌ BAD: any loses all type safety
function processData(data: any) {
  return data.value // No type checking
}

// ✅ GOOD: unknown requires type checking
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value
  }
  throw new Error('Invalid data')
}
```

### Use Generic Types

```typescript
// ❌ BAD
function firstElement(arr: any[]) {
  return arr[0]
}

// ✅ GOOD
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0]
}
```

### Use Type Guards

```typescript
// ❌ BAD
function process(value: any) {
  if (value.length) {
    return value.length
  }
}

// ✅ GOOD
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function process(value: unknown) {
  if (isString(value)) {
    return value.length // TypeScript knows it's a string
  }
}
```

## Rule 2: Type External Data Properly

### API Responses

```typescript
// ❌ BAD
async function fetchUser(id: string): Promise<any> {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
}

// ✅ GOOD
interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'super-admin'
}

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  const data = await response.json()
  // Validate with Zod in production
  return data as User
}

// ✅ BETTER: Use Zod for runtime validation
import { z } from 'zod'

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'super-admin']),
})

type User = z.infer<typeof UserSchema>

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  const data = await response.json()
  return UserSchema.parse(data) // Runtime validation!
}
```

### Form Data

```typescript
// ❌ BAD
function handleSubmit(formData: any) {
  const email = formData.email
  const password = formData.password
}

// ✅ GOOD
interface FormData {
  email: string
  password: string
}

function handleSubmit(formData: FormData) {
  const { email, password } = formData
}

// ✅ BETTER: Use Web API FormData with type safety
function handleSubmit(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validate
  if (!email || !password) {
    throw new Error('Missing required fields')
  }

  return { email, password }
}
```

## Rule 3: Type Component Props Properly

### React Component Props

```typescript
// ❌ BAD
export function Card(props: any) {
  return <div>{props.title}</div>
}

// ✅ GOOD
interface CardProps {
  title: string
  description?: string
  onClick?: () => void
  children?: React.ReactNode
}

export function Card({ title, description, onClick, children }: CardProps) {
  return (
    <div onClick={onClick}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
  )
}
```

### Polymorphic Components

```typescript
// ✅ GOOD: Type-safe polymorphic component
type ButtonProps<T extends React.ElementType> = {
  as?: T
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<T>

function Button<T extends React.ElementType = 'button'>({
  as,
  children,
  ...props
}: ButtonProps<T>) {
  const Component = as || 'button'
  return <Component {...props}>{children}</Component>
}

// Usage with full type safety
<Button onClick={() => {}}>Click</Button>
<Button as="a" href="/page">Link</Button>
```

## Rule 4: Type Event Handlers

```typescript
// ❌ BAD
function handleClick(event: any) {
  event.preventDefault()
}

// ✅ GOOD
function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault()
  console.log(event.currentTarget.value)
}

function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  console.log(event.target.value)
}

function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const formData = new FormData(event.currentTarget)
}
```

## Rule 5: Type Async Functions

```typescript
// ❌ BAD
async function loadData(): Promise<any> {
  return await fetch('/api/data')
}

// ✅ GOOD
interface Data {
  items: Array<{ id: string; name: string }>
  total: number
}

async function loadData(): Promise<Data> {
  const response = await fetch('/api/data')
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}
```

## Rule 6: Type Third-Party Libraries

```typescript
// ❌ BAD: Untyped library
declare module 'some-library' {
  export function doSomething(arg: any): any
}

// ✅ GOOD: Add types
declare module 'some-library' {
  export interface Options {
    timeout?: number
    retries?: number
  }

  export function doSomething(
    arg: string,
    options?: Options
  ): Promise<{ success: boolean; data: unknown }>
}
```

## Rule 7: Use Utility Types

```typescript
// Partial: Make all properties optional
type PartialUser = Partial<User>

// Required: Make all properties required
type RequiredConfig = Required<Config>

// Pick: Select specific properties
type UserPreview = Pick<User, 'id' | 'name' | 'avatar'>

// Omit: Exclude specific properties
type UserWithoutPassword = Omit<User, 'password'>

// Record: Create object type with specific keys
type UserRoles = Record<string, 'admin' | 'user'>

// Example usage
interface User {
  id: string
  name: string
  email: string
  password: string
  avatar?: string
}

// ✅ GOOD: Reuse types safely
function updateUser(id: string, updates: Partial<User>) {
  // updates can have any User properties, all optional
}

function displayUser(user: UserWithoutPassword) {
  // user has all properties except password
}
```

## Rule 8: Type Guards for Union Types

```typescript
// Union type
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; size: number }
  | { kind: 'rectangle'; width: number; height: number }

// ❌ BAD
function getArea(shape: any) {
  if (shape.kind === 'circle') {
    return Math.PI * shape.radius ** 2
  }
  // ...
}

// ✅ GOOD: Discriminated union with type narrowing
function getArea(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'square':
      return shape.size ** 2
    case 'rectangle':
      return shape.width * shape.height
  }
}
```

## Rule 9: Type Collections Access

```typescript
// ❌ BAD
const collections: any = {
  users: { /* ... */ },
  posts: { /* ... */ },
}

// ✅ GOOD
interface Collection {
  name: string
  fields: Record<string, unknown>
}

const collections: Record<string, Collection> = {
  users: { name: 'users', fields: {} },
  posts: { name: 'posts', fields: {} },
}

// ✅ BETTER: Type-safe collection access
type CollectionName = 'users' | 'posts' | 'media'

interface Collections {
  users: UserCollection
  posts: PostCollection
  media: MediaCollection
}

function getCollection<T extends CollectionName>(
  name: T
): Collections[T] {
  return collections[name]
}

// Usage: fully typed!
const users = getCollection('users') // UserCollection type
```

## Rule 10: Avoid Type Assertions (as)

```typescript
// ❌ BAD: Unsafe type assertion
const user = data as User

// ✅ GOOD: Validate first
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'email' in data
  )
}

const data = await fetchData()
if (isUser(data)) {
  // data is User type
  console.log(data.email)
}

// ✅ BETTER: Use Zod
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
})

const data = await fetchData()
const user = UserSchema.parse(data) // Throws if invalid
```

## Common Patterns in RevealUI

### RevealUI Collections

```typescript
// ✅ GOOD: Type RevealUI operations
import type { RevealUI } from '@revealui/core'

async function createPost(
  revealui: RevealUI,
  data: {
    title: string
    content: string
    author: string
  }
) {
  return await revealui.create({
    collection: 'posts',
    data,
  })
}
```

### Access Control Functions

```typescript
// ✅ GOOD: Type access control
import type { AccessControl } from '@revealui/core'

export const isAdmin: AccessControl = ({ req: { user } }) => {
  return user?.role === 'admin'
}

export const isAdminOrSelf: AccessControl = ({ req: { user }, id }) => {
  if (user?.role === 'admin') return true
  return user?.id === id
}
```

### Server Actions

```typescript
// ✅ GOOD: Type server actions
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const CreatePostSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
})

export async function createPost(formData: FormData) {
  const rawData = {
    title: formData.get('title'),
    content: formData.get('content'),
  }

  const validated = CreatePostSchema.parse(rawData)

  // Create post...

  revalidatePath('/posts')
  return { success: true, id: 'new-post-id' }
}
```

## Finding and Fixing `any` Types

### Search for any types
```bash
# Find all any types in codebase
grep -r ": any" packages/ apps/ --include="*.ts" --include="*.tsx"

# Find function parameters with any
grep -r "any)" packages/ apps/ --include="*.ts" --include="*.tsx"
```

### Priority Order
1. **Fix public APIs first** (exported functions, components)
2. **Fix type definitions** (interfaces, types)
3. **Fix function parameters**
4. **Fix return types**
5. **Fix variable declarations**

## Quick Wins

Replace common `any` patterns:

```typescript
// Event handlers
event: any → event: React.MouseEvent<HTMLElement>

// Form data
data: any → data: FormData or data: Record<string, unknown>

// API responses
response: any → response: { data: T; status: number }

// Props
props: any → props: ComponentProps

// Callbacks
callback: any → callback: (value: T) => void

// Array items
items: any[] → items: T[] or items: Array<T>

// Objects
obj: any → obj: Record<string, unknown> or define interface
```

## VSCode Settings

Add to `.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  },
  "typescript.preferences.strictNullChecks": true
}
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zod Documentation](https://zod.dev)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

## Tracking Progress

Current status: **267 `any` types** remaining

After each fix session, run:
```bash
grep -r ": any" packages/ apps/ --include="*.ts" --include="*.tsx" | wc -l
```

**Goal**: 0 `any` types in RevealUI codebase!

Every `any` type eliminated improves:
- ✅ Type safety
- ✅ Developer experience
- ✅ Refactoring confidence
- ✅ IDE autocomplete
- ✅ Bug prevention

Let's make RevealUI 100% type-safe! 🎯
