import { logger } from '@revealui/core/observability/logger'
import { createSSRHandler } from '@revealui/router/server'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { routes } from './routes.js'

const isProd = process.env.NODE_ENV === 'production'

const app = new Hono()

app.use('*', secureHeaders())

logger.debug('Registered routes', {
  routes: routes.map((r) => ({ path: r.path, title: r.meta?.title })),
})

/** Escape HTML special characters to prevent XSS in SSR output */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

app.get(
  '*',
  createSSRHandler(routes, {
    template: (html: string, data?: Record<string, unknown>) => {
      const rawTitle = typeof data?.title === 'string' ? data.title : 'RevealUI'
      const title = escapeHtml(rawTitle)
      const cssLink = isProd
        ? '<link rel="stylesheet" href="/assets/client.css">'
        : '<link rel="stylesheet" href="/src/styles/style.css"><link rel="stylesheet" href="/src/styles/tailwind.css">'
      const scriptTag = isProd
        ? '<script type="module" src="/assets/client.js"></script>'
        : '<script type="module" src="/src/client.tsx"></script>'
      // Escape </script> sequences in serialized JSON to prevent premature tag closure
      const safeJson = JSON.stringify(data ?? {}).replace(/</g, '\\u003c')
      return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${cssLink}
  </head>
  <body>
    <div id="root">${html}</div>
    <script id="__REVEALUI_DATA__" type="application/json">
      ${safeJson}
    </script>
    ${scriptTag}
  </body>
</html>`
    },
  }),
)

export default app
