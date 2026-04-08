# Collections

Collections are the core content abstraction in RevealUI. A collection defines a schema, access control rules, and lifecycle hooks for a type of content (posts, products, users, pages, etc.). Collections are stored in NeonDB via Drizzle ORM and exposed through the REST API.

**Package:** `@revealui/core`

---

## Overview

RevealUI ships with built-in collections for common content types:

| Collection | Purpose |
|------------|---------|
| Posts | Blog posts, articles |
| Pages | Static pages |
| Media | Images, documents, files |
| Products | Product catalog |
| Prices | Pricing tiers and plans |
| Categories | Content categorization |
| Tags | Content tagging |
| Orders | Purchase records |
| Users | User accounts |
| Tenants | Multi-tenant workspaces |

You can extend built-in collections or define entirely new ones.

---

## Defining a Collection

Collections are defined using the `RevealCollectionConfig` type from `@revealui/core`. Each collection specifies its slug, fields, access control, and hooks.

```ts
import type { RevealCollectionConfig } from '@revealui/core';

const Posts: RevealCollectionConfig = {
  slug: 'posts',
  labels: {
    singular: 'Post',
    plural: 'Posts',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'createdAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        condition: (data) => data?.status === 'published',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
    },
  ],
};

export default Posts;
```

---

## Field Types

RevealUI supports these field types, with schemas defined in `@revealui/contracts`:

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line string | Title, slug, name |
| `textarea` | Multi-line string | Description, excerpt |
| `number` | Numeric value | Price, quantity, sort order |
| `email` | Validated email address | Contact email |
| `richText` | Lexical rich text editor | Body content |
| `select` | Dropdown with predefined options | Status, category |
| `radio` | Radio button group | Priority level |
| `checkbox` | Boolean toggle | Featured, active |
| `date` | Date/datetime picker | Published date, expiry |
| `upload` | File upload (Vercel Blob) | Image, document |
| `relationship` | Reference to another collection | Author, categories |
| `array` | Repeatable group of fields | Gallery items, FAQ entries |
| `group` | Named group of fields | SEO metadata, address |
| `row` | Horizontal layout group | First name + last name |
| `json` | Arbitrary JSON data | Configuration, metadata |

### Field Options

Every field supports these common options:

```ts
{
  name: 'fieldName',        // Required: unique within the collection
  type: 'text',             // Required: one of the types above
  required: true,           // Validation: must have a value
  unique: true,             // Validation: no duplicates
  defaultValue: 'draft',    // Initial value for new documents
  label: 'Display Name',    // Admin UI label (defaults to name)
  admin: {
    position: 'sidebar',    // 'sidebar' or 'main' (default)
    hidden: false,          // Hide from admin UI
    readOnly: false,        // Disable editing in admin
    condition: (data) => data?.status === 'published',  // Conditional visibility
  },
  hooks: {
    beforeChange: [],       // Run before field value is saved
    afterChange: [],        // Run after field value is saved
  },
  validate: (value) => {    // Custom validation
    if (value && value.length > 100) {
      return 'Must be 100 characters or fewer';
    }
    return true;
  },
}
```

---

## Access Control

Access control functions receive the request context and return a boolean or a query constraint. They run on every CRUD operation.

### Boolean Access

```ts
const access = {
  // Anyone can read
  read: () => true,

  // Only authenticated users can create
  create: ({ req }) => Boolean(req.user),

  // Only admins can update
  update: ({ req }) => req.user?.role === 'admin',

  // Only admins can delete
  delete: ({ req }) => req.user?.role === 'admin',
};
```

### Query-Based Access

Return a query constraint to filter results based on the user. This is more efficient than boolean checks because it runs at the database level.

```ts
const access = {
  // Users can only read their own documents
  read: ({ req }) => {
    if (req.user?.role === 'admin') return true;
    return {
      author: { equals: req.user?.id },
    };
  },
};
```

### Field-Level Access

Individual fields can have their own access control:

```ts
{
  name: 'internalNotes',
  type: 'textarea',
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
  },
}
```

---

## Hooks

