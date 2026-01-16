/**
 * @deprecated Use @revealui/core/types instead
 * This file is kept for backward compatibility.
 *
 * New code should import from @revealui/core/types:
 * ```typescript
 * import type { Config, PageContext } from '@revealui/core/types'
 * ```
 */

// Re-export frontend types from core types
export type {
  Config,
  OnPageTransitionEndAsync,
  OnPageTransitionStartAsync,
  PageContext,
  PageContextInit,
} from '../core/types/frontend.js'
