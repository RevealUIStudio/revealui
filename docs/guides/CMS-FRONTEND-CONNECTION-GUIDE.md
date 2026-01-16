# CMS to Frontend Connection Guide

This guide explains where and how to connect your RevealUI CMS to your frontend web application.

## Overview

Your project has:
- **CMS App** (`apps/cms`): Next.js 16 app with RevealUI CMS backend
- **Frontend App** (`apps/web`): React 19 app (Vite-based) that needs to consume CMS data

## 1. CMS API Endpoints

### REST API Route
The CMS exposes a REST API at:
- **Route**: `/api/[...slug]/route.ts`
- **Location**: `apps/cms/src/app/(backend)/api/[...slug]/route.ts`
- **Handler**: Uses `handleRESTRequest` from `@revealui/core/api/rest`

### Available API Endpoints

#### Collections API
```
GET    /api/collections/{collection}           - List all documents
GET    /api/collections/{collection}/{id}       - Get single document
POST   /api/collections/{collection}            - Create document
PATCH  /api/collections/{collection}/{id}        - Update document
DELETE /api/collections/{collection}/{id}       - Delete document
```

#### Globals API
```
GET    /api/globals/{global}                    - Get global
PATCH  /api/globals/{global}                    - Update global
```

### Available Collections (from `revealui.config.ts`)
- `pages` - Page content
- `posts` - Blog posts
- `heros` - Hero sections
- `cards` - Card components
- `contents` - Content blocks
- `videos` - Video media
- `media` - General media
- `events` - Events
- `products` - Products
- `prices` - Pricing
- `categories` - Categories
- `tags` - Tags
- `layouts` - Layouts
- `banners` - Banners
- `users` - Users
- `tenants` - Tenants
- `orders` - Orders
- `subscriptions` - Subscriptions

### Query Parameters
- `depth` - Relationship depth (e.g., `?depth=2`)
- `where` - Filter conditions (JSON)
- `limit` - Results per page
- `page` - Page number
- `sort` - Sort field
- `locale` - Locale for i18n

## 2. Frontend Fetch Functions (MISSING - Need to Create)

Your frontend components are trying to import fetch functions that don't exist yet:

### Missing Functions
- `revealui/core/targets/http/fetchMainInfos` - Used in `apps/web/src/components/Home/Main.tsx`
- `revealui/core/targets/http/fetchVideos` - Used in `apps/web/src/components/Home/Header.tsx`
- `revealui/core/targets/http/fetchCard` - Used in `apps/web/src/components/Home/Card.tsx`
- `revealui/core/targets/http/fetchHero` - Used in `apps/web/src/components/Home/Hero.tsx`

### Where to Create Them
You need to create these in a package that your frontend can import from. Options:

1. **Create in `packages/reveal`** (if it exists) or create a new package
2. **Create in `apps/web/src/lib/api/`** (local to web app)
3. **Create in a shared utilities package**

## 3. Environment Configuration

### CMS App Environment Variables
The CMS needs these variables (in `apps/cms/.env.local` or similar):
```env
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000  # CMS URL
REVEALUI_SECRET=your-secret-key
NEXT_PUBLIC_SERVER_URL=http://localhost:4000       # Public CMS URL
```

### Frontend App Environment Variables
The frontend needs the CMS URL (in `apps/web/.env.local`):
```env
NEXT_PUBLIC_CMS_URL=http://localhost:4000          # CMS API URL
# OR
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
```

### CORS Configuration
The CMS has CORS handling in:
- `apps/cms/src/proxy.ts` - Defines allowed origins
- `apps/cms/revealui.config.ts` - `cors` and `csrf` arrays

Make sure your frontend URL is in:
```env
REVEALUI_WHITELISTORIGINS=http://localhost:3000,http://localhost:5173
```

## 4. Step-by-Step Connection Plan

### Step 1: Configure Environment Variables

1. **In `apps/cms/.env.local`**:
   ```env
   REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
   NEXT_PUBLIC_SERVER_URL=http://localhost:4000
   REVEALUI_WHITELISTORIGINS=http://localhost:3000,http://localhost:5173
   ```

2. **In `apps/web/.env.local`**:
   ```env
   NEXT_PUBLIC_CMS_URL=http://localhost:4000
   # Or use REVEALUI_PUBLIC_SERVER_URL if that's the convention
   ```

### Step 2: Create API Client Utility

Create a base API client function in your frontend app:

**File**: `apps/web/src/lib/api/client.ts`
```typescript
const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL || process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:4000';

export async function fetchFromCMS<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${CMS_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`CMS API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

### Step 3: Create Fetch Functions

Create the missing fetch functions. Based on your components:

**File**: `apps/web/src/lib/api/fetchMainInfos.ts`
```typescript
import { fetchFromCMS } from './client';

export interface MainInfo {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
}

export default async function fetchMainInfos(): Promise<MainInfo[]> {
  const response = await fetchFromCMS<{
    docs: MainInfo[];
    totalDocs: number;
  }>('/api/collections/contents?where[type][equals]=main-info&depth=1');

  return response.docs || [];
}
```

**File**: `apps/web/src/lib/api/fetchVideos.ts`
```typescript
import { fetchFromCMS } from './client';

export interface Video {
  url: string;
}

export default async function fetchVideos(): Promise<Video[]> {
  const response = await fetchFromCMS<{
    docs: Array<{ url?: string; file?: { url?: string } }>;
  }>('/api/collections/videos?depth=1');

  return response.docs.map((doc) => ({
    url: doc.url || doc.file?.url || '',
  })).filter((v) => v.url);
}
```

