# CMS Tools Package

AI-powered tools for managing RevealUI CMS through natural language.

## Overview

This package provides a complete set of tools that allow AI agents to perform CMS operations like creating content, updating globals, managing media, and handling users - all through conversational interfaces.

## Features

- **Collection Management**: Create, read, update, delete documents
- **Global Management**: Update site-wide settings (Header, Footer, Settings)
- **Media Management**: Upload, list, update, delete media files
- **User Management**: Create, update, list users

## Quick Start

### 1. Create CMS Tools with API Client

```typescript
import { createCMSTools } from '@revealui/ai/tools/cms'
import { apiClient } from '@revealui/core/admin/utils/apiClient'
import config from './revealui.config'

// Create functional tools with API client injected
const cmsTools = createCMSTools({
  apiClient,
  collections: config.collections,
  globals: config.globals,
  user: {
    id: 'user-id',
    email: 'user@example.com',
    role: 'admin'
  }
})
```

### 2. Register Tools with Tool Registry

```typescript
import { globalToolRegistry } from '@revealui/ai/tools/registry'

// Register all CMS tools
cmsTools.forEach(tool => {
  globalToolRegistry.register(tool)
})
```

### 3. Use in Chat API

```typescript
// In your /api/chat route
import { createLLMClientFromEnv } from '@revealui/ai/llm/server'

const llmClient = createLLMClientFromEnv()
const toolDefinitions = globalToolRegistry.getToolDefinitions()

const response = await llmClient.chat(
  messages,
  {
    tools: toolDefinitions,  // Enable CMS tools
    maxTokens: 1000
  }
)

// Handle tool calls
if (response.tool_calls) {
  for (const toolCall of response.tool_calls) {
    const result = await globalToolRegistry.execute(
      toolCall.function.name,
      toolCall.function.arguments
    )
    // Add result to conversation
  }
}
```

## Available Tools

### Collection Tools

#### `list_collections`
Get all available collections.
```json
{
  "name": "list_collections",
  "parameters": {}
}
```

#### `find_documents`
Search for documents in a collection.
```json
{
  "name": "find_documents",
  "parameters": {
    "collection": "pages",
    "page": 1,
    "limit": 10,
    "where": { "status": "published" },
    "sort": "-createdAt"
  }
}
```

#### `get_document`
Get a specific document by ID.
```json
{
  "name": "get_document",
  "parameters": {
    "collection": "pages",
    "id": "page-id-123"
  }
}
```

#### `create_document`
Create a new document.
```json
{
  "name": "create_document",
  "parameters": {
    "collection": "pages",
    "data": {
      "title": "About Us",
      "slug": "about",
      "content": "Welcome to our site..."
    }
  }
}
```

#### `update_document`
Update an existing document.
```json
{
  "name": "update_document",
  "parameters": {
    "collection": "pages",
    "id": "page-id-123",
    "data": {
      "title": "Updated Title"
    }
  }
}
```

#### `delete_document`
Delete a document.
```json
{
  "name": "delete_document",
  "parameters": {
    "collection": "pages",
    "id": "page-id-123"
  }
}
```

### Global Tools

#### `list_globals`
Get all available globals.
```json
{
  "name": "list_globals",
  "parameters": {}
}
```

#### `get_global`
Get current global configuration.
```json
{
  "name": "get_global",
  "parameters": {
    "slug": "header",
    "depth": 0
  }
}
```

#### `update_global`
Update a global configuration.
```json
{
  "name": "update_global",
  "parameters": {
    "slug": "header",
    "data": {
      "navItems": [
        {
          "link": {
            "type": "custom",
            "label": "Home",
            "url": "/"
          }
        },
        {
          "link": {
            "type": "custom",
            "label": "About",
            "url": "/about"
          }
        }
      ]
    }
  }
}
```

### Media Tools

#### `list_media`
Browse media library.
```json
{
  "name": "list_media",
  "parameters": {
    "page": 1,
    "limit": 10,
    "mimeType": "image/jpeg"
  }
}
```

#### `get_media`
Get media file details.
```json
{
  "name": "get_media",
  "parameters": {
    "id": "media-id-123"
  }
}
```

#### `upload_media`
Upload a new media file.
```json
{
  "name": "upload_media",
  "parameters": {
    "filename": "logo.png",
    "mimeType": "image/png",
    "data": "data:image/png;base64,...",
    "alt": "Company logo"
  }
}
```

#### `update_media`
Update media metadata.
```json
{
  "name": "update_media",
  "parameters": {
    "id": "media-id-123",
    "alt": "Updated alt text",
    "title": "New title"
  }
}
```

#### `delete_media`
Delete a media file.
```json
{
  "name": "delete_media",
  "parameters": {
    "id": "media-id-123"
  }
}
```

### User Tools

#### `get_current_user`
Get current logged-in user.
```json
{
  "name": "get_current_user",
  "parameters": {}
}
```

#### `list_users`
Get all users (admin only).
```json
{
  "name": "list_users",
  "parameters": {
    "page": 1,
    "limit": 10,
    "role": "admin"
  }
}
```

#### `create_user`
Create a new user.
```json
{
  "name": "create_user",
  "parameters": {
    "email": "newuser@example.com",
    "password": "securepass123",
    "name": "New User",
    "role": "editor"
  }
}
```

#### `update_user`
Update user account.
```json
{
  "name": "update_user",
  "parameters": {
    "id": "user-id-123",
    "name": "Updated Name",
    "role": "admin"
  }
}
```

#### `delete_user`
Delete a user account.
```json
{
  "name": "delete_user",
  "parameters": {
    "id": "user-id-123"
  }
}
```

## Conversational Examples

### Creating Content
**User:** "Create a new blog post titled 'Getting Started' about our platform"

**Agent Uses:**
```typescript
create_document({
  collection: "posts",
  data: {
    title: "Getting Started",
    content: "Welcome to our platform...",
    status: "draft"
  }
})
```

### Updating Navigation
**User:** "Add a Pricing link to the header navigation"

**Agent Uses:**
```typescript
// First, get current header
get_global({ slug: "header" })

// Then update with new nav item
update_global({
  slug: "header",
  data: {
    navItems: [
      ...existingItems,
      {
        link: {
          type: "custom",
          label: "Pricing",
          url: "/pricing"
        }
      }
    ]
  }
})
```

### Managing Media
**User:** "Upload this image as our new logo"

**Agent Uses:**
```typescript
upload_media({
  filename: "new-logo.png",
  mimeType: "image/png",
  data: "base64-encoded-image-data",
  alt: "Company logo"
})
```

## Architecture

```
packages/ai/src/tools/cms/
├── collection-tools.ts   # Document CRUD operations
├── global-tools.ts       # Global settings management
├── media-tools.ts        # Media file operations
├── user-tools.ts         # User management
├── factory.ts            # Tool creation with API injection
├── index.ts              # Public exports
└── README.md             # This file
```

## Integration with Chat API

See the main documentation for complete chat API integration examples.

## Security Considerations

1. **Authentication**: Tools use the API client which requires valid auth tokens
2. **Authorization**: Operations are subject to user permissions
3. **Validation**: All parameters are validated using Zod schemas
4. **Rate Limiting**: API requests are subject to rate limiting

## Future Enhancements

- [ ] Batch operations (bulk create/update/delete)
- [ ] Advanced search with filters
- [ ] Workflow management (draft/publish)
- [ ] Version control
- [ ] Asset optimization for media uploads
- [ ] Permission checking at tool level
