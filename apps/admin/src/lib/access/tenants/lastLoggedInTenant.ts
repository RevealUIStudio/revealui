import type { RevealRequest } from '@revealui/core';
import type { User } from '@revealui/core/types/cms';

export const lastLoggedInTenant = (req: RevealRequest): string | null => {
  const user = req?.user as User | undefined;

  if (!user) {
    return null;
  }

  // Check if lastLoggedInTenant is a number (tenant ID) or a Tenant object with an id
  const lastTenant = user.lastLoggedInTenant;

  if (typeof lastTenant === 'string') {
    return lastTenant;
  } else if (typeof lastTenant === 'number') {
    // If it's a number, return it as a string
    return lastTenant.toString();
  } else if (lastTenant && typeof lastTenant === 'object' && 'id' in lastTenant) {
    // If it's a Tenant object, return the id as a string (convert to string just in case)
    const tenantId = lastTenant.id;
    return tenantId != null ? String(tenantId) : null;
  }

  // If no valid tenant is found, return null
  return null;
};
