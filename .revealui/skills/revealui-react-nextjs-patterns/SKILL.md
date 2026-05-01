---
name: revealui-react-nextjs-patterns
description: React 19 and Next.js 16 best practices for RevealUI development
version: "1.0.0"
author: RevealUI Team
tags:
  - react
  - nextjs
  - patterns
  - server-components
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

# RevealUI React 19 & Next.js 16 Patterns

Best practices and patterns for React 19 and Next.js 16 development in the RevealUI framework.

## React 19 Server Components

### Rule 1: Default to Server Components

**Always use Server Components by default** unless you need client-side interactivity.

```tsx
// ✅ GOOD: Server Component (default)
export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}

// ❌ BAD: Unnecessary "use client"
"use client"
export default function Page() {
  return <div>Static content</div>
}
```

### Rule 2: Client Components at Leaf Nodes

**Push "use client" boundaries as low as possible** in the component tree.

```tsx
// ✅ GOOD: Only interactive parts are client components
// app/page.tsx (Server Component)
import { InteractiveButton } from './InteractiveButton'

export default function Page() {
  return (
    <div>
      <h1>Server-rendered heading</h1>
      <InteractiveButton /> {/* Client component */}
    </div>
  )
}

// app/InteractiveButton.tsx
"use client"
export function InteractiveButton() {
  return <button onClick={() => alert('Hi')}>Click</button>
}
```

### Rule 3: No Hooks in Server Components

```tsx
// ❌ BAD: Hooks in Server Component
export default function Page() {
  const [state, setState] = useState(0) // Error!
  return <div>{state}</div>
}

// ✅ GOOD: Extract to Client Component
"use client"
export function Counter() {
  const [state, setState] = useState(0)
  return <button onClick={() => setState(s => s + 1)}>{state}</button>
}
```

## Next.js 16 App Router Patterns

### Rule 4: Async Server Components for Data Fetching

```tsx
// ✅ GOOD: Async Server Component
export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  return <article>{post.content}</article>
}

// ❌ BAD: useEffect for data fetching in Client Component
"use client"
export default function PostPage() {
  const [post, setPost] = useState(null)
  useEffect(() => {
    fetchPost().then(setPost)
  }, [])
  return <article>{post?.content}</article>
}
```

### Rule 5: Parallel Data Fetching

```tsx
// ✅ GOOD: Fetch in parallel
export default async function Page() {
  const [posts, categories] = await Promise.all([
    getPosts(),
    getCategories()
  ])
  return <Layout posts={posts} categories={categories} />
}

// ❌ BAD: Sequential fetching
export default async function Page() {
  const posts = await getPosts()
  const categories = await getCategories() // Waits for posts
  return <Layout posts={posts} categories={categories} />
}
```

### Rule 6: Loading & Error States

```tsx
// app/posts/loading.tsx
export default function Loading() {
  return <PostSkeleton />
}

// app/posts/error.tsx
"use client"
export default function Error({ error, reset }: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

## RevealUI-Specific Patterns

### Rule 7: Collections Integration

```tsx
// ✅ GOOD: Use RevealUI for data fetching
import { getRevealUI } from '@revealui/core'

export default async function PostsPage() {
  const revealui = await getRevealUI()
  const posts = await revealui.find({
    collection: 'posts',
    where: { _status: { equals: 'published' } },
  })
  return <PostsList posts={posts.docs} />
}
```

### Rule 8: Access Control in Server Components

```tsx
// ✅ GOOD: Check permissions in Server Components
import { getCurrentUser } from '@revealui/auth'

export default async function AdminPage() {
  const user = await getCurrentUser()

  if (!user || user.role !== 'admin') {
    redirect('/login')
  }

  return <AdminDashboard />
}
```

### Rule 9: Metadata Generation

```tsx
// ✅ GOOD: Use generateMetadata for SEO
import type { Metadata } from 'next'

export async function generateMetadata({
  params
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = await getPost(params.slug)

  return {
    title: post.title,
    description: post.meta?.description,
    openGraph: {
      images: [post.meta?.image?.url],
    },
  }
}
```

## Performance Optimization

### Rule 10: Image Optimization

```tsx
import Image from 'next/image'

// ✅ GOOD: Use Next.js Image component
<Image
  src={media.url}
  alt={media.alt}
  width={media.width}
  height={media.height}
  priority={isAboveFold}
/>

// ❌ BAD: Regular img tag
<img src={media.url} alt={media.alt} />
```

### Rule 11: Dynamic Imports for Large Components

```tsx
import dynamic from 'next/dynamic'

// ✅ GOOD: Code split large client components
const RichTextEditor = dynamic(
  () => import('@/components/RichTextEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
)
```

### Rule 12: Streaming with Suspense

```tsx
import { Suspense } from 'react'

// ✅ GOOD: Stream slow components
export default function Page() {
  return (
    <div>
      <FastContent />
      <Suspense fallback={<Skeleton />}>
        <SlowContent />
      </Suspense>
    </div>
  )
}
```

## Form Handling

### Rule 13: Server Actions for Forms

```tsx
// app/actions.ts
"use server"
export async function createPost(formData: FormData) {
  const title = formData.get('title')
  const revealui = await getRevealUI()
  return await revealui.create({
    collection: 'posts',
    data: { title },
  })
}

// app/new-post/page.tsx
import { createPost } from '../actions'

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <button type="submit">Create</button>
    </form>
  )
}
```

### Rule 14: Client-Side Form State

```tsx
"use client"
import { useFormState, useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  )
}

export function PostForm() {
  const [state, formAction] = useFormState(createPost, null)

  return (
    <form action={formAction}>
      <input name="title" />
      <SubmitButton />
      {state?.error && <p>{state.error}</p>}
    </form>
  )
}
```

## Common Mistakes to Avoid

### ❌ Don't: Fetch data in Client Components with useEffect
### ✅ Do: Use async Server Components

### ❌ Don't: Add "use client" at the top level
### ✅ Do: Push client boundaries to leaf components

### ❌ Don't: Use getServerSideProps (Pages Router)
### ✅ Do: Use async Server Components (App Router)

### ❌ Don't: Prop drill through many levels
### ✅ Do: Use React Context or pass through URL params

### ❌ Don't: Ignore TypeScript errors with `any`
### ✅ Do: Use proper types (see revealui-typescript-quality skill)

## Quick Reference

**Server Component**: Default, can be async, no hooks, server-only code OK
**Client Component**: "use client", hooks allowed, runs in browser, interactive

**When to use Client Components**:
- Event handlers (onClick, onChange, etc.)
- Browser APIs (localStorage, window, document)
- React hooks (useState, useEffect, useRef)
- Third-party libraries that use hooks

**When to use Server Components**:
- Data fetching
- Direct database access
- Server-only code (env vars, private keys)
- Large dependencies that don't need client-side
- SEO-critical content

## Examples in RevealUI Codebase

Look at these files for good examples:
- `apps/admin/src/app/(frontend)/posts/[slug]/page.tsx` - Async Server Component
- `apps/admin/src/lib/components/RichText/serialize.tsx` - Server-side rendering
- `apps/admin/src/lib/blocks/Form/Component.tsx` - Client Component with hooks
- `apps/admin/src/lib/globals/Header/Component.client.tsx` - Interactive header

Always follow these patterns to maintain consistency and performance in RevealUI!
