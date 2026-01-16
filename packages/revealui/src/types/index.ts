/**
 * @deprecated Use @revealui/types instead
 * This file is kept for backward compatibility.
 * 
 * New code should import from @revealui/types:
 * ```typescript
 * import type { Config, PageContext } from '@revealui/types'
 * ```
 */

// Re-export frontend types directly (avoiding circular dependency with @revealui/types)
// These types are defined in @revealui/types/src/frontend.ts
// Using relative path to break circular dependency: @revealui/core -> @revealui/types -> @revealui/core
export type {
  Config,
  OnPageTransitionEndAsync,
  OnPageTransitionStartAsync,
  PageContext,
  PageContextInit,
} from '../../../types/src/frontend.js'
