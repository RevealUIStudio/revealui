import { useState } from 'react'
import Dashboard from './components/dashboard/Dashboard'
import DevBoxPanel from './components/devbox/DevBoxPanel'
import AppShell from './components/layout/AppShell'
import SyncPanel from './components/sync/SyncPanel'
import type { Page } from './types'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <AppShell currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'devbox' && <DevBoxPanel />}
      {page === 'sync' && <SyncPanel />}
    </AppShell>
  )
}
