import { useTiles } from '../../hooks/use-tiles';
import Button from '../ui/Button';
import PanelHeader from '../ui/PanelHeader';
import CategorySection from './CategorySection';

export default function TileGallery() {
  const {
    categories,
    query,
    setQuery,
    editing,
    toggleEditing,
    toggleTile,
    toggleCategory,
    launch,
  } = useTiles();

  return (
    <div className="space-y-4">
      <PanelHeader
        title="Launcher"
        action={
          <Button variant={editing ? 'primary' : 'ghost'} size="sm" onClick={toggleEditing}>
            {editing ? 'Done' : 'Edit'}
          </Button>
        }
      />

      {/* Search bar */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" x2="16.65" y1="21" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tiles..."
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2 pl-10 pr-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Category sections */}
      {categories.length > 0 ? (
        <div className="space-y-1">
          {categories.map((cat) => (
            <CategorySection
              key={cat.category.id}
              data={cat}
              editing={editing}
              onToggleCollapse={() => toggleCategory(cat.category.id)}
              onLaunch={launch}
              onToggleTile={toggleTile}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-neutral-500">
          {query ? `No tiles matching "${query}"` : 'No tiles configured'}
        </div>
      )}

      {editing && (
        <p className="text-xs text-neutral-600">
          Click the eye icon to show or hide tiles. Changes are saved automatically.
        </p>
      )}
    </div>
  );
}
