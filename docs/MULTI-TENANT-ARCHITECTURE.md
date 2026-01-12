---
alwaysApply: true
---

# Multi-Tenant Architecture Documentation

## Overview

RevealUI Framework implements a robust multi-tenant architecture using RevealUI CMS 3.x, allowing multiple organizations (tenants) to share the same application instance while maintaining complete data isolation.

---

## Architecture Overview

### Tenant Model

```typescript
Tenants Collection {
  id: number
  name: string
  url: string
  // ... other fields
}
```

### User-Tenant Relationship

Users can be associated with multiple tenants, each with different roles:

```typescript
User {
  id: number
  email: string
  roles: ["user-super-admin" | "user-admin"]  // System-level roles
  tenants: [
    {
      tenant: Tenant (relationship)
      roles: ["tenant-super-admin" | "tenant-admin"]  // Tenant-specific roles
    }
  ]
  lastLoggedInTenant: Tenant (relationship)
}
```

---

## Role Hierarchy

### System-Level Roles

1. **User Super Admin** (`user-super-admin`)
   - Full system access across all tenants
   - Can manage all users and tenants
   - Can assign roles to other users
   - Highest privilege level

2. **User Admin** (`user-admin`)
   - System administration capabilities
   - Can manage users within assigned scope
   - Cannot modify super admin roles

### Tenant-Level Roles

3. **Tenant Super Admin** (`tenant-super-admin`)
   - Full access within their tenant(s)
   - Can manage tenant users and data
   - Cannot access other tenants' data

4. **Tenant Admin** (`tenant-admin`)
   - Administrative access within tenant
   - Limited user management
   - Cannot modify super admin settings

---

## Access Control Implementation

### Collection-Level Access

All collections implement tenant-aware access control:

```typescript
// Example: Pages Collection
{
  access: {
    create: authenticated,           // Must be logged in
    delete: authenticated,
    read: authenticatedOrPublished,  // Public can read published
    update: authenticated,
  }
}
```

### Access Control Functions

Located in `apps/cms/src/lib/access/`:

- `isAdmin.ts` - Checks for user-admin or user-super-admin
- `isSuperAdmin.ts` - Checks for user-super-admin only
- `isTenantAdminOrSuperAdmin.ts` - Checks tenant-level admin roles
- `checkTenantAccess.ts` - Verifies user has access to specific tenant
- `lastLoggedInTenant.ts` - Returns user's most recent tenant context

---

## Data Isolation

### Automatic Tenant Filtering

RevealUI CMS hooks automatically filter data by tenant:

```typescript
// All queries are scoped to user's current tenant
const pages = await revealui.find({
  collection: 'pages',
  // Tenant filter applied automatically via hooks
})
```

### Last Logged-In Tenant

The system tracks which tenant a user most recently accessed:

```typescript
User.lastLoggedInTenant -> Tenant

// Updated automatically on login
hooks: {
  afterLogin: [recordLastLoggedInTenant]
}
```

This ensures users see the correct tenant's data by default.

---

## Security Considerations

### Tenant Isolation Guarantees

1. **Database Level**: Queries filtered by tenant relationship
2. **API Level**: Access control validates tenant membership
3. **UI Level**: Admin panel shows only current tenant's data

### Testing Tenant Isolation

**CRITICAL**: Always test that:
- Users cannot access other tenants' records
- Cross-tenant relationships are prevented
- Tenant switching properly updates context
- Super admins can access all tenants (by design)

See `apps/cms/src/__tests__/auth/access-control.test.ts` for test examples.

---

## Tenant Switching

### Implementation

Users with multiple tenant associations can switch between tenants:

1. User logs in
2. System loads `lastLoggedInTenant`
3. All queries filtered to that tenant
4. User can switch tenant in admin UI
5. `lastLoggedInTenant` updates
6. UI refreshes with new tenant data

### Hooks

