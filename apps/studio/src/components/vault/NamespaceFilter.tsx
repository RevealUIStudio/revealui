interface NamespaceFilterProps {
  namespaces: string[];
  active: string | null;
  onChange: (ns: string | null) => void;
}

export default function NamespaceFilter({ namespaces, active, onChange }: NamespaceFilterProps) {
  return (
    <div className="flex w-44 flex-shrink-0 flex-col gap-0.5">
      <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Namespaces
      </p>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded px-2 py-1.5 text-left text-sm transition-colors ${
          active === null
            ? 'bg-neutral-800 text-neutral-100'
            : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
        }`}
      >
        All
      </button>
      {namespaces.map((ns) => (
        <button
          key={ns}
          type="button"
          onClick={() => onChange(ns)}
          className={`rounded px-2 py-1.5 text-left text-sm transition-colors ${
            active === ns
              ? 'bg-neutral-800 text-neutral-100'
              : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
          }`}
        >
          {ns}
        </button>
      ))}
      {namespaces.length === 0 && (
        <p className="px-2 py-1 text-xs text-neutral-600">No namespaces</p>
      )}
    </div>
  );
}