Hooks let you run logic at specific points in the document lifecycle. They execute on both API requests and admin UI operations.

### Collection Hooks

```ts
const Posts: RevealCollectionConfig = {
  slug: 'posts',
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // Set publishedAt when status changes to published
        if (operation === 'create' || operation === 'update') {
          if (data.status === 'published' && !data.publishedAt) {
            data.publishedAt = new Date().toISOString();
          }
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc, operation }) => {
        if (operation === 'create') {
          // Send notification, update search index, etc.
        }
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        // Prevent deletion of the homepage
        const doc = await req.revealui.findByID({
          collection: 'pages',
          id,
        });
        if (doc?.slug === 'home') {
          throw new Error('Cannot delete the homepage');
        }
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        // Clean up related resources
      },
    ],
  },
  fields: [/* ... */],
};
```

### Field Hooks

Field-level hooks run for individual fields during save operations:

```ts
{
  name: 'slug',
  type: 'text',
  hooks: {
    beforeChange: [
      async ({ value, data }) => {
        // Auto-generate slug from title if not provided
        if (!value && data?.title) {
          return data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        }
        return value;
      },
    ],
  },
}
```

### Hook Execution Order

1. Field `beforeChange` hooks (each field, in order)
2. Collection `beforeChange` hooks
3. Database write
4. Collection `afterChange` hooks
5. Field `afterChange` hooks

---

## CRUD Operations

Once registered, collections are available through the `RevealUICollection` class and the REST API.

### Programmatic Access

```ts
import { RevealUICollection } from '@revealui/core';

const posts = new RevealUICollection(postsConfig, db);

// Find all published posts
const result = await posts.find({
  where: { status: { equals: 'published' } },
  sort: '-publishedAt',
  limit: 10,
  page: 1,
});

// Find a single post by ID
const post = await posts.findByID({
  id: 'abc123',
  depth: 1, // Populate relationships one level deep
});

// Create a new post
const newPost = await posts.create({
  data: {
    title: 'Getting Started with RevealUI',
    status: 'draft',
    content: { /* Lexical rich text data */ },
  },
  req: request,
});

// Update a post
const updated = await posts.update({
  id: 'abc123',
  data: { status: 'published' },
  req: request,
});

// Delete a post
const deleted = await posts.delete({
  id: 'abc123',
  req: request,
});
```

### REST API

Collections are automatically exposed via the Hono REST API:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/<collection>` | List documents (paginated) |
| GET | `/api/<collection>/:id` | Get single document |
| POST | `/api/<collection>` | Create document |
| PATCH | `/api/<collection>/:id` | Update document |
| DELETE | `/api/<collection>/:id` | Delete document |

Query parameters for list endpoints:

```
GET /api/posts?where[status][equals]=published&sort=-publishedAt&limit=10&page=1&depth=1
```

---

## Relationship Population

Use the `depth` parameter to control how deeply relationships are populated in query results.

```ts
// depth: 0 — relationships return IDs only
{ author: 'user-abc123' }

// depth: 1 — relationships are populated one level
{ author: { id: 'user-abc123', name: 'Jane Doe', email: 'jane@example.com' } }

// depth: 2 — nested relationships are also populated
{ author: { id: 'user-abc123', posts: [{ id: 'post-1', title: '...' }] } }
```

Higher depth values increase query complexity. Use the minimum depth your use case requires.

---

## Registering Collections

Collections are registered in the RevealUI configuration:

```ts
import { buildConfig } from '@revealui/core';
import Posts from './collections/Posts';
import Pages from './collections/Pages';
import Products from './collections/Products';
import Users from './collections/Users';

export default buildConfig({
  serverURL: process.env.REVEALUI_PUBLIC_SERVER_URL,
  collections: [Posts, Pages, Products, Users],
});
```

---

## Related Documentation

- [Admin Guide](../ADMIN_GUIDE.md) -- Full admin and content usage reference
- [Package Reference](../REFERENCE.md) -- Core package API
- [Database Guide](../DATABASE.md) -- Schema and Drizzle ORM patterns
