/**
 * Backward-compatible entry for marketing CMS block derivation.
 *
 * Implementation lives in `./page-blocks/` (shared + pages/*). This file is a
 * pure re-export shell so existing `from '../lib/page-blocks'` imports keep
 * working. New VES page wires must add `page-blocks/pages/<slug>.ts` only —
 * see `page-blocks/index.ts` and `scripts/validate/page-blocks-modules.ts`.
 */

export * from './page-blocks/index';
