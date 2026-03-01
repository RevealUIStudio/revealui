interface MountLogProps {
  entries: string[]
}

export default function MountLog({ entries }: MountLogProps) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-2 text-sm font-medium text-neutral-200">Log</h2>
      <div className="max-h-48 overflow-y-auto font-mono text-xs text-neutral-400">
        {entries.map((entry) => (
          <div key={entry} className="py-0.5">
            {entry}
          </div>
        ))}
      </div>
    </div>
  )
}