```typescript
// Located in apps/cms/src/lib/hooks/

recordLastLoggedInTenant.ts   // Updates tenant on login
checkTenantAccess.ts          // Validates tenant membership
```

---

## Admin UI Considerations

### Tenant Context Display

The admin panel should clearly display:
- Current tenant name
- User's role within tenant
- Tenant switcher (for multi-tenant users)

### Custom Components

Located in `apps/cms/src/lib/components/`:
- May include tenant-specific UI elements
- Filtered selects for cross-tenant references
- Tenant-aware dashboards

---

## API Endpoints

### Tenant-Aware Endpoints

All RevealUI CMS auto-generated endpoints (`/api/:collection`) are tenant-aware:

```
GET    /api/pages        # Returns current tenant's pages only
POST   /api/pages        # Creates page in current tenant
GET    /api/pages/:id    # Returns page if user has tenant access
PATCH  /api/pages/:id    # Updates if user has permission
DELETE /api/pages/:id    # Deletes if user has permission
```

### Custom Endpoints

Custom endpoints should manually check tenant access:

```typescript
import { checkTenantAccess } from "@/lib/access/tenants/checkTenantAccess"

export async function GET(req: RevealRequest) {
  const revealui = await getRevealUI({ config: config })
  const user = req.user
  
  // Verify tenant access
  const hasAccess = await checkTenantAccess({ req })
  if (!hasAccess) {
    return new Response("Forbidden", { status: 403 })
  }
  
  // Proceed with logic...
}
```

---

## Best Practices

### 1. Always Validate Tenant Access

Never assume tenant access. Always validate:

```typescript
// ✅ GOOD
const hasAccess = await checkTenantAccess({ req })
if (!hasAccess) return { status: 403 }

// ❌ BAD
// Assuming user has access without checking
```

### 2. Use Tenant-Scoped Queries

Filter by tenant in all custom queries:

```typescript
// ✅ GOOD
const data = await revealui.find({
  collection: 'products',
  where: {
    tenant: {
      equals: user.lastLoggedInTenant,
    },
  },
})

// ❌ BAD
// Fetching all products without tenant filter
```

### 3. Test Tenant Isolation

Always include tests for:
- Cross-tenant data access prevention
- Tenant switching functionality
- Role inheritance and permissions

---

## Migration Guide

### Adding Tenant Support to New Collections

1. Add tenant relationship field:

```typescript
{
  name: 'tenant',
  type: 'relationship',
  relationTo: 'tenants',
  required: true,
  admin: {
    position: 'sidebar',
  },
}
```

2. Update access control:

```typescript
import { checkTenantAccess } from '@/access/tenants/checkTenantAccess'

access: {
  read: checkTenantAccess,
  create: checkTenantAccess,
  update: checkTenantAccess,
  delete: checkTenantAccess,
}
```

3. Add hooks to auto-populate tenant:

```typescript
hooks: {
  beforeChange: [(args) => {
    if (!args.data.tenant && args.req.user) {
      args.data.tenant = args.req.user.lastLoggedInTenant
    }
    return args.data
  }],
}
```

---

## Troubleshooting

### Common Issues

**Issue**: Users see data from wrong tenant
- **Solution**: Check `lastLoggedInTenant` is set correctly
- **Verify**: `recordLastLoggedInTenant` hook is active

**Issue**: Super admins can't access all tenants
- **Solution**: Verify super admin checks in access control
- **Check**: `isSuperAdmin` function implementation

**Issue**: Cross-tenant relationships created
- **Solution**: Add validation hooks to prevent
- **Implement**: Tenant matching in relationship validators

---

## Resources

- Access Control: `apps/cms/src/lib/access/`
- Collections: `apps/cms/src/lib/collections/`
- Hooks: `apps/cms/src/lib/hooks/`
- Tests: `apps/cms/src/__tests__/auth/access-control.test.ts`

---

**Last Updated**: January 16, 2025  
**Maintainer**: RevealUI Team

