/**
 * Lazy Hono sub-app mount — durable isolation of optional surfaces from boot.
 *
 * Static `import './routes/og.js'` pulls satori/resvg/font resolution into the
 * serverless cold-start module graph. A throw during that evaluation aborts
 * the whole function (including /health) — 2026-07-21 production class.
 *
 * This helper mounts a proxy that dynamic-imports the real sub-app on the
 * first request to that path only. Health and other routes never load it.
 *
 * Path rewrite (2026-08 public-sites audit): parent `app.route('/api/og', proxy)`
 * matches correctly, but `app.fetch(c.req.raw)` re-dispatches the absolute
 * path (`/api/og`) against the child, which only defines `GET /`. That produced
 * production 404s for every OG image. Rewrite to a mount-relative path using
 * the matched route's `basePath` before calling the child.
 */
import type { Context } from 'hono';
import { Hono } from 'hono';

type HonoApp = Hono;

/**
 * Path the child sub-app expects (relative to its mount), including query.
 * `matchedRoutes` basePath is `/api/og` when the parent mounts us there;
 * without stripping, child `GET /` never matches.
 */
export function mountRelativeUrl(c: Context): URL {
  const absolute = new URL(c.req.raw.url);
  const matched = c.req.matchedRoutes;
  const base = matched.length > 0 ? (matched[matched.length - 1]?.basePath ?? '') : '';
  let rest = absolute.pathname;
  if (base && base !== '/' && rest.startsWith(base)) {
    rest = rest.slice(base.length) || '/';
  }
  if (!rest.startsWith('/')) {
    rest = `/${rest}`;
  }
  return new URL(`${rest}${absolute.search}`, absolute.origin);
}

export function createLazyHonoRoute(loader: () => Promise<{ default: HonoApp }>): HonoApp {
  let cached: HonoApp | undefined;
  let loadPromise: Promise<HonoApp> | undefined;

  async function getApp(): Promise<HonoApp> {
    if (cached) return cached;
    if (!loadPromise) {
      loadPromise = loader().then((mod) => {
        cached = mod.default;
        return cached;
      });
    }
    return loadPromise;
  }

  const proxy = new Hono();
  // When parent does app.route('/api/og', proxy), remaining path is '/' or '/*'.
  proxy.all('*', async (c) => {
    const app = await getApp();
    const req = new Request(mountRelativeUrl(c), c.req.raw);
    // Node/Vercel request() paths often have no ExecutionContext; only pass it
    // when present so unit tests and serverless both work.
    try {
      const exec = c.executionCtx;
      return app.fetch(req, c.env, exec);
    } catch {
      return app.fetch(req, c.env);
    }
  });
  return proxy;
}
