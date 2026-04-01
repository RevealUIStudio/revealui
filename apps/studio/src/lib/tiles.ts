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
}

const PREFS_KEY = 'studio-tile-preferences';

export function loadTilePreferences(): TilePreferences {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      return JSON.parse(stored) as TilePreferences;
    }
  } catch {
    // Corrupted — reset
  }
  return { hiddenTileIds: [], collapsedCategories: [] };
}

export function saveTilePreferences(prefs: TilePreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
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
