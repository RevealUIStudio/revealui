import { useState } from 'react';
import Dashboard from './components/dashboard/Dashboard';
import InfrastructurePanel from './components/infrastructure/InfrastructurePanel';
import AppShell from './components/layout/AppShell';
import SetupPage from './components/setup/SetupPage';
import SetupWizard from './components/setup/SetupWizard';
import SyncPanel from './components/sync/SyncPanel';
import TerminalPanel from './components/terminal/TerminalPanel';
import TunnelPanel from './components/tunnel/TunnelPanel';
import VaultPanel from './components/vault/VaultPanel';
import { isSetupComplete } from './hooks/use-setup';
import type { Page } from './types';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [isFirstRun, setIsFirstRun] = useState(() => !isSetupComplete());

  return (
    <>
      <AppShell currentPage={page} onNavigate={setPage}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'vault' && <VaultPanel />}
        {page === 'infrastructure' && <InfrastructurePanel />}
        {page === 'sync' && <SyncPanel />}
        {page === 'tunnel' && <TunnelPanel />}
        {page === 'terminal' && <TerminalPanel />}
        {page === 'setup' && <SetupPage />}
      </AppShell>
      {isFirstRun && <SetupWizard onClose={() => setIsFirstRun(false)} />}
    </>
  );
}
