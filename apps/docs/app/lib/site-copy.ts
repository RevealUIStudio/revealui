/**
 * Docs site title and default description.
 * Kept out of head.ts so the build-time shell writer does not load the
 * document-head module, and so route helpers stay usable when tests mock head.ts.
 * The description matches apps/docs/index.html.
 */

export const SITE_TITLE = 'RevealUI Documentation';

/** Mirrors the static default in index.html; keep the two in sync. */
export const DEFAULT_DESCRIPTION =
  'The agentic business runtime startups operate on their own domain — existing tools report in, you keep the stack. Agents leave receipts; catalog matches checkout (Free / Pro $49 / Max $99/mo · $799/yr).';
