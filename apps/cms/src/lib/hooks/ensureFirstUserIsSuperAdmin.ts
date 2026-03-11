import type { RevealRequest, RevealUIInstance } from '@revealui/core';
import { Role } from '@/lib/access/permissions/roles';

interface RequestWithRevealUI extends RevealRequest {
  revealui?: RevealUIInstance;
}

// This hook operates on the roles field, which is an array of strings
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
      // Ensure 'super-admin' is added to the roles if not already included
      const currentRoles = value || [];
      if (!currentRoles.includes(Role.TenantSuperAdmin)) {
        return [...currentRoles, Role.TenantSuperAdmin];
      }
    }
  }

  return value;
}
