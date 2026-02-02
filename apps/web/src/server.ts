import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createSSRHandler } from '@revealui/router/server'
import { routes } from './routes.tsx'

const app = new Hono()

// Debug: Log registered routes
console.log('Registered routes:', routes.map(r => ({ path: r.path, title: r.meta?.title })))

// Serve static files
app.use('/assets/*', serveStatic({ root: './public' }))
app.use('/src/*', serveStatic({ root: '.' }))

// SSR handler
app.get('*', createSSRHandler(routes, {
  template: (html, data) => `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data?.title || 'RevealUI'}</title>
        <link rel="stylesheet" href="/src/layouts/style.css">
        <link rel="stylesheet" href="/src/layouts/tailwind.css">
      </head>
      <body>
        <div id="root">${html}</div>
        <script id="__REVEALUI_DATA__" type="application/json">
          ${JSON.stringify(data || {})}
        </script>
        <script type="module" src="/src/client.tsx"></script>
      </body>
    </html>
  `,
}))

const port = Number(process.env.PORT) || 3000

serve({ fetch: app.fetch, port })

console.log(`🚀 RevealUI server running on http://localhost:${port}`)
