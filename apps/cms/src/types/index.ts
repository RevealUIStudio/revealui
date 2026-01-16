/**
 * @deprecated Use @revealui/types or @revealui/types/cms instead
 * This file is kept for backward compatibility.
 * 
 * New code should import from:
 * ```typescript
 * import type { Config, Page, Post } from '@revealui/types/cms'
 * ```
 */

// Re-export all generated CMS types from unified package
export type * from '@revealui/generated/types/cms'

// Re-export commonly used types for convenience
export type {
  Config,
  Page,
  Post,
  User,
  Tenant,
  Media,
  Category,
  Tag,
  Event,
  Card,
  Hero,
  Product,
  Price,
  Order,
  Subscription,
  Banner,
  Redirect,
  Form,
  FormSubmission,
} from '@revealui/generated/types/cms'
