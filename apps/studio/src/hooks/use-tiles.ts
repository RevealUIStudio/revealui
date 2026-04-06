import { Command } from '@tauri-apps/plugin-shell';
import { useEffect, useState } from 'react';
import { focusWindow } from '../lib/invoke';
import {
  type BrowserProfile,
  CATEGORIES,
  type CategoryDefinition,
  DEFAULT_TILES,
  detectBrowserProfiles,
  launchTile,
  loadTilePreferences,
  PROCESS_NAMES,
  recordRecentLaunch,
  saveTilePreferences,
  type TileCategory,
  type TileDefinition,
  type TilePreferences,
} from '../lib/tiles';

interface UseTilesReturn {
  /** All tiles grouped by category (respects hidden/collapsed state) */
  categories: CategoryWithTiles[];
  /** Recently launched tiles (up to 5) */
  recentTiles: TileDefinition[];
  /** Set of tile IDs for currently running processes */
  runningTileIds: Set<string>;
  /** Current search query */
  query: string;
  /** Set search query — filters tiles by label */
  setQuery: (q: string) => void;
  /** Whether edit mode is active (shows hidden tiles as dimmed) */
  editing: boolean;
  /** Toggle edit mode */
  toggleEditing: () => void;
  /** Toggle tile visibility */
  toggleTile: (tileId: string) => void;
  /** Toggle category collapsed state */
  toggleCategory: (categoryId: TileCategory) => void;
  /** Launch a tile's action */
  launch: (tile: TileDefinition) => void;
}

export interface CategoryWithTiles {
  category: CategoryDefinition;
  tiles: TileDefinition[];
  collapsed: boolean;
  /** Tiles that are hidden but shown in edit mode */
  hiddenTiles: TileDefinition[];
}

// ── Process detection ──────────────────────────────────────────────────────

async function detectRunningProcesses(): Promise<Set<string>> {
  const running = new Set<string>();

  try {
    // On WSL, use tasklist.exe to detect Windows processes + pgrep for Linux
    const [winResult, linuxResult] = await Promise.allSettled([
      Command.create('exec-sh', ['-c', 'tasklist.exe /FO CSV /NH 2>/dev/null']).execute(),
      Command.create('exec-sh', ['-c', 'ps -eo comm 2>/dev/null']).execute(),
    ]);

    const winProcesses =
      winResult.status === 'fulfilled' && winResult.value.code === 0
        ? winResult.value.stdout.toLowerCase()
        : '';
    const linuxProcesses =
      linuxResult.status === 'fulfilled' && linuxResult.value.code === 0
        ? linuxResult.value.stdout.toLowerCase()
        : '';

    const combined = `${winProcesses}\n${linuxProcesses}`;

    for (const [tileId, processNames] of Object.entries(PROCESS_NAMES)) {
      for (const name of processNames) {
        if (combined.includes(name.toLowerCase())) {
          running.add(tileId);
          break;
        }
      }
    }
  } catch {
    // Process detection is best-effort — don't break the UI
  }

  return running;
}

// ── Hook ────────────────────────────────────────────────────────────────────

function profileToTile(profile: BrowserProfile): TileDefinition {
  const exe = profile.browser === 'edge' ? 'msedge.exe' : 'chrome.exe';
  const browserLabel = profile.browser === 'edge' ? 'Edge' : 'Chrome';
  return {
    id: `detected-${profile.browser}-${profile.directory.toLowerCase().split(' ').join('-')}`,
    label: `${browserLabel} (${profile.name})`,
    category: 'browser',
    action: {
      type: 'shell',
      program: exe,
      args: [`--profile-directory=${profile.directory}`],
    },
  };
}

