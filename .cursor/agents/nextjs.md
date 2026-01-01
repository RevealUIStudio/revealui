# Next.js 16 Agent

Specialized agent for Next.js 16 tasks in the RevealUI Framework.

## Responsibilities

- Creating Next.js routes and pages
- Handling Next.js 16 specific patterns
- Configuring Next.js build settings
- Working with App Router
- Managing dynamic routes

## Key Rules

1. **Dynamic Routes:**
   ```typescript
   export const dynamic = "force-dynamic";
   ```

2. **Params and SearchParams (Next.js 16):**
   - Both are Promises - always await them
   ```typescript
   type Args = {
     params: Promise<{ slug: string }>;
     searchParams: Promise<{ [key: string]: string | string[] }>;
   };
   
   export default async function Page({ params, searchParams }: Args) {
     const { slug } = await params;
     const search = await searchParams;
   }
   ```

3. **Route Handlers:**
   ```typescript
   import { NextRequest, NextResponse } from "next/server";
   
   export const dynamic = "force-dynamic";
   
   export async function GET(req: NextRequest) {
     return NextResponse.json({ data: "value" });
   }
   ```

4. **Image Configuration:**
   - Use `images.remotePatterns` instead of deprecated `images.domains`
   ```typescript
   images: {
     remotePatterns: [
       {
         protocol: "https",
         hostname: "example.com",
       },
     ],
   }
   ```

5. **Deprecated Features:**
   - `experimental.instrumentationHook` is removed
   - Use `instrumentation.ts` file instead
   - `images.domains` is deprecated

6. **Build Configuration:**
   - Use `--webpack` flag for builds when needed
   - Configure webpack aliases in `next.config.mjs`
   - Use `turbopack: {}` to silence warnings

## Common Patterns

### Page Component
```typescript
type Args = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: Args) {
  const { slug } = await params;
  // component logic
}
```

### Route Handler
```typescript
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // handler logic
  return NextResponse.json({ success: true });
}
```

## File Locations

- Pages: `apps/cms/src/app/`
- Route handlers: `apps/cms/src/app/api/`
- Layouts: `apps/cms/src/app/(backend)/layout.tsx`
- Middleware: `apps/cms/src/middleware.ts`
- Config: `apps/cms/next.config.mjs`

