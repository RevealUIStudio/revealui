# Populate API - Relationship Population Guide

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** February 2, 2026

---

## Overview

The Populate API enables automatic loading of relationship data in RevealUI. Instead of receiving just IDs for related documents, you can populate them with full document objects at query time.

### Key Features

- **Automatic Population** - Fetch related documents automatically
- **Depth Control** - Control how many levels deep to populate
- **Manual Population** - Populate documents after fetching
- **Circular Reference Safe** - Prevents infinite loops
- **Performance Optimized** - Uses DataLoader for batch loading
- **Type-Safe** - Full TypeScript support

---

## Basic Usage

### Automatic Population with `depth`

The simplest way to populate relationships is using the `depth` parameter:

```typescript
// Without populate (depth=0, default)
const post = await revealui.findByID({
  collection: 'posts',
  id: '123',
  depth: 0,
})
// Result: { id: '123', title: 'My Post', author: 'user-456' }

// With populate (depth=1)
const post = await revealui.findByID({
  collection: 'posts',
  id: '123',
  depth: 1,
})
// Result: {
//   id: '123',
//   title: 'My Post',
//   author: { id: 'user-456', name: 'Jane Doe', email: 'jane@example.com' }
// }
```

### Nested Population with Higher Depth

Control how deep the population goes:

```typescript
// depth=2: Populate relationships and their relationships
const post = await revealui.findByID({
  collection: 'posts',
  id: '123',
  depth: 2,
})
// Result:
// {
//   id: '123',
//   title: 'My Post',
//   author: {
//     id: 'user-456',
//     name: 'Jane Doe',
//     organization: {
//       id: 'org-789',
//       name: 'Acme Corp'
//     }
//   }
// }
```

---

## Manual Population

Use `populate()` to manually populate documents after fetching:

### Single Document

```typescript
// Fetch without population
const post = await revealui.findByID({
  collection: 'posts',
  id: '123',
  depth: 0,
})

// Manually populate relationships
const populated = await revealui.populate('posts', post, {
  depth: 2,
})
```

### Multiple Documents

```typescript
// Fetch multiple documents
const result = await revealui.find({
  collection: 'posts',
  where: { status: { equals: 'published' } },
  depth: 0,
})

// Populate all at once (batched for performance)
const populated = await revealui.populate('posts', result.docs, {
  depth: 1,
})
```

---

## Depth vs maxDepth

### `depth` (Query-Level Control)

Controls how deep to populate across ALL relationships in the query:

```typescript
// Populate all relationships 1 level deep
await revealui.find({ collection: 'posts', depth: 1 })

// Populate all relationships 2 levels deep
await revealui.find({ collection: 'posts', depth: 2 })
```

### `maxDepth` (Field-Level Control)

Field-level setting that limits population depth for a specific relationship:

```typescript
// In your collection config
{
  name: 'author',
  type: 'relationship',
  relationTo: 'users',
  maxDepth: 1,  // Never populate deeper than 1 level
}
```

**How they interact:**
- If `depth=3` but field has `maxDepth=1`, the field only populates to depth 1
- Use `maxDepth` to prevent expensive populations on large relationship trees
- Use `depth` to control overall query population

---

## Relationship Types

### Single Relationships

```typescript
// Schema
{
  name: 'author',
  type: 'relationship',
  relationTo: 'users',
}

// Query
const post = await revealui.findByID({
  collection: 'posts',
  id: '123',
  depth: 1,
})
// Result: { author: { id: 'user-1', name: 'Jane' } }
```

### Array Relationships (hasMany)

```typescript
// Schema
{
  name: 'authors',
  type: 'relationship',
  relationTo: 'users',
  hasMany: true,
}

// Query
const post = await revealui.findByID({
  collection: 'posts',
  id: '123',
  depth: 1,
})
// Result: {
//   authors: [
//     { id: 'user-1', name: 'Jane' },
//     { id: 'user-2', name: 'John' }
//   ]
// }
```

### Polymorphic Relationships

```typescript
// Schema
{
  name: 'related',
  type: 'relationship',
  relationTo: ['posts', 'pages'],
}

// Query
const doc = await revealui.findByID({
  collection: 'bookmarks',
  id: '123',
  depth: 1,
})
// Result: {
//   related: {
//     relationTo: 'posts',
//     value: { id: 'post-1', title: 'My Post' }
//   }
// }
```

---

## Advanced Usage

### Selective Population with `populate` Parameter

Control exactly which relationships to populate:

```typescript
// Populate specific collections only
const posts = await revealui.find({
  collection: 'posts',
  depth: 2,
  populate: {
    author: true,        // Populate author
    categories: false,   // Skip categories
  },
})
```

### Global Relationships

```typescript
// Populate relationships in globals
const header = await revealui.findGlobal({
  slug: 'header',
  depth: 2,
  populate: true,
})
```

### Circular Reference Handling

Circular references are automatically handled by depth limiting:

```typescript
// User -> Posts -> Author (User) -> Posts -> ...
// With depth=2, stops at the second User level

const user = await revealui.findByID({
  collection: 'users',
  id: 'user-1',
  depth: 2,  // Prevents infinite loop
})
// Result:
// {
//   id: 'user-1',
//   name: 'Jane',
//   posts: [
//     {
//       id: 'post-1',
//       title: 'My Post',
//       author: {
//         id: 'user-1',
//         name: 'Jane',
//         posts: ['post-1', 'post-2']  // IDs only (depth limit reached)
//       }
//     }
//   ]
// }
```

---

## Performance Best Practices

### 1. Use Appropriate Depth

