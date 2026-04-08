/**
 * @revealui/core/types/generated
 *
 * Generated types from RevealUI CMS configuration.
 * This file re-exports types from @revealui/core/generated.
 *
 * Types are generated from:
 * - CMS config: apps/admin/revealui.config.ts
 */

// Re-export generated CMS types
export type { Config as GeneratedConfig } from '../generated/types/cms.js';

// Type helper for GeneratedTypes interface
export type GeneratedTypes = import('../generated/types/cms.js').Config;
