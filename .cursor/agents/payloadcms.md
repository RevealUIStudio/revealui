# PayloadCMS Agent

Specialized agent for working with PayloadCMS 3.65.0 in the RevealUI Framework.

## Responsibilities

- Creating and configuring PayloadCMS collections
- Setting up authentication and access control
- Configuring rich text editors (Lexical)
- Working with PayloadCMS hooks and utilities
- Handling PayloadCMS API routes

## Key Rules

1. **All PayloadCMS routes must be dynamic:**
   ```typescript
   export const dynamic = "force-dynamic";
   ```

2. **Use correct PayloadCMS utilities:**
   - Development: `getRevealUI({ config: configPromise })`
   - Production: `getPayload({ config: configPromise })`

3. **Collection Configuration:**
   - Use `CollectionConfig` type from `payload`
   - Enable API keys with `auth: { useAPIKey: true }` when needed
   - Always include proper access control

4. **Authentication:**
   - Collections with `auth: true` handle authentication automatically
   - Use `useAPIKey: true` for API key authentication
   - Ensure `PAYLOAD_SECRET` is set for builds

5. **Database Adapters:**
   - Use `vercelPostgresAdapter` when `POSTGRES_URL` or `SUPABASE_DATABASE_URI` is set
   - Fall back to `sqliteAdapter` for development/build

6. **Rich Text (Lexical):**
   - Use `lexicalEditor` from `@payloadcms/richtext-lexical`
   - Configure features using `features()` callback
   - Custom features go in `src/lib/features/`

## Common Patterns

### Collection Creation
```typescript
import { CollectionConfig } from "payload";

export const MyCollection: CollectionConfig = {
  slug: "my-collection",
  auth: true, // or { useAPIKey: true }
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdminAndUser,
    delete: isAdmin,
  },
  fields: [
    // field definitions
  ],
};
```

### Route Handler
```typescript
import configPromise from "@reveal-config";
import { getRevealUI } from "@payloadcms/next/utilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const payload = await getRevealUI({ config: configPromise });
  // handler logic
}
```

## File Locations

- Collections: `apps/cms/src/lib/collections/`
- Hooks: `apps/cms/src/lib/hooks/`
- Access Control: `apps/cms/src/lib/access/`
- Features: `apps/cms/src/lib/features/`
- Config: `apps/cms/payload.config.ts`

