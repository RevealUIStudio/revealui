/**
 * Mock RevealUI Types for Isolated Unit Testing
 *
 * These mocks allow tests to run without importing from apps/admin.
 * Use these for unit tests that need to validate type behavior
 * in isolation.
 *
 * @module @revealui/contracts/__tests__/mocks/revealui
 */

import type {
  AccessFunction,
  CollectionAccessConfig,
  CollectionAfterChangeHook,
  CollectionConfig,
  Field,
  FieldHooksConfig,
  GlobalConfig,
} from '../../cms/index.js';

// ============================================
// MOCK DOCUMENT TYPES
// ============================================

export interface MockPost {
  id: string;
  title: string;
  slug: string;
  content?: string;
  author?: string;
  publishedAt?: Date;
  status?: 'draft' | 'published';
  createdAt?: string;
  updatedAt?: string;
}

export interface MockUser {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
  tenants?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MockSettings {
  siteName: string;
  siteDescription?: string;
  logo?: string;
  socialLinks?: Array<{ platform: string; url: string }>;
}

// ============================================
// MOCK CMS REQUEST
// ============================================

export interface MockRevealUIRequest {
  user?: MockUser | null;
  locale?: string;
  fallbackLocale?: string;
  context?: Record<string, unknown>;
  transactionID?: string | null;
}

export function createMockRequest(
  overrides: Partial<MockRevealUIRequest> = {},
): MockRevealUIRequest {
  return {
    user: null,
    locale: 'en',
    fallbackLocale: 'en',
    context: {},
    transactionID: null,
    ...overrides,
  };
}

export function createAuthenticatedRequest(user: Partial<MockUser> = {}): MockRevealUIRequest {
  return createMockRequest({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      roles: ['user'],
      ...user,
    },
  });
}

export function createAdminRequest(): MockRevealUIRequest {
  return createAuthenticatedRequest({
    roles: ['admin'],
  });
}

// ============================================
// MOCK CONFIG FACTORIES
// ============================================

export function createMockCollectionConfig<T = unknown>(
  overrides: Partial<CollectionConfig<T>> = {},
): CollectionConfig<T> {
  return {
    slug: 'test-collection',
    fields: [{ name: 'title', type: 'text', required: true }],
    ...overrides,
  } as CollectionConfig<T>;
}

export function createMockGlobalConfig<T = unknown>(
  overrides: Partial<GlobalConfig<T>> = {},
): GlobalConfig<T> {
  return {
    slug: 'test-global',
    fields: [{ name: 'setting', type: 'text' }],
    ...overrides,
  } as GlobalConfig<T>;
}

export function createMockField(overrides: Partial<Field> = {}): Field {
  return {
    type: 'text',
    name: 'test-field',
    ...overrides,
  } as Field;
}

// ============================================
// MOCK ACCESS FUNCTIONS
// ============================================

export const mockAccessAllow: AccessFunction = () => true;
export const mockAccessDeny: AccessFunction = () => false;
export const mockAccessAuthenticated: AccessFunction = ({ req }) => Boolean(req?.user);
export const mockAccessAdmin: AccessFunction = ({ req }) => {
  return req?.user?.roles?.includes?.('admin') ?? false;
};

export function createMockAccessConfig(
  overrides: Partial<CollectionAccessConfig> = {},
): CollectionAccessConfig {
  return {
    create: mockAccessAuthenticated,
    read: mockAccessAllow,
    update: mockAccessAuthenticated,
    delete: mockAccessAdmin,
    ...overrides,
  };
}

// ============================================
// MOCK HOOK FUNCTIONS
// ============================================

export function createMockAfterChangeHook<T = unknown>(): CollectionAfterChangeHook<T> {
  return ({ doc }) => {
    // Log and return unchanged
    console.log('afterChange hook called');
    return doc;
  };
}

export function createMockFieldHooks<TValue = string>(): FieldHooksConfig<TValue> {
  return {
    beforeChange: [({ value }) => value],
    afterRead: [({ value }) => value],
  };
}

// ============================================
// MOCK VALIDATION FUNCTIONS
// ============================================

export const mockValidateRequired = (value: unknown): string | true => {
  if (value === undefined || value === null || value === '') {
    return 'This field is required';
  }
  return true;
};

export const mockValidateSlug = (value: unknown): string | true => {
  if (typeof value !== 'string') return 'Slug must be a string';
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    return 'Slug must start with lowercase letter and contain only lowercase letters, numbers, and hyphens';
  }
  return true;
};

export const mockValidateEmail = (value: unknown): string | true => {
  if (typeof value !== 'string') return 'Email must be a string';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Invalid email format';
  }
  return true;
};

// ============================================
// COMPLETE MOCK CONFIGS (Realistic Examples)
// ============================================

export const MockPostsCollection: CollectionConfig<MockPost> = {
  slug: 'posts',
  labels: {
    singular: 'Post',
    plural: 'Posts',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'publishedAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'content', type: 'richText' },
    { name: 'author', type: 'relationship', relationTo: 'users' },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'draft',
    },
    { name: 'publishedAt', type: 'date' },
  ],
  access: createMockAccessConfig(),
  hooks: {
    afterChange: [
      ({ doc, operation }) => {
        console.log(`Post ${operation}:`, doc.title);
        return doc;
      },
    ],
  },
};

export const MockUsersCollection: CollectionConfig<MockUser> = {
  slug: 'users',
  labels: {
    singular: 'User',
    plural: 'Users',
  },
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'User', value: 'user' },
        { label: 'Admin', value: 'admin' },
      ],
    },
  ],
  access: {
    create: mockAccessAdmin,
    read: mockAccessAllow,
    update: mockAccessAuthenticated,
    delete: mockAccessAdmin,
  },
};

export const MockSettingsGlobal: GlobalConfig<MockSettings> = {
  slug: 'settings',
  label: 'Site Settings',
  fields: [
    { name: 'siteName', type: 'text', required: true },
    { name: 'siteDescription', type: 'textarea' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [
        { name: 'platform', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
  access: {
    read: () => true,
    update: mockAccessAdmin,
  },
};
