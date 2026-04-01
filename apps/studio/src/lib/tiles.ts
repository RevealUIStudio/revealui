import { open } from '@tauri-apps/plugin-shell';

// ── Types ────────────────────────────────────────────────────────────────────

export type TileCategory = 'editor' | 'terminal' | 'ai' | 'browser' | 'accounts' | 'dashboards';

export type TileAction =
  | { type: 'url'; url: string }
  | { type: 'shell'; program: string; args?: string[] };

export interface TileDefinition {
  id: string;
  label: string;
  category: TileCategory;
  action: TileAction;
}

export interface CategoryDefinition {
  id: TileCategory;
  label: string;
}

// ── Categories ───────────────────────────────────────────────────────────────

export const CATEGORIES: CategoryDefinition[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'ai', label: 'AI' },
  { id: 'browser', label: 'Browser' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'dashboards', label: 'Dashboards' },
];

// ── Default tiles ────────────────────────────────────────────────────────────
// Matches the tile table in MASTER_PLAN.md Phase 5.6.2

export const DEFAULT_TILES: TileDefinition[] = [
  // Editor
  {
    id: 'zed',
    label: 'Zed',
    category: 'editor',
    action: { type: 'shell', program: 'zed', args: ['.'] },
  },

  // Terminal
  {
    id: 'revealui-tmux',
    label: 'RevealUI tmux',
    category: 'terminal',
    action: { type: 'shell', program: 'wt.exe', args: ['-p', 'RevealUI'] },
  },
  {
    id: 'wsl',
    label: 'WSL',
    category: 'terminal',
    action: { type: 'shell', program: 'wt.exe', args: ['-p', 'Ubuntu-24.04'] },
  },
  {
    id: 'powershell',
    label: 'PowerShell',
    category: 'terminal',
    action: { type: 'shell', program: 'wt.exe', args: ['-p', 'PowerShell'] },
  },

  // AI
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    category: 'ai',
    action: { type: 'shell', program: 'claude-desktop' },
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    category: 'ai',
    action: { type: 'shell', program: 'claude' },
  },

  // Browser
  {
    id: 'chrome-dev',
    label: 'Chrome (Dev)',
    category: 'browser',
    action: {
      type: 'shell',
      program: 'chrome.exe',
      args: ['--profile-directory=Profile 1'],
    },
  },
  {
    id: 'chrome-personal',
    label: 'Chrome (Personal)',
    category: 'browser',
    action: {
      type: 'shell',
      program: 'chrome.exe',
      args: ['--profile-directory=Default'],
    },
  },

  // Accounts
  {
    id: 'github',
    label: 'GitHub',
    category: 'accounts',
    action: { type: 'url', url: 'https://github.com/RevealUIStudio' },
  },
  {
    id: 'vercel-account',
    label: 'Vercel',
    category: 'accounts',
    action: { type: 'url', url: 'https://vercel.com/revealui-studio' },
  },
  {
    id: 'npm-account',
    label: 'npm',
    category: 'accounts',
    action: { type: 'url', url: 'https://www.npmjs.com/org/revealui' },
  },
  {
    id: 'stripe-account',
    label: 'Stripe',
    category: 'accounts',
    action: { type: 'url', url: 'https://dashboard.stripe.com' },
  },
  {
    id: 'neon-account',
    label: 'NeonDB',
    category: 'accounts',
    action: { type: 'url', url: 'https://console.neon.tech' },
  },
  {
    id: 'supabase-account',
    label: 'Supabase',
    category: 'accounts',
    action: { type: 'url', url: 'https://supabase.com/dashboard' },
  },

  // Dashboards
  {
    id: 'vercel-dashboard',
    label: 'Vercel Console',
    category: 'dashboards',
    action: { type: 'url', url: 'https://vercel.com/revealui-studio' },
  },
  {
    id: 'stripe-dashboard',
    label: 'Stripe Console',
    category: 'dashboards',
    action: { type: 'url', url: 'https://dashboard.stripe.com' },
  },
  {
    id: 'neon-dashboard',
    label: 'NeonDB Console',
    category: 'dashboards',
    action: { type: 'url', url: 'https://console.neon.tech' },
  },
  {
    id: 'supabase-dashboard',
    label: 'Supabase Console',
    category: 'dashboards',
    action: { type: 'url', url: 'https://supabase.com/dashboard' },
  },
];

// ── Tile preferences (persisted in localStorage) ─────────────────────────────