**File**: `apps/web/src/lib/api/fetchCard.ts`
```typescript
import { fetchFromCMS } from './client';

export interface CardData {
  name: string;
  image: string;
  label: string;
  cta: string;
  href: string;
  loading?: 'eager' | 'lazy';
}

export default async function fetchCard(): Promise<CardData[]> {
  const response = await fetchFromCMS<{
    docs: CardData[];
  }>('/api/collections/cards?depth=1');

  return response.docs || [];
}
```

**File**: `apps/web/src/lib/api/fetchHero.ts`
```typescript
import { fetchFromCMS } from './client';

export interface HeroData {
  id: number;
  image: string;
  videos: string;
  altText: string;
  href: string;
}

export default async function fetchHero(): Promise<HeroData[]> {
  const response = await fetchFromCMS<{
    docs: HeroData[];
  }>('/api/collections/heros?depth=1');

  return response.docs || [];
}
```

### Step 4: Update Component Imports

Update your components to import from the new location:

**In `apps/web/src/components/Home/Main.tsx`**:
```typescript
// Change from:
import fetchMainInfos from "revealui/core/targets/http/fetchMainInfos";
// To:
import fetchMainInfos from "@/lib/api/fetchMainInfos";
// Or if using relative paths:
import fetchMainInfos from "../../lib/api/fetchMainInfos";
```

Do the same for:
- `apps/web/src/components/Home/Header.tsx`
- `apps/web/src/components/Home/Card.tsx`
- `apps/web/src/components/Home/Hero.tsx`

### Step 5: Test the Connection

1. Start the CMS: `cd apps/cms && pnpm dev` (should run on port 4000)
2. Start the frontend: `cd apps/web && pnpm dev` (should run on port 5173 or 3000)
3. Check browser console for API errors
4. Verify data is loading in components

## 5. Key Files to Modify

### CMS Side (Already Configured)
- ✅ `apps/cms/src/app/(backend)/api/[...slug]/route.ts` - API route handler
- ✅ `apps/cms/revealui.config.ts` - Collections configuration
- ⚠️ `apps/cms/src/proxy.ts` - CORS configuration (verify frontend URL is allowed)

### Frontend Side (Need to Create/Modify)
- ❌ `apps/web/src/lib/api/client.ts` - **CREATE** Base API client
- ❌ `apps/web/src/lib/api/fetchMainInfos.ts` - **CREATE** Fetch function
- ❌ `apps/web/src/lib/api/fetchVideos.ts` - **CREATE** Fetch function
- ❌ `apps/web/src/lib/api/fetchCard.ts` - **CREATE** Fetch function
- ❌ `apps/web/src/lib/api/fetchHero.ts` - **CREATE** Fetch function
- ⚠️ `apps/web/src/components/Home/*.tsx` - **UPDATE** Import paths
- ⚠️ `apps/web/.env.local` - **CREATE** Environment variables

## 6. Testing API Endpoints

You can test the CMS API directly:

```bash
# Get all pages
curl http://localhost:4000/api/collections/pages

# Get a specific page
curl http://localhost:4000/api/collections/pages/{id}

# Get with filters
curl "http://localhost:4000/api/collections/posts?where[status][equals]=published&limit=10"

# Get with depth (relationships)
curl "http://localhost:4000/api/collections/pages?depth=2"
```

## 7. Common Issues & Solutions

### CORS Errors
**Problem**: Frontend can't access CMS API
**Solution**: Add frontend URL to `REVEALUI_WHITELISTORIGINS` in CMS `.env`

### 404 Errors
**Problem**: Collection not found
**Solution**: Check collection slug matches exactly (case-sensitive)

### Empty Results
**Problem**: API returns empty `docs` array
**Solution**: 
- Check if data exists in CMS admin
- Verify collection access permissions
- Check `where` filters are correct

### Type Mismatches
**Problem**: TypeScript errors in fetch functions
**Solution**: Match the actual CMS collection schema structure

## 8. Next Steps

1. **Create the API client and fetch functions** (Step 2-3)
2. **Update component imports** (Step 4)
3. **Configure environment variables** (Step 1)
4. **Test the connection** (Step 5)
5. **Add error handling** - Consider adding retry logic, error boundaries
6. **Add caching** - Consider React Query or SWR for data fetching
7. **Add TypeScript types** - Generate types from CMS schema if available

## 9. Alternative: Use a Shared Package

If you want to share the fetch functions across multiple apps, consider:

1. Create `packages/api-client` package
2. Move fetch functions there
3. Export from package
4. Import in both CMS and Web apps

This would allow:
- Shared TypeScript types
- Reusable API utilities
- Consistent error handling

## Related Documentation

- [CMS Content Examples](./CMS-CONTENT-EXAMPLES.md) - Ready-to-use content
- [CMS Content Recommendations](./CMS-CONTENT-RECOMMENDATIONS.md) - Content best practices
- [Blog Creation Guide](./BLOG-CREATION-GUIDE.md) - Create blog posts
- [API Docs Guide](../development/API-DOCS-GUIDE.md) - API documentation
- [Developer Quick Start](./QUICK_START.md) - Setup guide
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task
- [Keywords Index](../KEYWORDS.md) - Search by keyword
