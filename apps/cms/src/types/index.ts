/**
 * @deprecated Use @revealui/core/types or @revealui/core/types/cms instead
 * This file is kept for backward compatibility.
 *
 * New code should import from:
 * ```typescript
 * import type { Config, Page, Post } from '@revealui/core/types/cms'
 * ```
 */

// Re-export all generated CMS types from unified package
export type * from '@revealui/core/generated/types/cms';

// Re-export commonly used types for convenience
export type {
  Banner,
  Card,
  Category,
  Config,
  Event,
  Form,
  FormSubmission,
  Hero,
  Media,
  Order,
  Page,
  Post,
  Price,
  Product,
  Redirect,
  Subscription,
  Tag,
  Tenant,
  User,
} from '@revealui/core/generated/types/cms';
