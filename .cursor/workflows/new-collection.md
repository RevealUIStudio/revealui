# New PayloadCMS Collection Workflow

Step-by-step guide for creating a new PayloadCMS collection.

## Steps

1. **Create Collection File**
   - Location: `apps/cms/src/lib/collections/YourCollection/index.ts`
   - Use `CollectionConfig` type from `payload`
   - Define slug, fields, and access control

2. **Configure Access Control**
   - Create access functions in `apps/cms/src/lib/access/`
   - Import and use in collection `access` property
   - Test with different user roles

3. **Add to Payload Config**
   - Import collection in `apps/cms/payload.config.ts`
   - Add to `collections` array
   - Ensure proper order (dependencies first)

4. **Create Types (Auto-generated)**
   - Run `pnpm generate:payload-types`
   - Types will be in `apps/cms/src/types/payload.ts`

5. **Add API Routes (if needed)**
   - Create route handler in `apps/cms/src/app/api/`
   - Mark as `export const dynamic = "force-dynamic"`
   - Use `getRevealUI` for development

6. **Test Collection**
   - Test in PayloadCMS admin panel
   - Verify access control works
   - Test API endpoints

## Template

```typescript
import { CollectionConfig } from "payload";
import { isAdmin, anyone } from "../../access";

export const YourCollection: CollectionConfig = {
  slug: "your-collection",
  timestamps: true,
  admin: {
    useAsTitle: "name",
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
  ],
};

export default YourCollection;
```

