# CMS Agent (RevealUI Framework)

Specialized agent for RevealUI CMS framework tasks, collections, hooks, and access control.

## Responsibilities

- Creating and configuring RevealUI collections
- Setting up hooks (beforeChange, afterChange, afterRead, etc.)
- Configuring access control rules
- Working with RevealUI-specific patterns
- Managing blocks and fields

## Key Patterns

### 1. Collection Creation

Basic collection structure:

```typescript
import type { CollectionConfig } from 'revealui/cms'

const MyCollection: CollectionConfig = {
  slug: 'my-collection',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
  ],
}
```

### 2. Access Control

Use access helpers from `@/lib/access`:

```typescript
import { anyone, isAdmin, isAdminAndUser, isSuperAdmin } from '@/lib/access'
import { isTenantAdminOrSuperAdmin } from '@/lib/access/tenants/isTenantAdminOrSuperAdmin'

const MyCollection: CollectionConfig = {
  access: {
    read: anyone, // Public read
    create: isAdmin, // Only admins
    update: isAdminAndUser, // Admin or own record
    delete: isAdmin, // Only admins
  },
  fields: [
    {
      name: 'sensitiveField',
      access: {
        read: isAdmin, // Field-level access
        update: isSuperAdmin, // Different access for updates
      },
    },
  ],
}
```

### 3. Hooks

Hooks pattern - create in `hooks/` directory and import:

```typescript
// hooks/beforeChange.ts
import type { CollectionBeforeChangeHook } from 'revealui/cms'

export const beforeChange: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
}) => {
  // Modify data before save
  if (operation === 'create') {
    data.createdBy = req.user?.id
  }
  return data
}

// In collection:
import { beforeChange } from './hooks/beforeChange'

const MyCollection: CollectionConfig = {
  hooks: {
    beforeChange: [beforeChange],
    afterChange: [afterChange],
    afterRead: [afterRead],
    afterDelete: [afterDelete],
  },
}
```

### 4. Common Hook Patterns

**Populate fields:**

```typescript
// hooks/populateAuthors.ts
export const populateAuthors: CollectionAfterReadHook = async ({ doc, req }) => {
  if (doc.authors && Array.isArray(doc.authors)) {
    doc.populatedAuthors = await req.payload.findByID({
      collection: 'users',
      id: doc.authors[0], // Simplified
    })
  }
  return doc
}
```

**Revalidation:**

```typescript
// hooks/revalidateProduct.ts
export const revalidateProduct: CollectionAfterChangeHook = async ({ doc }) => {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `/products/${doc.slug}` }),
    })
  } catch (error) {
    console.error('Revalidation failed:', error)
  }
  return doc
}
```

**Cleanup operations:**

```typescript
// hooks/deleteProductFromCarts.ts
export const deleteProductFromCarts: CollectionAfterDeleteHook = async ({
  id,
  req,
}) => {
  // Remove product from all carts
  await req.payload.update({
    collection: 'carts',
    where: { 'items.product': { equals: id } },
    data: { $pull: { items: { product: id } } },
  })
}
```

### 5. Field Types

Common field patterns:

```typescript
{
  name: 'title',
  type: 'text',
  required: true,
},
{
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  admin: {
    position: 'sidebar',
  },
},
{
  name: 'author',
  type: 'relationship',
  relationTo: 'users',
  required: true,
},
{
  name: 'tags',
  type: 'select',
  hasMany: true,
  options: [
    { label: 'Tag 1', value: 'tag1' },
    { label: 'Tag 2', value: 'tag2' },
  ],
},
{
  name: 'content',
  type: 'blocks',
  blocks: [Content, ArchiveBlock, CallToAction],
},
```

### 6. Field-Level Access Control

```typescript
{
  name: 'roles',
  type: 'select',
  hasMany: true,
  access: {
    create: isSuperAdmin, // Only super admin can set roles
    update: isSuperAdmin,
    read: isSuperAdmin, // Hidden from other users
  },
  options: [
    { label: 'Admin', value: 'user-admin' },
    { label: 'Super Admin', value: 'user-super-admin' },
  ],
}
```

### 7. Tenant-Scoped Collections

For multi-tenant support:

```typescript
// Access control checks tenant membership
import { isTenantAdminOrSuperAdmin } from '@/lib/access/tenants/isTenantAdminOrSuperAdmin'

const MyCollection: CollectionConfig = {
  access: {
    create: isTenantAdminOrSuperAdmin,
    read: isTenantAdminOrSuperAdmin,
    update: isTenantAdminOrSuperAdmin,
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      access: {
        read: isTenantAdminOrSuperAdmin,
      },
    },
  ],
}
```

### 8. Collection Structure

Standard collection file structure:

```
collections/
  MyCollection/
    index.ts           # Main collection config
    access/            # Access control functions
      checkAccess.ts
    hooks/             # Collection hooks
      beforeChange.ts
      afterChange.ts
      afterRead.ts
      afterDelete.ts
    ui/                # Custom UI components (optional)
      MySelect.tsx
```

### 9. Versions and Drafts

Enable draft mode:

```typescript
const MyCollection: CollectionConfig = {
  versions: {
    drafts: true,
  },
  admin: {
    preview: (doc) => {
      return `${process.env.NEXT_PUBLIC_SERVER_URL}/api/preview?url=${encodeURIComponent(
        `/path/${doc.slug}`
      )}&secret=${process.env.REVEALUI_DRAFT_SECRET}`
    },
  },
}
```

## File Locations

- Collections: `apps/cms/src/lib/collections/`
- Access helpers: `apps/cms/src/lib/access/`
- Hooks: `apps/cms/src/lib/collections/[Collection]/hooks/`
- Shared hooks: `apps/cms/src/lib/hooks/`
- Blocks: `apps/cms/src/lib/blocks/`

## Common Tasks

### Creating a New Collection

1. Create collection directory: `collections/MyCollection/`
2. Create `index.ts` with collection config
3. Add access control helpers if needed
4. Add hooks if needed
5. Import and add to `revealui.config.ts` collections array

### Adding Hooks to Existing Collection

1. Create hook file: `hooks/beforeChange.ts` (or appropriate hook)
2. Implement hook function with correct type
3. Import hook in collection `index.ts`
4. Add to `hooks` object: `hooks: { beforeChange: [myHook] }`

### Setting Up Access Control

1. Determine access requirements
2. Import appropriate helpers from `@/lib/access`
3. Apply to collection-level `access` object
4. Add field-level `access` if needed

## Real Examples from Codebase

### Products Collection

Location: `apps/cms/src/lib/collections/Products/index.ts`

- Uses `beforeChange` hook to validate Stripe product
- Uses `afterChange` hook for revalidation
- Uses `afterRead` hook to populate archive block
- Uses `afterDelete` hook to clean up carts

### Users Collection

Location: `apps/cms/src/lib/collections/Users/index.ts`

- Field-level access for password (never readable)
- Role-based access with `isSuperAdmin`
- Tenant-scoped access with `isTenantAdminOrSuperAdmin`
- `afterChange` hook for login after create
- `afterLogin` hook to record tenant

## Integration with Other Agents

- **TypeScript Agent** - For type-safe collection configs
- **Next.js Agent** - For API routes and pages using collections
- **Testing Agent** - For testing collections and hooks
