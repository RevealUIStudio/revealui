import { getClient } from '@revealui/db';
import { errorEvents } from '@revealui/db/schema';
import { desc } from 'drizzle-orm';
import { LicenseGate } from '@/lib/components/LicenseGate';

export const dynamic = 'force-dynamic';

const LEVEL_STYLES: Record<string, string> = {
  fatal: 'bg-red-900 text-red-200',
  error: 'bg-red-700 text-red-100',
  warn: 'bg-yellow-700 text-yellow-100',
};

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date);
}

export default async function ErrorsPage() {
  let rows: (typeof errorEvents.$inferSelect)[] = [];
  let dbError: string | null = null;

  try {
    const db = getClient();
    rows = await db.select().from(errorEvents).orderBy(desc(errorEvents.timestamp)).limit(100);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <LicenseGate feature="dashboard">
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="p-4 border-b border-gray-700 bg-gray-900">
          <h1 className="text-xl font-semibold text-white">Error Events</h1>
          <p className="text-sm text-gray-400 mt-1">
            Last 100 captured errors across all apps — refreshes on page load
          </p>
        </div>

        {dbError && (
          <div className="m-4 p-3 bg-red-900 border border-red-700 rounded text-red-200 text-sm">
            Failed to load error events: {dbError}
          </div>
        )}

        {rows.length === 0 && !dbError && (
          <div className="m-4 p-8 text-center text-gray-500">
            No errors recorded yet. This is a good sign.
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-gray-400 text-left">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Level</th>
                  <th className="px-4 py-2 font-medium">App</th>
                  <th className="px-4 py-2 font-medium">Context</th>
                  <th className="px-4 py-2 font-medium w-1/2">Message</th>
                  <th className="px-4 py-2 font-medium">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-900 transition-colors">
                    <td className="px-4 py-2 text-gray-400 whitespace-nowrap text-xs">
                      {formatTime(new Date(row.timestamp))}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase ${LEVEL_STYLES[row.level] ?? 'bg-gray-700 text-gray-200'}`}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-300 font-mono text-xs">{row.app}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{row.context ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-200">
                      <div className="truncate max-w-lg" title={row.message}>
                        {row.message}
                      </div>
                      {row.stack && (
                        <details className="mt-1">
                          <summary className="text-xs text-gray-500 cursor-pointer">
                            Stack trace
                          </summary>
                          <pre className="mt-1 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap bg-gray-900 p-2 rounded">
                            {row.stack}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {row.url ? (
                        <span className="truncate block max-w-xs" title={row.url}>
                          {row.url.replace(/^https?:\/\/[^/]+/, '')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LicenseGate>
  );
}
