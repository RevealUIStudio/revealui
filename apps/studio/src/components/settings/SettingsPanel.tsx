import { useEffect, useState } from 'react';
import Card from '../ui/Card';
import PanelHeader from '../ui/PanelHeader';

type Theme = 'dark' | 'light' | 'system';

const API_URL = 'http://localhost:3004';
const POLLING_INTERVAL_MS = 10_000;

export default function SettingsPanel() {
  const [theme, setTheme] = useState<Theme>('system');
  const [appVersion, setAppVersion] = useState('dev');

  useEffect(() => {
    let cancelled = false;
    async function loadVersion() {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const version = await getVersion();
        if (!cancelled) {
          setAppVersion(version);
        }
      } catch {
        // Not running in Tauri context — keep "dev" default
      }
    }
    void loadVersion();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PanelHeader title="Settings" />

      {/* Appearance */}
      <Card header={<h2 className="text-sm font-semibold text-neutral-100">Appearance</h2>}>
        <div className="flex flex-col gap-3">
          <span className="text-sm text-neutral-400">Theme</span>
          <div className="flex gap-2">
            {(['dark', 'light', 'system'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTheme(option)}
                className={`rounded-md px-4 py-2 text-sm capitalize transition-colors ${
                  theme === option
                    ? 'bg-orange-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Connection */}
      <Card header={<h2 className="text-sm font-semibold text-neutral-100">Connection</h2>}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-neutral-400">API URL</span>
            <span className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-300 select-all">
              {API_URL}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-neutral-400">Polling interval</span>
            <span className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-300">
              {POLLING_INTERVAL_MS / 1_000}s
            </span>
          </div>
        </div>
      </Card>

      {/* About */}
      <Card header={<h2 className="text-sm font-semibold text-neutral-100">About</h2>}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">Version</span>
            <span className="text-sm text-neutral-300">{appVersion}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">Documentation</span>
            <span className="text-sm text-neutral-500">docs.revealui.com</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">GitHub</span>
            <span className="text-sm text-neutral-500">github.com/RevealUIStudio/revealui</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
