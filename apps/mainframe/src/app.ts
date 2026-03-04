import { logger } from '@revealui/core/observability/logger'
import { createSSRHandler } from '@revealui/router/server'
import { Hono } from 'hono'
import { routes } from './routes.js'

const isProd = process.env.NODE_ENV === 'production'

const app = new Hono()

logger.debug('Registered routes', {
  routes: routes.map((r) => ({ path: r.path, title: r.meta?.title })),
})

app.get(
  '*',
  createSSRHandler(routes, {
    template: (html: string, data?: Record<string, unknown>) => {
      const title = typeof data?.title === 'string' ? data.title : 'RevealUI'
      const cssLink = isProd
        ? '<link rel="stylesheet" href="/assets/client.css">'
        : '<link rel="stylesheet" href="/src/styles/style.css"><link rel="stylesheet" href="/src/styles/tailwind.css">'
      const scriptTag = isProd
        ? '<script type="module" src="/assets/client.js"></script>'
        : '<script type="module" src="/src/client.tsx"></script>'
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
      ${JSON.stringify(data ?? {})}
    </script>
    ${scriptTag}
  </body>
</html>`
    },
  }),
)

export default app
