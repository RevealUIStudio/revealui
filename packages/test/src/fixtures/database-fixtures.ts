/**
 * Database fixture factories
 *
 * Provides factories for creating test database fixtures with relationships and multi-tenant support
 */

import type { RevealUIInstance } from '@revealui/core';
import type { RevealDataObject } from '@revealui/core/types';
import { createTestId } from '../utils/test-helpers.js';

/**
 * Create user fixture
 */
export async function createUserFixture(
  revealui: RevealUIInstance,
  overrides?: Partial<{
    email: string;
    password: string;
    roles: string[];
    tenantId: number;
    tenantRoles: string[];
  }>,
): Promise<{ id: string; email: string }> {
  const testId = createTestId('user');

  const userData: {
    email: string;
    password: string;
    roles: string[];
    tenants?: Array<{ tenant: number; roles: string[] }>;
  } = {
    email: overrides?.email || `user-${testId}@example.com`,
    password: overrides?.password || 'TestPassword123!',
    roles: overrides?.roles || ['admin'],
  };

  if (overrides?.tenantId && overrides?.tenantRoles) {
    userData.tenants = [
      {
        tenant: overrides.tenantId,
        roles: overrides.tenantRoles,
      },
    ];
  }

  const user = await revealui.create({
    collection: 'users',
    data: userData,
  });

  return {
    id: String(user.id),
    email: String(user.email),
  };
}

/**
 * Create tenant fixture
 */
export async function createTenantFixture(
  revealui: RevealUIInstance,
  overrides?: Partial<{
    name: string;
    domain: string;
  }>,
): Promise<{ id: number; name: string; domain: string }> {
  const testId = createTestId('tenant');

  // Note: This assumes a tenants collection exists
  // Adjust based on your actual schema
  const tenantData = {
    name: overrides?.name || `Test Tenant ${testId}`,
    domain: overrides?.domain || `tenant-${testId}.example.com`,
  };

  // If tenants collection exists, create it
  // Otherwise, return mock data
  try {
    const tenant = await revealui.create({
      collection: 'tenants',
      data: tenantData,
    });
    return {
      id: Number(tenant.id),
      name: String(tenant.name),
      domain: String(tenant.domain),
    };
  } catch {
    // Return mock if collection doesn't exist
    return {
      id: Date.now(),
      name: tenantData.name,
      domain: tenantData.domain,
    };
  }
}

/**
 * Create collection document fixture
 */
export async function createCollectionFixture(
  revealui: RevealUIInstance,
  collection: string,
  data: RevealDataObject,
): Promise<{ id: string }> {
  const doc = await revealui.create({
    collection,
    data,
  });

  return {
    id: String(doc.id),
  };
}

/**
 * Create relationship fixtures
 */
export async function createRelationshipFixtures(
  revealui: RevealUIInstance,
  options: {
    parentCollection: string;
    childCollection: string;
    relationshipField: string;
    parentData: RevealDataObject;
    childrenData: Array<RevealDataObject>;
  },
): Promise<{
  parent: { id: string };
  children: Array<{ id: string }>;
}> {
  // Create parent
  const parent = await revealui.create({
    collection: options.parentCollection,
    data: options.parentData,
  });

  // Create children with relationship
  const children = await Promise.all(
    options.childrenData.map((childData) =>
      revealui.create({
        collection: options.childCollection,
        data: {
          ...childData,
          [options.relationshipField]: parent.id,
        },
      }),
    ),
  );

  return {
    parent: { id: String(parent.id) },
    children: children.map((child: { id: unknown }) => ({ id: String(child.id) })),
  };
}

/**
 * Create multi-tenant fixtures
 */
export async function createMultiTenantFixtures(
  revealui: RevealUIInstance,
  options: {
    tenantCount: number;
    usersPerTenant: number;
  },
): Promise<{
  tenants: Array<{ id: number; name: string }>;
  users: Array<{ id: string; email: string; tenantId: number }>;
}> {
  const tenants: Array<{ id: number; name: string }> = [];
  const users: Array<{ id: string; email: string; tenantId: number }> = [];

  for (let i = 0; i < options.tenantCount; i++) {
    const tenant = await createTenantFixture(revealui, {
      name: `Tenant ${i + 1}`,
      domain: `tenant${i + 1}.example.com`,
    });
    tenants.push(tenant);

    for (let j = 0; j < options.usersPerTenant; j++) {
      const user = await createUserFixture(revealui, {
        tenantId: tenant.id,
        tenantRoles: ['admin'],
      });
      users.push({
        id: user.id,
        email: user.email,
        tenantId: tenant.id,
      });
    }
  }

  return { tenants, users };
}
