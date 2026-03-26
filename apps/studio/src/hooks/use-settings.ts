import { createContext, use, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';

export interface StudioSettings {
  theme: Theme;
  apiUrl: string;
  pollingIntervalMs: number;
  /** Solana wallet public key for RVUI balance display. */
  solanaWalletAddress: string;
  /** Solana network for RVUI queries. */
  solanaNetwork: 'devnet' | 'mainnet-beta';
}

const DEFAULT_SETTINGS: StudioSettings = {
  theme: 'system',
  apiUrl: 'http://localhost:3004',
  pollingIntervalMs: 30_000,
  solanaWalletAddress: '',
  solanaNetwork: 'devnet',
};

const STORAGE_KEY = 'revealui-studio-settings';

function loadSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS };
    const obj = parsed as Record<string, unknown>;
    return {
      theme:
        obj.theme === 'dark' || obj.theme === 'light' || obj.theme === 'system'
          ? obj.theme
          : DEFAULT_SETTINGS.theme,
      apiUrl:
        typeof obj.apiUrl === 'string' && obj.apiUrl.length > 0
          ? obj.apiUrl
          : DEFAULT_SETTINGS.apiUrl,
      pollingIntervalMs:
        typeof obj.pollingIntervalMs === 'number' && obj.pollingIntervalMs >= 1_000
          ? obj.pollingIntervalMs
          : DEFAULT_SETTINGS.pollingIntervalMs,
      solanaWalletAddress:
        typeof obj.solanaWalletAddress === 'string'
          ? obj.solanaWalletAddress
          : DEFAULT_SETTINGS.solanaWalletAddress,
      solanaNetwork:
        obj.solanaNetwork === 'devnet' || obj.solanaNetwork === 'mainnet-beta'
          ? obj.solanaNetwork
          : DEFAULT_SETTINGS.solanaNetwork,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(settings: StudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable (SSR or quota exceeded)
  }
}

export interface SettingsContextValue {
  settings: StudioSettings;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  resetSettings: () => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettingsContext(): SettingsContextValue {
  const ctx = use(SettingsContext);
  if (!ctx) throw new Error('useSettingsContext must be used inside SettingsProvider');
  return ctx;
}

export function useSettings(): SettingsContextValue {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function updateSettings(patch: Partial<StudioSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }

  function resetSettings() {
    persistSettings(DEFAULT_SETTINGS);
    setSettings({ ...DEFAULT_SETTINGS });
  }

  return { settings, updateSettings, resetSettings };
}