```typescript
// ❌ Bad: Over-fetching
const posts = await revealui.find({
  collection: 'posts',
  depth: 3,  // Fetches way more than needed
})

// ✅ Good: Fetch only what you need
const posts = await revealui.find({
  collection: 'posts',
  depth: 1,  // Just direct relationships
})
```

### 2. Batch Population

```typescript
// ❌ Bad: Populate one at a time
for (const post of posts) {
  await revealui.populate('posts', post, { depth: 1 })
}

// ✅ Good: Populate all at once
const populated = await revealui.populate('posts', posts, { depth: 1 })
```

### 3. Set Field maxDepth

```typescript
// In collection config
{
  name: 'relatedPosts',
  type: 'relationship',
  relationTo: 'posts',
  hasMany: true,
  maxDepth: 1,  // Prevents deep population on large arrays
}
```

### 4. Use DataLoader Caching

Population automatically uses DataLoader for request-level caching:

```typescript
// These both use cached results (no duplicate queries)
const post1 = await revealui.findByID({ collection: 'posts', id: '123', depth: 1 })
const post2 = await revealui.findByID({ collection: 'posts', id: '123', depth: 1 })
```

---

## Common Patterns

### Pattern 1: AI Context Generation

```typescript
// Fetch post with all related context for AI
const post = await revealui.findByID({
  collection: 'posts',
  id: '123',
  depth: 2,
})

// Now post includes author, categories, related posts, etc.
const context = `
  Post: ${post.title}
  Author: ${post.author.name}
  Categories: ${post.categories.map(c => c.name).join(', ')}
  Related: ${post.relatedPosts.map(p => p.title).join(', ')}
`
```

### Pattern 2: API Response Enrichment

```typescript
// In your API route
export async function GET(request: NextRequest) {
  const posts = await revealui.find({
    collection: 'posts',
    where: { status: { equals: 'published' } },
    depth: 1,  // Include authors and categories
  })

  return Response.json(posts.docs)
}
```

### Pattern 3: Lazy Population

```typescript
// Fetch basic data first
const posts = await revealui.find({
  collection: 'posts',
  depth: 0,
})

// Populate only when needed (e.g., user clicks "Show details")
if (needDetails) {
  const populated = await revealui.populate('posts', posts.docs, {
    depth: 2,
  })
}
```

### Pattern 4: Global Context Loading

```typescript
// Load header with all menu items and their links populated
const header = await revealui.findGlobal({
  slug: 'header',
  depth: 2,
  populate: true,
})

// Use in layout
<Header
  logo={header.logo}
  menuItems={header.menuItems}  // Fully populated
/>
```

---

## API Reference

### `revealui.populate()`

**Signature:**
```typescript
populate(
  collection: string,
  docs: RevealDocument | RevealDocument[],
  options?: {
    depth?: number              // How deep to populate (default: 1)
    draft?: boolean             // Include draft documents (default: false)
    locale?: string             // Locale for population (default: 'en')
    fallbackLocale?: string     // Fallback locale (default: 'en')
    overrideAccess?: boolean    // Bypass access control (default: false)
    showHiddenFields?: boolean  // Show hidden fields (default: false)
    req?: RevealRequest         // Custom request context
  }
): Promise<RevealDocument | RevealDocument[]>
```

**Parameters:**
- `collection` - The collection slug containing the documents
- `docs` - Single document or array of documents to populate
- `options` - Optional configuration

**Returns:** Populated document(s) with relationships loaded

**Example:**
```typescript
const populated = await revealui.populate('posts', docs, { depth: 2 })
```

---

## Migration Guide

### From Manual Fetching

**Before:**
```typescript
// Manually fetch author
const post = await revealui.findByID({ collection: 'posts', id: '123' })
const author = await revealui.findByID({
  collection: 'users',
  id: post.author,
})
post.author = author
```

**After:**
```typescript
// Automatic population
const post = await revealui.findByID({
  collection: 'posts',
  id: '123',
  depth: 1,
})
// post.author is already populated
```

### From Payload CMS

If migrating from Payload CMS, the API is very similar:

```typescript
// Payload CMS
const posts = await payload.find({
  collection: 'posts',
  depth: 2,
})

// RevealUI (same!)
const posts = await revealui.find({
  collection: 'posts',
  depth: 2,
})
```

---

## Troubleshooting

### Issue: Relationships not populating

**Check:**
1. Is `depth` set? (default is 0)
2. Does the field have `maxDepth` limiting it?
3. Is the related collection configured correctly?

```typescript
// ❌ Won't populate (depth=0)
await revealui.find({ collection: 'posts' })

// ✅ Will populate
await revealui.find({ collection: 'posts', depth: 1 })
```

### Issue: Performance slow with deep population

**Solution:** Reduce depth or set field `maxDepth`:

```typescript
// In collection config
{
  name: 'relatedPosts',
  type: 'relationship',
  relationTo: 'posts',
  hasMany: true,
  maxDepth: 1,  // Limit this field
}
```

### Issue: Circular references causing issues

**Solution:** Depth automatically limits circular references. If needed, reduce depth:

```typescript
// Safe: depth=2 prevents infinite loops
await revealui.find({ collection: 'users', depth: 2 })
```

---

## See Also

- [Type System Documentation](./TYPE_SYSTEM.md)
- [Contract System Guide](./CONTRACT_SYSTEM_COMPLETE.md)
- [Relationship Configuration](../packages/core/src/relationships/README.md)

---

*Last updated: February 2, 2026*
*Implementation: RevealUI Core v0.1.0*
