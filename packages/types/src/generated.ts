/**
 * @revealui/types/generated
 *
 * Generated types from RevealUI CMS configuration.
 * This file re-exports types from @revealui/generated.
 *
 * Types are generated from:
 * - CMS config: apps/cms/revealui.config.ts
 * - Supabase schema: packages/services/src/core/supabase/types.ts
 */

// Re-export generated CMS types
export type { Config as GeneratedConfig } from '@revealui/generated/types/cms'

// Re-export generated Supabase types
export type { Database } from '@revealui/generated/types/supabase'

// Type helper for GeneratedTypes interface
export type GeneratedTypes = import('@revealui/generated/types/cms').Config
