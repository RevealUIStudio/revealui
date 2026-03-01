import { useState } from 'react'
import AppsPanel from './components/apps/AppsPanel'
import Dashboard from './components/dashboard/Dashboard'
import DevBoxPanel from './components/devbox/DevBoxPanel'
import AppShell from './components/layout/AppShell'
import SetupWizard from './components/setup/SetupWizard'
import SyncPanel from './components/sync/SyncPanel'
import { isSetupComplete } from './hooks/use-setup'
import type { Page } from './types'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [showSetup, setShowSetup] = useState(() => !isSetupComplete())

  return (
    <>
      <AppShell currentPage={page} onNavigate={setPage} onSetup={() => setShowSetup(true)}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'devbox' && <DevBoxPanel />}
        {page === 'sync' && <SyncPanel />}
        {page === 'apps' && <AppsPanel />}
      </AppShell>
      {showSetup && <SetupWizard onClose={() => setShowSetup(false)} />}
    </>
  )
}
