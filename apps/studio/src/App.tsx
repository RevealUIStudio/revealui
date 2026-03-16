import { useState } from 'react';
import Dashboard from './components/dashboard/Dashboard';
import DeployDashboard from './components/dashboard/DeployDashboard';
import DeployWizard from './components/deploy/DeployWizard';
import InfrastructurePanel from './components/infrastructure/InfrastructurePanel';
import IntentScreen from './components/intent/IntentScreen';
import AppShell from './components/layout/AppShell';
import SettingsPanel from './components/settings/SettingsPanel';
import SetupPage from './components/setup/SetupPage';
import SetupWizard from './components/setup/SetupWizard';
import SyncPanel from './components/sync/SyncPanel';
import TerminalPanel from './components/terminal/TerminalPanel';
import TunnelPanel from './components/tunnel/TunnelPanel';
import VaultPanel from './components/vault/VaultPanel';
import { useConfig } from './hooks/use-config';
import type { Page } from './types';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const { config, loading, setIntent, updateConfig } = useConfig();

  if (loading || !config) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!config.intent) {
    return (
      <IntentScreen
        onSelect={async (intent) => {
          await setIntent(intent);
        }}
      />
    );
  }

  if (config.intent === 'deploy' && !config.setupComplete) {
    return (
      <DeployWizard
        onComplete={async () => {
          await updateConfig({ setupComplete: true });
        }}
      />
    );
  }

  if (config.intent === 'develop' && !config.setupComplete) {
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
          {page === 'settings' && <SettingsPanel />}
        </AppShell>
        <SetupWizard
          onClose={() => {
            void updateConfig({ setupComplete: true });
          }}
        />
      </>
    );
  }

  // Setup complete — deploy intent shows deploy dashboard
  if (config.intent === 'deploy') {
    return (
      <AppShell currentPage={page} onNavigate={setPage}>
        {page === 'dashboard' && <DeployDashboard />}
        {page === 'setup' && <SetupPage />}
        {page === 'settings' && <SettingsPanel />}
      </AppShell>
    );
  }

  // Setup complete — develop intent shows full companion
  return (
    <AppShell currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'vault' && <VaultPanel />}
      {page === 'infrastructure' && <InfrastructurePanel />}
      {page === 'sync' && <SyncPanel />}
      {page === 'tunnel' && <TunnelPanel />}
      {page === 'terminal' && <TerminalPanel />}
      {page === 'setup' && <SetupPage />}
      {page === 'settings' && <SettingsPanel />}
    </AppShell>
  );
}
