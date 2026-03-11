import type { SecretInfo } from '../../types';

interface SecretListProps {
  secrets: SecretInfo[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
}

export default function SecretList({ secrets, selectedPath, onSelect, onDelete }: SecretListProps) {
  if (secrets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
        No secrets found
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
      {secrets.map((secret) => (
        <div
          key={secret.path}
          className={`group flex items-center justify-between rounded px-3 py-2 transition-colors ${
            selectedPath === secret.path
              ? 'bg-neutral-800 text-neutral-100'
              : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
          }`}
        >
          <button type="button" className="flex-1 text-left" onClick={() => onSelect(secret.path)}>
            <p className="truncate text-sm font-medium">{secret.path.split('/').pop()}</p>
            <p className="truncate text-xs text-neutral-500">{secret.path}</p>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(secret.path);
            }}
            className="ml-2 hidden rounded p-1 text-neutral-600 transition-colors hover:bg-red-950/50 hover:text-red-400 group-hover:flex"
            aria-label={`Delete ${secret.path}`}
          >
            <svg
              className="size-3.5"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
