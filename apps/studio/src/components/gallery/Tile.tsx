import type { TileDefinition } from '../../lib/tiles';
import TileIcon from './TileIcon';

interface TileProps {
  tile: TileDefinition;
  hidden?: boolean;
  editing?: boolean;
  running?: boolean;
  onLaunch: (tile: TileDefinition) => void;
  onToggle?: (tileId: string) => void;
}

export default function Tile({ tile, hidden, editing, running, onLaunch, onToggle }: TileProps) {
  const isUrl = tile.action.type === 'url';

  return (
    <button
      type="button"
      onClick={() => {
        if (editing && onToggle) {
          onToggle(tile.id);
        } else if (!hidden) {
          onLaunch(tile);
        }
      }}
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
        hidden
          ? 'border-neutral-800/50 bg-neutral-900/30 text-neutral-600'
          : running
            ? 'border-emerald-800/60 bg-neutral-900 text-neutral-300 hover:border-emerald-700 hover:bg-neutral-800 hover:text-neutral-100'
            : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-100'
      }`}
      title={
        editing
          ? hidden
            ? `Show ${tile.label}`
            : `Hide ${tile.label}`
          : isUrl
            ? (tile.action as { type: 'url'; url: string }).url
            : running
              ? `${tile.label} (running)`
              : tile.label
      }
    >
      <span className="relative">
        <span
          className={
            hidden ? 'opacity-40' : 'text-neutral-400 group-hover:text-orange-400 transition-colors'
          }
        >
          <TileIcon tileId={tile.id} />
        </span>
        {running && !editing && (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-500" />
        )}
      </span>
      <span className="truncate font-medium">{tile.label}</span>
      {editing && (
        <span className="ml-auto shrink-0">
          {hidden ? (
            <svg
              className="size-4 text-neutral-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" x2="23" y1="1" y2="23" />
            </svg>
          ) : (
            <svg
              className="size-4 text-neutral-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </span>
      )}
    </button>
  );
}
