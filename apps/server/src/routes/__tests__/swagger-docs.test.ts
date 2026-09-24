/**
 * Smoke for public GET /docs and the static Swagger asset routes.
 *
 * Production threw `Cannot find package 'swagger-ui-dist'` from these
 * handlers (REVEALUI-SERVER-E / REVEALUI-STAGING-1) because the files were
 * resolved only via import.meta.resolve. The route must answer 200 with the
 * asset bodies, and importing the module must not read them (boot safety).
 */
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

describe('swagger docs routes', () => {
  it('imports without reading swagger-ui-dist at evaluation time', async () => {
    const mod = await import('../swagger-docs.js');
    expect(mod.default).toBeDefined();
  });

  it('GET /docs returns the self-hosted page that points at same-origin assets', async () => {
    const { default: docs } = await import('../swagger-docs.js');
    const res = await docs.request('/docs');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('text/html');
    const html = await res.text();
    expect(html.includes('href="/docs/swagger-ui.css"')).toBe(true);
    expect(html.includes('src="/docs/swagger-ui-bundle.js"')).toBe(true);
    expect(html.includes('src="/docs/swagger-ui-standalone-preset.js"')).toBe(true);
    expect(html.includes('src="/docs/swagger-init.js"')).toBe(true);
  });

  it('GET /docs/swagger-init.js does not need the package', async () => {
    const { default: docs } = await import('../swagger-docs.js');
    const res = await docs.request('/docs/swagger-init.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('javascript');
    const body = await res.text();
    expect(body.includes('SwaggerUIBundle')).toBe(true);
    expect(body.includes("url: '/openapi.json'")).toBe(true);
  });

  it('GET /docs swagger assets return 200 with the package payloads', async () => {
    const { default: docs } = await import('../swagger-docs.js');
    const css = await docs.request('/docs/swagger-ui.css');
    const bundle = await docs.request('/docs/swagger-ui-bundle.js');
    const preset = await docs.request('/docs/swagger-ui-standalone-preset.js');

    expect(css.status).toBe(200);
    expect(css.headers.get('content-type') ?? '').toContain('text/css');
    expect((await css.text()).includes('.swagger-ui')).toBe(true);

    expect(bundle.status).toBe(200);
    expect(bundle.headers.get('content-type') ?? '').toContain('javascript');
    expect((await bundle.text()).includes('SwaggerUIBundle')).toBe(true);

    expect(preset.status).toBe(200);
    expect(preset.headers.get('content-type') ?? '').toContain('javascript');
    expect((await preset.text()).includes('SwaggerUIStandalonePreset')).toBe(true);
  });

  it('stays mounted at /docs when grouped onto a parent app', async () => {
    const { default: docs } = await import('../swagger-docs.js');
    const parent = new Hono();
    parent.route('/', docs);
    parent.get('/health', (c) => c.text('ok'));
    const docsRes = await parent.request('/docs');
    const healthRes = await parent.request('/health');
    expect(docsRes.status).toBe(200);
    expect((await docsRes.text()).includes('id="swagger-ui"')).toBe(true);
    expect(healthRes.status).toBe(200);
    expect(await healthRes.text()).toBe('ok');
  });
});