export function useTiles(): UseTilesReturn {
  const [prefs, setPrefs] = useState<TilePreferences>(loadTilePreferences);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [runningTileIds, setRunningTileIds] = useState<Set<string>>(new Set());
  const [detectedProfiles, setDetectedProfiles] = useState<TileDefinition[]>([]);

  // Detect browser profiles once on mount
  useEffect(() => {
    let cancelled = false;
    detectBrowserProfiles().then((profiles) => {
      if (cancelled) return;
      // Convert to tiles, but skip profiles that match existing hardcoded tiles
      const existingDirs = new Set(
        DEFAULT_TILES.filter((t) => t.category === 'browser').flatMap((t) => {
          if (t.action.type !== 'shell') return [];
          const dirArg = t.action.args?.find((a) => a.startsWith('--profile-directory='));
          return dirArg ? [dirArg.split('=')[1]] : [];
        }),
      );
      const newProfiles = profiles.filter((p) => !existingDirs.has(p.directory)).map(profileToTile);
      setDetectedProfiles(newProfiles);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll for running processes every 10 seconds
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const running = await detectRunningProcesses();
      if (!cancelled) {
        setRunningTileIds(running);
      }
    };

    poll();
    const interval = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const updatePrefs = (next: TilePreferences) => {
    setPrefs(next);
    saveTilePreferences(next);
  };

  const toggleTile = (tileId: string) => {
    const hidden = prefs.hiddenTileIds.includes(tileId)
      ? prefs.hiddenTileIds.filter((id) => id !== tileId)
      : [...prefs.hiddenTileIds, tileId];
    updatePrefs({ ...prefs, hiddenTileIds: hidden });
  };

  const toggleCategory = (categoryId: TileCategory) => {
    const collapsed = prefs.collapsedCategories.includes(categoryId)
      ? prefs.collapsedCategories.filter((id) => id !== categoryId)
      : [...prefs.collapsedCategories, categoryId];
    updatePrefs({ ...prefs, collapsedCategories: collapsed });
  };

  const toggleEditing = () => setEditing((e) => !e);

  const launch = async (tile: TileDefinition) => {
    // Quick-switch: if the app is already running, try to focus it instead
    if (runningTileIds.has(tile.id)) {
      const processNames = PROCESS_NAMES[tile.id];
      if (processNames) {
        for (const name of processNames) {
          const focused = await focusWindow(name);
          if (focused) {
            const next = recordRecentLaunch(prefs, tile.id);
            updatePrefs(next);
            return;
          }
        }
      }
    }

    // Not running or focus failed — launch normally
    launchTile(tile);
    const next = recordRecentLaunch(prefs, tile.id);
    updatePrefs(next);
  };

  const lowerQuery = query.toLowerCase();

  // Resolve recent tile IDs to definitions (skip hidden ones)
  const recentTiles = prefs.recentTileIds
    .map((id) => allTiles.find((t) => t.id === id))
    .filter((t): t is TileDefinition => t != null && !prefs.hiddenTileIds.includes(t.id));

  // Merge default tiles with auto-detected browser profiles
  const allTiles = [...DEFAULT_TILES, ...detectedProfiles];

  const categories: CategoryWithTiles[] = CATEGORIES.map((cat) => {
    const allInCategory = allTiles.filter((t) => t.category === cat.id);
    const visible = allInCategory.filter((t) => !prefs.hiddenTileIds.includes(t.id));
    const hidden = allInCategory.filter((t) => prefs.hiddenTileIds.includes(t.id));

    // Apply search filter
    const filtered = lowerQuery
      ? visible.filter((t) => t.label.toLowerCase().includes(lowerQuery))
      : visible;
    const filteredHidden = lowerQuery
      ? hidden.filter((t) => t.label.toLowerCase().includes(lowerQuery))
      : hidden;

    return {
      category: cat,
      tiles: filtered,
      hiddenTiles: filteredHidden,
      collapsed: prefs.collapsedCategories.includes(cat.id),
    };
  }).filter((cat) => {
    // Hide empty categories (unless editing and there are hidden tiles)
    if (editing) return cat.tiles.length > 0 || cat.hiddenTiles.length > 0;
    return cat.tiles.length > 0;
  });

  return {
    categories,
    recentTiles,
    runningTileIds,
    query,
    setQuery,
    editing,
    toggleEditing,
    toggleTile,
    toggleCategory,
    launch,
  };
}
