/**
 * @revealui/engines — Optional unified barrel for the five business primitives.
 *
 * **Posture (ADR-006, 2026-07-23):** incubating. Apps and production routes
 * import leaf packages (`@revealui/auth`, `@revealui/db`, …) directly. This
 * package is a composed surface for kits / future consumers — not the required
 * application entry point today. Package is private (not published on npm).
 *
 * Namespace import (when you intentionally want the barrel):
 *
 * ```ts
 * import { users, content, products, payments, agents } from '@revealui/engines';
 * ```
 *
 * Or a specific primitive:
 *
 * ```ts
 * import { signIn, useSession, UserSchema } from '@revealui/engines/users';
 * ```
 */

export * as agents from './agents/index.js';
export * as content from './content/index.js';
export * as payments from './payments/index.js';
export * as products from './products/index.js';
export * as users from './users/index.js';
