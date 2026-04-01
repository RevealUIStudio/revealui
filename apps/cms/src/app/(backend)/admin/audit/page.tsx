import { getClient } from '@revealui/db';
import { auditLog } from '@revealui/db/schema';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import Link from 'next/link';
import { LicenseGate } from '@/lib/components/LicenseGate';

export const dynamic = 'force-dynamic';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-900 text-red-200',
  warn: 'bg-yellow-700 text-yellow-100',
  info: 'bg-gray-700 text-gray-200',
};

const SEVERITIES = ['info', 'warn', 'critical'] as const;

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
  searchParams: Promise<{ severity?: string; agent?: string; limit?: string }>;
}

export default async function AuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterSeverity = SEVERITIES.includes(params.severity as (typeof SEVERITIES)[number])
    ? params.severity
    : undefined;
  const filterAgent = params.agent || undefined;
  const limit = Math.min(Number(params.limit) || 200, 1000);

  let rows: (typeof auditLog.$inferSelect)[] = [];
  let dbError: string | null = null;

  try {
    const db = getClient();
    const clauses: SQL[] = [];
    if (filterSeverity) clauses.push(eq(auditLog.severity, filterSeverity));
    if (filterAgent) clauses.push(eq(auditLog.agentId, filterAgent));
    const whereClause =
      clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : and(...clauses);

    rows = await db
      .select()
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.timestamp))
      .limit(limit);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  function filterUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const next = { severity: filterSeverity, agent: filterAgent, ...overrides };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/admin/audit${qs ? `?${qs}` : ''}`;
  }

  return (
    <LicenseGate feature="dashboard">
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 border-b border-gray-700 bg-gray-900 p-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Audit Trail</h1>
            <p className="mt-0.5 text-sm text-gray-400">
              AI agent activity and security audit events
            </p>
          </div>

          {/* Severity filter */}
          <div className="ml-auto flex items-center gap-1 text-sm">
            <Link
              href={filterUrl({ severity: undefined })}
              className={`rounded px-2 py-1 ${!filterSeverity ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All
            </Link>
            {SEVERITIES.map((s) => (
              <Link
                key={s}
                href={filterUrl({ severity: s })}
                className={`rounded px-2 py-1 text-xs font-semibold uppercase ${filterSeverity === s ? (SEVERITY_STYLES[s] ?? '') : 'text-gray-400 hover:text-white'}`}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>

        {dbError && (
          <div
            role="alert"
            className="m-4 rounded border border-red-700 bg-red-900 p-3 text-sm text-red-200"
          >
            Failed to load audit log: {dbError}
          </div>
        )}

        {rows.length === 0 && !dbError && (
          <div className="m-4 p-8 text-center text-gray-500">
            No audit entries recorded yet.
            {filterSeverity || filterAgent ? (
              <span>
                {' '}
                <Link href="/admin/audit" className="text-blue-400 hover:underline">
                  Clear filters
                </Link>
              </span>
            ) : (
              ' Audit entries will appear here as agents perform actions.'
            )}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="border-b border-gray-800 px-4 py-2 text-xs text-gray-500">
              Showing {rows.length} entries
              {filterSeverity ? ` · severity: ${filterSeverity}` : ''}
              {filterAgent ? ` · agent: ${filterAgent}` : ''}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-left text-gray-400">
                    <th className="whitespace-nowrap px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">Severity</th>
                    <th className="px-4 py-2 font-medium">Event</th>
                    <th className="px-4 py-2 font-medium">Agent</th>
                    <th className="w-1/3 px-4 py-2 font-medium">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-gray-900">
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-400">
                        {formatTime(new Date(row.timestamp))}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase ${SEVERITY_STYLES[row.severity] ?? 'bg-gray-700 text-gray-200'}`}
                        >
                          {row.severity}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-300">
                        {row.eventType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-300">
                        <Link
                          href={filterUrl({ agent: row.agentId })}
                          className="hover:text-blue-400"
                        >
                          {row.agentId}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-200">
                        {row.payload &&
                        typeof row.payload === 'object' &&
                        Object.keys(row.payload as Record<string, unknown>).length > 0 ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-gray-500">
                              Payload
                            </summary>
                            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-xs text-gray-400">
                              {JSON.stringify(row.payload, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                        {row.policyViolations.length > 0 && (
                          <div className="mt-1 text-xs text-red-400">
                            Violations: {row.policyViolations.join(', ')}
                          </div>
                        )}
                      </td>
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
