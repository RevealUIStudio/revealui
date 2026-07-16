/**
 * @revealui/setup - Setup utilities for RevealUI projects
 *
 * Provides:
 * - Environment variable setup and generation
 * - Database initialization
 * - Configuration validation
 * - Shared utilities (logging, etc.)
 */

// Bootstrap (Fleet-wide setup primitive)
export * from './bootstrap/index.js';
// Environment setup
export * from './environment/index.js';
// Shared revvault CLI client
export * from './revvault/index.js';
// System Tune (hardware-aware auto-config)
export * from './system-tune/index.js';
// Utilities
export * from './utils/index.js';
// Validators
export * from './validators/index.js';
