/**
 * Marketing CMS block modules.
 *
 * Add a new VES page by creating `pages/<slug>.ts` that exports derivation +
 * `fleetMarketingPageSeed`, then one `export * from './pages/<slug>'` line here.
 * Do NOT grow a mono page-blocks.ts — the gate enforces the re-export-only shell.
 */

export * from './pages/fair-source';
export * from './pages/for-operators-how-it-works';
export * from './pages/for-operators-managed';
export * from './pages/home';
export * from './pages/local-ai';
export * from './pages/philosophy';
export * from './pages/products';
export * from './pages/services';
export * from './shared';
