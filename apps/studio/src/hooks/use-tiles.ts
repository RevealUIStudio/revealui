import { useState } from 'react';
import {
  CATEGORIES,
  type CategoryDefinition,
  DEFAULT_TILES,
  launchTile,
  loadTilePreferences,
  saveTilePreferences,
  type TileCategory,
  type TileDefinition,
  type TilePreferences,
} from '../lib/tiles';

interface UseTilesReturn {
  /** All tiles grouped by category (respects hidden/collapsed state) */
  categories: CategoryWithTiles[];
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

export function useTiles(): UseTilesReturn {
  const [prefs, setPrefs] = useState<TilePreferences>(loadTilePreferences);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);

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

  const lowerQuery = query.toLowerCase();

  const categories: CategoryWithTiles[] = CATEGORIES.map((cat) => {
    const allInCategory = DEFAULT_TILES.filter((t) => t.category === cat.id);
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
    query,
    setQuery,
    editing,
    toggleEditing,
    toggleTile,
    toggleCategory,
    launch: launchTile,
  };
}
