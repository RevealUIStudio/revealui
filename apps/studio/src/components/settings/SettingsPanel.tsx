import { useEffect, useState } from 'react';
import type { Theme } from '../../hooks/use-settings';
import { useSettingsContext } from '../../hooks/use-settings';
import Card from '../ui/Card';
import PanelHeader from '../ui/PanelHeader';

type SettingsTab = 'appearance' | 'connection' | 'wallet' | 'about';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'connection', label: 'Connection' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'about', label: 'About' },
];

const POLLING_OPTIONS = [
  { label: '10s', value: 10_000 },
  { label: '30s', value: 30_000 },
  { label: '60s', value: 60_000 },
  { label: '5m', value: 300_000 },
];

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [appVersion, setAppVersion] = useState('dev');
  const { settings, updateSettings, resetSettings } = useSettingsContext();

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
        // Not running in Tauri context  -  keep "dev" default
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

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-neutral-900 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'appearance' && (
        <Card header={<h2 className="text-sm font-semibold text-neutral-100">Appearance</h2>}>
          <div className="flex flex-col gap-3">
            <span className="text-sm text-neutral-400">Theme</span>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateSettings({ theme: option as Theme })}
                  className={`rounded-md px-4 py-2 text-sm capitalize transition-colors ${
                    settings.theme === option
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
      )}

      {activeTab === 'connection' && (
        <Card header={<h2 className="text-sm font-semibold text-neutral-100">Connection</h2>}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="settings-api-url" className="text-sm text-neutral-400">
                API URL
              </label>
              <input
                id="settings-api-url"
                type="text"
                value={settings.apiUrl}
                onChange={(e) => updateSettings({ apiUrl: e.target.value })}
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 focus:border-neutral-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-neutral-400">Polling interval</span>
              <div className="flex gap-2">
                {POLLING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateSettings({ pollingIntervalMs: opt.value })}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      settings.pollingIntervalMs === opt.value
                        ? 'bg-orange-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'wallet' && (
        <Card
          header={<h2 className="text-sm font-semibold text-neutral-100">RevealCoin Wallet</h2>}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="settings-solana-wallet" className="text-sm text-neutral-400">
                Solana Wallet Address
              </label>
              <input
                id="settings-solana-wallet"
                type="text"
                value={settings.solanaWalletAddress}
                onChange={(e) => updateSettings({ solanaWalletAddress: e.target.value.trim() })}
                placeholder="e.g., BzFDXRj56Qki..."
                className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-mono text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              />
              <span className="text-xs text-neutral-500">
                Your Solana public key for displaying RVUI balance on the dashboard.
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-neutral-400">Network</span>
              <div className="flex gap-2">
                {(['devnet', 'mainnet-beta'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateSettings({ solanaNetwork: option })}
                    className={`rounded-md px-4 py-2 text-sm transition-colors ${
                      settings.solanaNetwork === option
                        ? 'bg-orange-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'about' && (
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
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-400">Community</span>
              <span className="text-sm text-neutral-500">revnation.discourse.group</span>
            </div>
            <div className="pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={resetSettings}
                className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Reset all settings to defaults
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
