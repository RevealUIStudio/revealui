/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * Used for setting up monitoring and performance tracking
 *
 * NOTE: This file must be compatible with Edge Runtime since Next.js
 * may load it in different runtime contexts during build.
 */

export async function register() {
  // Sentry initialization — load runtime-specific config FIRST so server
  // actions / RSC / route handlers / middleware are instrumented before
  // any other module runs. Pattern per getsentry/sentry-for-ai
  // skills/sentry-nextjs-sdk/SKILL.md. Wrapped in try/catch: the
  // instrumentation.ts contract is "never throw — it kills the runtime".
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('../sentry.server.config');
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('../sentry.edge.config');
    }
  } catch {
    // Never throw. Node boot logs the failure from registerNode.
  }

  // GAP-335: Turbopack statically traces this file for Edge compatibility.
  // process.exit / process.stderr and Node-only imports MUST live in
  // instrumentation-node.ts, loaded only behind NEXT_RUNTIME === 'nodejs'.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { registerNode } = await import('./instrumentation-node');
  await registerNode();
}

// Auto-capture server-side request errors (server actions, RSC, route
// handlers, middleware). Requires @sentry/nextjs >= 8.28.0; we have ^10.49.0.
// Pattern per getsentry/sentry-for-ai skills/sentry-nextjs-sdk/SKILL.md.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
