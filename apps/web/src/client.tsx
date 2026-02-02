import { Router, RouterProvider, Routes } from '@revealui/router'
import { hydrateRoot } from 'react-dom/client'
import { routes } from './routes.tsx'

// Import styles
import './layouts/style.css'
import './layouts/tailwind.css'

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
    </RouterProvider>
  )

  console.log('✨ RevealUI hydrated and ready')
} else {
  console.error('❌ Root element not found')
}
