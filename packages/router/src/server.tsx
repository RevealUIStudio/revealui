import { logger } from '@revealui/core/observability/logger'
import type { Context } from 'hono'
import { renderToPipeableStream, renderToString } from 'react-dom/server'
import { RouterProvider, Routes } from './components'
import { Router } from './router'
import type { Route } from './types'

/**
 * SSR Options
 */
export interface SSROptions {
  /** HTML template function */
  template?: (html: string, data?: Record<string, unknown>) => string
  /** Enable streaming SSR */
  streaming?: boolean
  /** Error handler */
  onError?: (error: Error, context: Context) => void
}

/**
 * Create a Hono handler for SSR
 */
export function createSSRHandler(
  routes: Route[],
  options: SSROptions = {},
): (c: Context) => Promise<Response> {
  const router = new Router()
  router.registerRoutes(routes)

  const defaultTemplate = (html: string, data?: Record<string, unknown>) =>
    `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data?.title || 'RevealUI'}</title>
    ${data?.meta || ''}
  </head>
  <body>
    <div id="root">${html}</div>
    <script id="__REVEALUI_DATA__" type="application/json">${JSON.stringify(data || {})}</script>
    <script type="module" src="/src/client.tsx"></script>
  </body>
</html>
  `.trim()

  const template = options.template || defaultTemplate

  return async (c: Context) => {
    const url = c.req.url
    const pathname = new URL(url).pathname

    try {
      // Match and resolve route
      logger.debug('Attempting to match pathname', { pathname })
      const match = await router.resolve(pathname)
      logger.debug('Match result', {
        match: match ? { path: match.route.path, hasComponent: !!match.route.component } : null,
      })

      if (!match) {
        c.status(404)
        return c.html(template('<div>404 - Page Not Found</div>'))
      }

      // Render with streaming if enabled
      if (options.streaming) {
        return new Promise<Response>((resolve, reject) => {
          const { pipe } = renderToPipeableStream(
            <RouterProvider router={router}>
              <Routes />
            </RouterProvider>,
            {
              onShellReady() {
                c.header('Content-Type', 'text/html')
                const html = pipe
                // biome-ignore lint/suspicious/noExplicitAny: pipe stream typing incompatibility with Hono
                resolve(c.body(html as any) as Response)
              },
              onError(error) {
                logger.error('SSR error', error instanceof Error ? error : new Error(String(error)))
                if (options.onError) {
                  options.onError(error as Error, c)
                }
                reject(error)
              },
            },
          )
        })
      }

      // Regular SSR
      const html = renderToString(
        <RouterProvider router={router}>
          <Routes />
        </RouterProvider>,
      )

      const data = {
        route: match.route.path,
        params: match.params,
        data: match.data,
        title: match.route.meta?.title,
      }

      return c.html(template(html, data))
    } catch (error) {
      logger.error('SSR error', error instanceof Error ? error : new Error(String(error)))

      if (options.onError) {
        options.onError(error as Error, c)
      }

      c.status(500)
      return c.html(template('<div>500 - Server Error</div>'))
    }
  }
}

/**
 * Create a simple dev server with Hono
 */
export async function createDevServer(
  routes: Route[],
  options: SSROptions & { port?: number } = {},
) {
  const { Hono } = await import('hono')
  const { serve } = await import('@hono/node-server')

  const app = new Hono()
  const port = options.port || 3000

  // Static files (you'll need to add your own static middleware)
  // app.use('/assets/*', serveStatic({ root: './public' }))

  // SSR handler for all routes
  app.get('*', createSSRHandler(routes, options))

  const server = serve({ fetch: app.fetch, port })

  logger.info('RevealUI dev server running', { url: `http://localhost:${port}` })

  return server
}

/**
 * Hydrate the client-side app
 */
export async function hydrate(router: Router, rootElement: HTMLElement | null = null) {
  if (typeof window === 'undefined') {
    return
  }

  const root = rootElement || document.getElementById('root')

  if (!root) {
    logger.error('Root element not found', new Error('Root element not found'))
    return
  }

  // Get SSR data
  const dataScript = document.getElementById('__REVEALUI_DATA__')
  const _ssrData = dataScript ? JSON.parse(dataScript.textContent || '{}') : {}

  // Initialize client-side routing
  router.initClient()

  // Use hydrateRoot for React 18+
  const { hydrateRoot } = require('react-dom/client')

  hydrateRoot(
    root,
    <RouterProvider router={router}>
      <Routes />
    </RouterProvider>,
  )

  logger.info('RevealUI hydrated')
}
