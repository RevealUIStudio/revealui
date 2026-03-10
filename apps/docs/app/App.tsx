import { Routes, useRouter } from '@revealui/router'
import { useEffect } from 'react'
import { DocLayout } from './components/DocLayout'
import { ApiPage } from './routes/ApiPage'
import { GuidesPage } from './routes/GuidesPage'
import { HomePage } from './routes/HomePage'
import { ProPage } from './routes/ProPage'
import { SectionPage } from './routes/SectionPage'

function DocsRoute() {
  return <SectionPage section="docs" title="Documentation" />
}

function ApiRoute() {
  return <ApiPage />
}

function GuidesRoute() {
  return <GuidesPage />
}

function ProRoute() {
  return <ProPage />
}

export function App() {
  const router = useRouter()

  useEffect(() => {
    if (router.getRoutes().length > 0) return

    router.registerRoutes([
      { path: '/', component: HomePage },
      { path: '/docs/*path', component: DocsRoute },
      { path: '/api/*path', component: ApiRoute },
      { path: '/guides/*path', component: GuidesRoute },
      { path: '/pro/*path', component: ProRoute },
    ])
  }, [router])

  return (
    <DocLayout>
      <Routes />
    </DocLayout>
  )
}
