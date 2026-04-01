import { getClient } from '@revealui/db';
import { processedWebhookEvents } from '@revealui/db/schema';
import { desc, eq, type SQL } from 'drizzle-orm';
import Link from 'next/link';
import { LicenseGate } from '@/lib/components/LicenseGate';

export const dynamic = 'force-dynamic';

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

interface PageProps {
  searchParams: Promise<{ type?: string; limit?: string }>;
}

export default async function WebhooksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterType = params.type || undefined;
  const limit = Math.min(Number(params.limit) || 200, 1000);

  let rows: (typeof processedWebhookEvents.$inferSelect)[] = [];
  let dbError: string | null = null;

  try {
    const db = getClient();
    const whereClause: SQL | undefined = filterType
      ? eq(processedWebhookEvents.eventType, filterType)
      : undefined;

    rows = await db
      .select()
      .from(processedWebhookEvents)
      .where(whereClause)
      .orderBy(desc(processedWebhookEvents.processedAt))
      .limit(limit);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // Extract unique event types for the filter
  const eventTypes = [...new Set(rows.map((r) => r.eventType))].sort();

  function filterUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const next = { type: filterType, ...overrides };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/admin/webhooks${qs ? `?${qs}` : ''}`;
  }

  return (
    <LicenseGate feature="dashboard">
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 border-b border-gray-700 bg-gray-900 p-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Webhook Events</h1>
            <p className="mt-0.5 text-sm text-gray-400">
              Processed Stripe webhook events — deduplication log
            </p>
          </div>

          {/* Type filter */}
          {eventTypes.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-1 text-sm">
              <Link
                href={filterUrl({ type: undefined })}
                className={`rounded px-2 py-1 ${!filterType ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                All types
              </Link>
              {eventTypes.slice(0, 8).map((t) => (
                <Link
                  key={t}
                  href={filterUrl({ type: t })}
                  className={`rounded px-2 py-1 font-mono text-xs ${filterType === t ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {t}
                </Link>
              ))}
            </div>
          )}
        </div>

        {dbError && (
          <div
            role="alert"
            className="m-4 rounded border border-red-700 bg-red-900 p-3 text-sm text-red-200"
          >
            Failed to load webhook events: {dbError}
          </div>
        )}

        {rows.length === 0 && !dbError && (
          <div className="m-4 p-8 text-center text-gray-500">
            No webhook events processed yet.
            {filterType ? (
              <span>
                {' '}
                <Link href="/admin/webhooks" className="text-blue-400 hover:underline">
                  Clear filter
                </Link>
              </span>
            ) : (
              ' Events will appear here as Stripe webhooks are received and processed.'
            )}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="border-b border-gray-800 px-4 py-2 text-xs text-gray-500">
              Showing {rows.length} events
              {filterType ? ` · type: ${filterType}` : ''}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-left text-gray-400">
                    <th className="whitespace-nowrap px-4 py-2 font-medium">Processed At</th>
                    <th className="px-4 py-2 font-medium">Event Type</th>
                    <th className="px-4 py-2 font-medium">Event ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-gray-900">
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-400">
                        {formatTime(new Date(row.processedAt))}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={filterUrl({ type: row.eventType })}
                          className="font-mono text-xs text-gray-300 hover:text-blue-400"
                        >
                          {row.eventType}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{row.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </LicenseGate>
  );
}
