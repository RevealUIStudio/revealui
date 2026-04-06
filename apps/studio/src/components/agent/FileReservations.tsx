import type { HarnessReservation } from '../../types';

interface FileReservationsProps {
  reservations: HarnessReservation[];
  agentId: string;
}

export default function FileReservations({ reservations, agentId }: FileReservationsProps) {
  function relativeTime(iso: string): string {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return iso;
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function timeUntil(iso: string): string {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return iso;
    const diff = Math.floor((ts - Date.now()) / 1000);
    if (diff <= 0) return 'expired';
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  }

  // Group by agent
  const byAgent = new Map<string, HarnessReservation[]>();
  for (const r of reservations) {
    const existing = byAgent.get(r.agent_id) ?? [];
    existing.push(r);
    byAgent.set(r.agent_id, existing);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-200">File Reservations</span>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
          {reservations.length}
        </span>
      </div>

      {/* Reservation list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {reservations.length === 0 ? (
          <p className="py-8 text-center text-xs text-neutral-600">No active file reservations</p>
        ) : null}

        {Array.from(byAgent.entries()).map(([aid, files]) => {
          const isSelf = aid === agentId;
          return (
            <div key={aid} className="mb-4">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className={`size-2 shrink-0 rounded-full ${isSelf ? 'bg-green-500' : 'bg-orange-500'}`}
                />
                <span className="text-[10px] font-semibold text-neutral-300">
                  {aid}
                  {isSelf ? ' (you)' : ''}
                </span>
                <span className="rounded bg-neutral-800 px-1 py-0.5 text-[10px] text-neutral-500">
                  {files.length}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {files.map((r) => {
                  const name = r.file_path.split('/').pop() ?? r.file_path;
                  const dir = r.file_path.includes('/')
                    ? r.file_path.slice(0, r.file_path.lastIndexOf('/'))
                    : '';
                  const ttl = timeUntil(r.expires_at);
                  const expired = ttl === 'expired';

                  return (
                    <div
                      key={r.file_path}
                      className={`rounded border p-2 ${
                        expired
                          ? 'border-red-800/40 bg-red-950/20'
                          : 'border-neutral-800 bg-neutral-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileIcon />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-neutral-200">
                            {name}
                          </span>
                          {dir ? (
                            <span className="block truncate text-[10px] text-neutral-500">
                              {dir}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            expired
                              ? 'bg-red-900/30 text-red-400'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {expired ? 'expired' : `${ttl} left`}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-500">{r.reason}</p>
                      <p className="mt-0.5 text-[10px] text-neutral-600">
                        reserved {relativeTime(r.reserved_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg
      className="size-3.5 shrink-0 text-neutral-500"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
