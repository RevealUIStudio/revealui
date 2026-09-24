/**
 * Self-hosted Swagger UI (no CDN, CSP-strict compatible).
 *
 * Assets are loaded on the first /docs* hit via `loadSwaggerAssets`. See
 * `lib/swagger-ui-assets.ts` for why the files are colocated into
 * `dist/assets/swagger-ui` instead of resolved from `swagger-ui-dist` at
 * request time on Vercel.
 */

import { Hono } from 'hono';
import { loadSwaggerAssets } from '../lib/swagger-ui-assets.js';

const IMMUTABLE_ASSET = 'public, max-age=31536000, immutable';
const DOCS_PAGE_CACHE = 'public, max-age=300, must-revalidate';

const swaggerInitJs = `window.addEventListener('load', function () {
  window.ui = SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    deepLinking: true,
  });
});`;

const SWAGGER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RevealUI API · Reference</title>
    <link rel="stylesheet" href="/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/swagger-ui-bundle.js"></script>
    <script src="/docs/swagger-ui-standalone-preset.js"></script>
    <script src="/docs/swagger-init.js"></script>
  </body>
</html>`;

const docs = new Hono();

docs.get('/docs/swagger-ui.css', (c) =>
  c.body(loadSwaggerAssets().css, 200, {
    'content-type': 'text/css; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
docs.get('/docs/swagger-ui-bundle.js', (c) =>
  c.body(loadSwaggerAssets().bundleJs, 200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
docs.get('/docs/swagger-ui-standalone-preset.js', (c) =>
  c.body(loadSwaggerAssets().presetJs, 200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
docs.get('/docs/swagger-init.js', (c) =>
  c.body(swaggerInitJs, 200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
docs.get('/docs', (c) => c.html(SWAGGER_HTML, 200, { 'cache-control': DOCS_PAGE_CACHE }));

export default docs;
