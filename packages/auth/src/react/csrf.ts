/**
 * CSRF Double-Submit Token Helper
 *
 * Re-exports the canonical browser cookie reader from
 * `@revealui/core/admin/utils/csrf` (fleet-redundancy P2-C). Shared by the
 * react auth hooks (`usePasskey`, `useMFA`, `useSignOut`) whose POSTs target
 * the RevealUI admin proxy's CSRF-gated endpoints.
 */

export { readCsrfToken } from '@revealui/core/admin/utils/csrf';
