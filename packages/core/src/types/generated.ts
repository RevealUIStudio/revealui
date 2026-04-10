/**
 * @revealui/core/types/generated
 *
 * Generated types from RevealUI admin configuration.
 * This file re-exports types from @revealui/core/generated.
 *
 * Types are generated from:
 * - admin config: apps/admin/revealui.config.ts
 */

// Re-export generated admin types
export type { Config as GeneratedConfig } from '../generated/types/admin.js';

// Type helper for GeneratedTypes interface
export type GeneratedTypes = import('../generated/types/admin.js').Config;
