/**
 * @revealui/dev  -  Shared development configurations and tools
 *
 * This package is primarily consumed via subpath imports:
 *   - `dev/vite`            -  shared Vite configuration
 *   - `dev/tailwind`        -  shared Tailwind CSS config
 *   - `dev/tailwind/create-config`  -  Tailwind config factory
 *   - `dev/postcss`         -  shared PostCSS config
 *   - `dev/biome`           -  shared Biome config
 *   - `dev/code-validator`  -  AI code standards enforcer
 *   - `dev/ts/*`            -  TypeScript config presets
 *
 * The root export re-exports the code-validator, which is the only
 * programmatic module. Config files should be imported via subpaths.
 */

export * from './code-validator/index.js';
