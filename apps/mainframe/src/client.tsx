import { logger } from '@revealui/core/observability/logger'
import { Router, RouterProvider, Routes } from '@revealui/router'
import { hydrateRoot } from 'react-dom/client'
import { routes } from './routes.js'
import './styles/style.css'
import './styles/tailwind.css'

// Create router instance
const router = new Router()
router.registerRoutes(routes)
router.initClient()

// Hydrate the app
const root = document.getElementById('root')

if (root) {
  hydrateRoot(
    root,
    <RouterProvider router={router}>
      <Routes />
    </RouterProvider>,
  )

  logger.info('RevealUI hydrated and ready')
} else {
  logger.error('Root element not found', new Error('Root element with id "root" not found in DOM'))
}
