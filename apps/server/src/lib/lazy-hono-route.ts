/**
 * Lazy Hono sub-app mount — durable isolation of optional surfaces from boot.
 *
 * Static `import './routes/og.js'` pulls satori/resvg/font resolution into the
 * serverless cold-start module graph. A throw during that evaluation aborts
 * the whole function (including /health) — 2026-07-21 production class.
 *
 * This helper mounts a proxy that dynamic-imports the real sub-app on the
 * first request to that path only. Health and other routes never load it.
 */
import { Hono } from 'hono';

type HonoApp = Hono;

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
    // Node/Vercel request() paths often have no ExecutionContext; only pass it
    // when present so unit tests and serverless both work.
    try {
      const exec = c.executionCtx;
      return app.fetch(c.req.raw, c.env, exec);
    } catch {
      return app.fetch(c.req.raw, c.env);
    }
  });
  return proxy;
}
