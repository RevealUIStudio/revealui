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

// ── Platform detection ──────────────────────────────────────────────────────

export type Platform = 'windows' | 'macos' | 'linux';

export function detectPlatform(): Platform {
  const p = navigator.platform.toLowerCase();
  if (p.startsWith('win')) return 'windows';
  if (p.startsWith('mac')) return 'macos';
  return 'linux';
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

// ── URL tiles (platform-independent) ────────────────────────────────────────

const URL_TILES: TileDefinition[] = [
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

// ── Cross-platform tiles (same command everywhere) ──────────────────────────

const CROSS_PLATFORM_TILES: TileDefinition[] = [
  {
    id: 'zed',
    label: 'Zed',
    category: 'editor',
    action: { type: 'shell', program: 'zed', args: ['.'] },
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    category: 'ai',
    action: { type: 'shell', program: 'claude' },
  },
];

// ── Platform-specific shell tiles ───────────────────────────────────────────

const WINDOWS_TILES: TileDefinition[] = [
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
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    category: 'ai',
    action: { type: 'shell', program: 'claude-desktop' },
  },
  {
    id: 'chrome-dev',
    label: 'Chrome (Dev)',
    category: 'browser',
    action: { type: 'shell', program: 'chrome.exe', args: ['--profile-directory=Profile 1'] },
  },
  {
    id: 'chrome-personal',
    label: 'Chrome (Personal)',
    category: 'browser',
    action: { type: 'shell', program: 'chrome.exe', args: ['--profile-directory=Default'] },
  },
];

const MACOS_TILES: TileDefinition[] = [
  {
    id: 'revealui-tmux',
    label: 'RevealUI tmux',
    category: 'terminal',
    action: { type: 'shell', program: 'tmux', args: ['new-session', '-A', '-s', 'revealui'] },
  },
  {
    id: 'terminal-app',
    label: 'Terminal',
    category: 'terminal',
    action: { type: 'shell', program: 'open', args: ['-a', 'Terminal'] },
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    category: 'ai',
    action: { type: 'shell', program: 'open', args: ['-a', 'Claude'] },
  },
  {
    id: 'chrome-dev',
    label: 'Chrome (Dev)',
    category: 'browser',
    action: {
      type: 'shell',
      program: 'open',
      args: ['-na', 'Google Chrome', '--args', '--profile-directory=Profile 1'],
    },
  },
  {
    id: 'chrome-personal',
    label: 'Chrome (Personal)',
    category: 'browser',
    action: {
      type: 'shell',
      program: 'open',
      args: ['-na', 'Google Chrome', '--args', '--profile-directory=Default'],
    },
  },
];

const LINUX_TILES: TileDefinition[] = [
  {
    id: 'revealui-tmux',
    label: 'RevealUI tmux',
    category: 'terminal',
    action: { type: 'shell', program: 'tmux', args: ['new-session', '-A', '-s', 'revealui'] },
  },
  {
    id: 'gnome-terminal',
    label: 'GNOME Terminal',
    category: 'terminal',
    action: { type: 'shell', program: 'gnome-terminal' },
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    category: 'ai',
    action: { type: 'shell', program: 'claude-desktop' },
  },
  {
    id: 'chrome-dev',
    label: 'Chrome (Dev)',
    category: 'browser',
    action: { type: 'shell', program: 'google-chrome', args: ['--profile-directory=Profile 1'] },
  },
  {
    id: 'chrome-personal',
    label: 'Chrome (Personal)',
    category: 'browser',
    action: { type: 'shell', program: 'google-chrome', args: ['--profile-directory=Default'] },
  },
];

// ── Default tiles (assembled per platform) ──────────────────────────────────
// Matches the tile table in MASTER_PLAN.md Phase 5.6.2

function buildDefaultTiles(platform: Platform): TileDefinition[] {
  const platformTiles =
    platform === 'windows' ? WINDOWS_TILES : platform === 'macos' ? MACOS_TILES : LINUX_TILES;

  return [...CROSS_PLATFORM_TILES, ...platformTiles, ...URL_TILES];
}

export const DEFAULT_TILES: TileDefinition[] = buildDefaultTiles(detectPlatform());

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
// Windows/WSL and `ps` on native Linux/macOS.

const PROCESS_NAMES_WINDOWS: Record<string, string[]> = {
  zed: ['zed', 'Zed.exe'],
  'revealui-tmux': ['tmux'],
  wsl: ['wt.exe', 'WindowsTerminal.exe'],
  powershell: ['powershell.exe', 'pwsh.exe'],
  'claude-desktop': ['Claude.exe'],
  'claude-code': ['claude'],
  'chrome-dev': ['chrome.exe'],
  'chrome-personal': ['chrome.exe'],
};

const PROCESS_NAMES_MACOS: Record<string, string[]> = {
  zed: ['zed', 'Zed'],
  'revealui-tmux': ['tmux'],
  'terminal-app': ['Terminal'],
  'claude-desktop': ['Claude'],
  'claude-code': ['claude'],
  'chrome-dev': ['Google Chrome'],
  'chrome-personal': ['Google Chrome'],
};

const PROCESS_NAMES_LINUX: Record<string, string[]> = {
  zed: ['zed'],
  'revealui-tmux': ['tmux'],
  'gnome-terminal': ['gnome-terminal'],
  'claude-desktop': ['claude-desktop'],
  'claude-code': ['claude'],
  'chrome-dev': ['chrome', 'google-chrome'],
  'chrome-personal': ['chrome', 'google-chrome'],
};

function buildProcessNames(platform: Platform): Record<string, string[]> {
  if (platform === 'windows') return PROCESS_NAMES_WINDOWS;
  if (platform === 'macos') return PROCESS_NAMES_MACOS;
  return PROCESS_NAMES_LINUX;
}

export const PROCESS_NAMES: Record<string, string[]> = buildProcessNames(detectPlatform());

// ── Browser profile detection ────────────────────────────────────────────────

export interface BrowserProfile {
  directory: string;
  name: string;
  browser: 'chrome' | 'edge';
}

export async function detectBrowserProfiles(): Promise<BrowserProfile[]> {
  const { Command } = await import('@tauri-apps/plugin-shell');
  const platform = detectPlatform();
  const profiles: BrowserProfile[] = [];

  // Resolve the browser data directory per platform
  let baseDirs: { name: 'chrome' | 'edge'; path: string }[] = [];

  if (platform === 'windows') {
    // WSL: convert Windows path to WSL mount
    const whoami = await Command.create('exec-sh', [
      '-c',
      'cmd.exe /c "echo %USERPROFILE%" 2>/dev/null',
    ]).execute();
    if (whoami.code !== 0) return profiles;
    const winProfile = whoami.stdout.trim().replace(/\r/g, '');
    const wslBase = winProfile
      .replace(/^([A-Z]):\\/, (_m, drive: string) => `/mnt/${drive.toLowerCase()}/`)
      .split('\\')
      .join('/');
    baseDirs = [
      { name: 'chrome', path: `${wslBase}/AppData/Local/Google/Chrome/User Data` },
      { name: 'edge', path: `${wslBase}/AppData/Local/Microsoft/Edge/User Data` },
    ];
  } else if (platform === 'macos') {
    const home = (await Command.create('exec-sh', ['-c', 'echo $HOME']).execute()).stdout.trim();
    baseDirs = [
      { name: 'chrome', path: `${home}/Library/Application Support/Google/Chrome` },
      { name: 'edge', path: `${home}/Library/Application Support/Microsoft Edge` },
    ];
  } else {
    const home = (await Command.create('exec-sh', ['-c', 'echo $HOME']).execute()).stdout.trim();
    baseDirs = [
      { name: 'chrome', path: `${home}/.config/google-chrome` },
      { name: 'edge', path: `${home}/.config/microsoft-edge` },
    ];
  }

  for (const browser of baseDirs) {
    const lsResult = await Command.create('exec-sh', [
      '-c',
      `ls -d "${browser.path}"/Default "${browser.path}"/Profile\\ * 2>/dev/null`,
    ]).execute();
    if (lsResult.code !== 0) continue;

    const dirs = lsResult.stdout.trim().split('\n').filter(Boolean);
    for (const dir of dirs) {
      const catResult = await Command.create('exec-sh', [
        '-c',
        `cat "${dir}/Preferences" 2>/dev/null`,
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
