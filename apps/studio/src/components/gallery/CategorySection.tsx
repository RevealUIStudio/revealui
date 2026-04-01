import type { CategoryWithTiles } from '../../hooks/use-tiles';
import type { TileDefinition } from '../../lib/tiles';
import Tile from './Tile';

interface CategorySectionProps {
  data: CategoryWithTiles;
  editing: boolean;
  onToggleCollapse: () => void;
  onLaunch: (tile: TileDefinition) => void;
  onToggleTile: (tileId: string) => void;
}

export default function CategorySection({
  data,
  editing,
  onToggleCollapse,
  onLaunch,
  onToggleTile,
}: CategorySectionProps) {
  const { category, tiles, hiddenTiles, collapsed } = data;
  const tileCount = tiles.length + (editing ? hiddenTiles.length : 0);

  return (
    <section>
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex w-full items-center gap-2 py-2 text-left"
      >
        <svg
          className={`size-3.5 shrink-0 text-neutral-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {category.label}
        </h2>
        <span className="text-xs text-neutral-600">{tileCount}</span>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-2 gap-2 pb-4 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Tile
              key={tile.id}
              tile={tile}
              editing={editing}
              onLaunch={onLaunch}
              onToggle={onToggleTile}
            />
          ))}
          {editing &&
            hiddenTiles.map((tile) => (
              <Tile
                key={tile.id}
                tile={tile}
                hidden
                editing
                onLaunch={onLaunch}
                onToggle={onToggleTile}
              />
            ))}
        </div>
      )}
    </section>
  );
}