export interface TilePreferences {
  hiddenTileIds: string[];
  collapsedCategories: TileCategory[];
  recentTileIds: string[];
}

const PREFS_KEY = 'studio-tile-preferences';
const MAX_RECENTS = 5;

export function loadTilePreferences(): TilePreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TilePreferences;
      // Backfill for existing prefs without recentTileIds
      if (!parsed.recentTileIds) {
        parsed.recentTileIds = [];
      }
      return parsed;
    }
  } catch {
    // Corrupted — reset
  }
  return { hiddenTileIds: [], collapsedCategories: [], recentTileIds: [] };
}

export function saveTilePreferences(prefs: TilePreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function recordRecentLaunch(prefs: TilePreferences, tileId: string): TilePreferences {
  const filtered = prefs.recentTileIds.filter((id) => id !== tileId);
  return {
    ...prefs,
    recentTileIds: [tileId, ...filtered].slice(0, MAX_RECENTS),
  };
}

// ── Process detection (for running indicator) ───────────────────────────────
// Maps tile IDs to process names to check. Checked against `tasklist.exe` on
// Windows/WSL and `pgrep` on native Linux/macOS.

export const PROCESS_NAMES: Record<string, string[]> = {
  zed: ['zed', 'Zed.exe'],
  'revealui-tmux': ['tmux'],
  wsl: ['wt.exe', 'WindowsTerminal.exe'],
  powershell: ['powershell.exe', 'pwsh.exe'],
  'claude-desktop': ['Claude.exe', 'claude-desktop'],
  'claude-code': ['claude'],
  'chrome-dev': ['chrome.exe', 'chrome', 'Google Chrome'],
  'chrome-personal': ['chrome.exe', 'chrome', 'Google Chrome'],
};

// ── Browser profile detection ────────────────────────────────────────────────

export interface BrowserProfile {
  directory: string;
  name: string;
  browser: 'chrome' | 'edge';
}

export async function detectBrowserProfiles(): Promise<BrowserProfile[]> {
  const { Command } = await import('@tauri-apps/plugin-shell');
  const profiles: BrowserProfile[] = [];

  // Detect Windows username for path construction
  const whoami = await Command.create('exec-sh', [
    '-c',
    'cmd.exe /c "echo %USERPROFILE%" 2>/dev/null',
  ]).execute();

  if (whoami.code !== 0) return profiles;

  // Convert Windows path to WSL path: C:\Users\foo -> /mnt/c/Users/foo
  const winProfile = whoami.stdout.trim().replace(/\r/g, '');
  const wslBase = winProfile
    .replace(/^([A-Z]):\\/, (_m, drive: string) => `/mnt/${drive.toLowerCase()}/`)
    .split('\\')
    .join('/');

  const browsers: { name: 'chrome' | 'edge'; subdir: string; exe: string }[] = [
    { name: 'chrome', subdir: 'Google/Chrome/User Data', exe: 'chrome.exe' },
    { name: 'edge', subdir: 'Microsoft/Edge/User Data', exe: 'msedge.exe' },
  ];

  for (const browser of browsers) {
    const baseDir = `${wslBase}/AppData/Local/${browser.subdir}`;

    // List profile directories
    const lsResult = await Command.create('exec-sh', [
      '-c',
      `ls -d "${baseDir}"/Default "${baseDir}"/Profile\\ * 2>/dev/null`,
    ]).execute();

    if (lsResult.code !== 0) continue;

    const dirs = lsResult.stdout.trim().split('\n').filter(Boolean);

    for (const dir of dirs) {
      const prefPath = `${dir}/Preferences`;
      const catResult = await Command.create('exec-sh', [
        '-c',
        `cat "${prefPath}" 2>/dev/null`,
      ]).execute();

      if (catResult.code !== 0) continue;

      try {
        const prefs = JSON.parse(catResult.stdout);
        const name = prefs?.profile?.name;
        if (name) {
          const directory = dir.split('/').pop() ?? 'Default';
          profiles.push({ directory, name, browser: browser.name });
        }
      } catch {
        // Skip unparseable profiles
      }
    }
  }

  return profiles;
}

// ── Launch ───────────────────────────────────────────────────────────────────

export function launchTile(tile: TileDefinition): void {
  const { action } = tile;
  if (action.type === 'url') {
    open(action.url);
  } else {
    // shell:allow-execute is enabled in capabilities/default.json
    const args = action.args ? [action.program, ...action.args] : [action.program];
    open(args.join(' '));
  }
}
