import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import AgentPanel from './components/agent/AgentPanel';
import LoginScreen from './components/auth/LoginScreen';
import Dashboard from './components/dashboard/Dashboard';
import InferencePanel from './components/inference/InferencePanel';
import DeployDashboard from './components/dashboard/DeployDashboard';
import DeployWizard from './components/deploy/DeployWizard';
import CodeEditor from './components/editor/CodeEditor';
import TileGallery from './components/gallery/TileGallery';
import GitPanel from './components/git/GitPanel';
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
import { AuthContext, useAuth } from './hooks/use-auth';
import { useConfig } from './hooks/use-config';
import { SettingsContext, useSettings } from './hooks/use-settings';
import type { Page } from './types';

interface EditorTarget {
  repoPath: string;
  filePath: string;
}

export default function App() {
  const settingsValue = useSettings();

  return (
    <SettingsContext.Provider value={settingsValue}>
      <AuthGatedApp />
    </SettingsContext.Provider>
  );
}

function AuthGatedApp() {
  const { settings } = useSettings();
  const auth = useAuth(settings.apiUrl);

  return (
    <AuthContext.Provider value={auth}>
      {auth.loading && auth.step === 'idle' ? (
        <div className="flex h-screen items-center justify-center bg-neutral-950">
          <div className="text-neutral-400">Loading...</div>
        </div>
      ) : auth.step !== 'authenticated' ? (
        <LoginScreen />
      ) : (
        <MainApp />
      )}
    </AuthContext.Provider>
  );
}

function MainApp() {
  const [page, setPage] = useState<Page>('dashboard');
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const { config, loading, setIntent, updateConfig } = useConfig();

  // Listen for tray-click navigation events from Rust
  useEffect(() => {
    const unlisten = listen<string>('navigate', (event) => {
      const target = event.payload as Page;
      setPage(target);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  function openInEditor(repoPath: string, filePath: string) {
    setEditorTarget({ repoPath, filePath });
    setPage('editor');
  }

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
        <AppShell
          currentPage={page}
          onNavigate={setPage}
          padless={page === 'git' || page === 'editor'}
        >
          {page === 'dashboard' ? <Dashboard /> : null}
          {page === 'gallery' ? <TileGallery /> : null}
          {page === 'vault' ? <VaultPanel /> : null}
          {page === 'infrastructure' ? <InfrastructurePanel /> : null}
          {page === 'sync' ? <SyncPanel /> : null}
          {page === 'tunnel' ? <TunnelPanel /> : null}
          {page === 'terminal' ? <TerminalPanel /> : null}
          {page === 'git' ? <GitPanel onOpenEditor={openInEditor} /> : null}
          {page === 'editor' && editorTarget ? (
            <CodeEditor
              repoPath={editorTarget.repoPath}
              filePath={editorTarget.filePath}
              onClose={() => setPage('git')}
            />
          ) : null}
          {page === 'editor' && !editorTarget ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              No file selected — open a file from the Git panel
            </div>
          ) : null}
          {page === 'agent' ? <AgentPanel /> : null}
          {page === 'setup' ? <SetupPage /> : null}
          {page === 'settings' ? <SettingsPanel /> : null}
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
        {page === 'dashboard' ? <DeployDashboard /> : null}
        {page === 'setup' ? <SetupPage /> : null}
        {page === 'settings' ? <SettingsPanel /> : null}
      </AppShell>
    );
  }

  // Setup complete — develop intent shows full experience
  return (
    <AppShell currentPage={page} onNavigate={setPage} padless={page === 'git' || page === 'editor'}>
      {page === 'dashboard' ? <Dashboard /> : null}
      {page === 'gallery' ? <TileGallery /> : null}
      {page === 'vault' ? <VaultPanel /> : null}
      {page === 'infrastructure' ? <InfrastructurePanel /> : null}
      {page === 'sync' ? <SyncPanel /> : null}
      {page === 'tunnel' ? <TunnelPanel /> : null}
      {page === 'terminal' ? <TerminalPanel /> : null}
      {page === 'git' ? <GitPanel onOpenEditor={openInEditor} /> : null}
      {page === 'editor' && editorTarget ? (
        <CodeEditor
          repoPath={editorTarget.repoPath}
          filePath={editorTarget.filePath}
          onClose={() => setPage('git')}
        />
      ) : null}
      {page === 'editor' && !editorTarget ? (
        <div className="flex h-full items-center justify-center text-sm text-neutral-500">
          No file selected — open a file from the Git panel
        </div>
      ) : null}
      {page === 'agent' ? <AgentPanel /> : null}
      {page === 'inference' ? <InferencePanel /> : null}
      {page === 'setup' ? <SetupPage /> : null}
      {page === 'settings' ? <SettingsPanel /> : null}
    </AppShell>
  );
}
