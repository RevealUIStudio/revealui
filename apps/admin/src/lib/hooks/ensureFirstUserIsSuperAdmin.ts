import type { RevealRequest, RevealUIInstance } from '@revealui/core';
import { Role } from '@/lib/access/permissions/roles';

interface RequestWithRevealUI extends RevealRequest {
  revealui?: RevealUIInstance;
}

/**
 * First-user bootstrap hook.
 *
 * SECURITY NOTE: The very first user created in the system is automatically
 * promoted to super-admin. This means whoever creates the first account
 * gets full admin access. In production, the operator should:
 *
 * 1. Create the first account using REVEALUI_ADMIN_EMAIL / REVEALUI_ADMIN_PASSWORD env vars
 * 2. Verify the account has super-admin role in the dashboard
 * 3. Only then open registration to other users
 *
 * This hook ONLY runs on the 'create' operation for the roles field.
 * It does NOT affect subsequent users.
 */
export async function ensureFirstUserIsSuperAdmin({
  req,
  operation,
  value,
}: {
  req?: RequestWithRevealUI;
  operation?: string;
  value?: string[];
}): Promise<string[] | undefined> {
  if (operation === 'create' && req?.revealui) {
    // Fetch all users to check if any users exist
    const users = await req.revealui.find({
      collection: 'users',
      limit: 1, // limit to 1 to keep it as succinct as possible
      depth: 0,
    });

    // If no users found, this is the first user
    if (users.totalDocs === 0) {
      // Ensure the app-layer 'super-admin' role is present. This must be
      // Role.UserSuperAdmin ('super-admin') — the value the engine gates check
      // via isSuperAdmin/isAdmin. The previous Role.TenantSuperAdmin
      // ('tenant-super-admin') granted a role no gate reads, so the first user
      // was left without engine-level super-admin access.
      const currentRoles = value || [];
      if (!currentRoles.includes(Role.UserSuperAdmin)) {
        return [...currentRoles, Role.UserSuperAdmin];
      }
    }
  }

  return value;
}
