/**
 * @revealui/engines — Unified entry point for the five RevealUI business primitives.
 *
 * Each primitive is available as a namespace import:
 *
 * ```ts
 * import { users, content, products, payments, intelligence } from '@revealui/engines';
 * ```
 *
 * Or import a specific primitive directly:
 *
 * ```ts
 * import { signIn, useSession, UserSchema } from '@revealui/engines/users';
 * ```
 */

export * as users from './users/index.js';
export * as content from './content/index.js';
export * as products from './products/index.js';
export * as payments from './payments/index.js';
export * as intelligence from './intelligence/index.js';
