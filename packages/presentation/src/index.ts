/**
 * @revealui/presentation
 *
 * Shared UI components and presentation layer for RevealUI applications.
 * This package provides reusable components that can be used across
 * multiple apps in the RevealUI monorepo.
 */

// Icon set + provider/social brand marks: previously only on the /server
// entry, exported here so apps compose icons instead of handrolling SVGs.
export * from './components/icon.js';
export * from './components/index.js';
export * from './hooks/index.js';
export * from './icons/providers.js';
export * from './primitives/index.js';
export * from './utils/index.js';
