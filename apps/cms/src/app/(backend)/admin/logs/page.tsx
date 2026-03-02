import { getClient } from '@revealui/db'
import { appLogs } from '@revealui/db/schema'
import { and, desc, eq, type SQL } from 'drizzle-orm'
import Link from 'next/link'
import { LicenseGate } from '@/lib/components/LicenseGate'

export const dynamic = 'force-dynamic'

const LEVEL_STYLES: Record<string, string> = {
  fatal: 'bg-red-900 text-red-200',
  error: 'bg-red-700 text-red-100',
  warn: 'bg-yellow-700 text-yellow-100',
}

const APPS = ['cms', 'api', 'marketing', 'mainframe'] as const
const LEVELS = ['warn', 'error', 'fatal'] as const

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(date)
}

interface PageProps {
  searchParams: Promise<{ app?: string; level?: string; limit?: string }>
}

export default async function LogsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filterApp = APPS.includes(params.app as (typeof APPS)[number]) ? params.app : undefined
  const filterLevel = LEVELS.includes(params.level as (typeof LEVELS)[number])
    ? params.level
    : undefined
  const limit = Math.min(Number(params.limit) || 200, 1000)

  let rows: (typeof appLogs.$inferSelect)[] = []
  let dbError: string | null = null

  try {
    const db = getClient()
    const clauses: SQL[] = []
    if (filterApp) clauses.push(eq(appLogs.app, filterApp))
    if (filterLevel) clauses.push(eq(appLogs.level, filterLevel))
    const whereClause =
      clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : and(...clauses)

    rows = await db
      .select()
      .from(appLogs)
      .where(whereClause)
      .orderBy(desc(appLogs.timestamp))
      .limit(limit)
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err)
  }

  function filterUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const next = { app: filterApp, level: filterLevel, ...overrides }
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v)
    }
    const qs = p.toString()
    return `/admin/logs${qs ? `?${qs}` : ''}`
  }

  return (
    <LicenseGate feature="dashboard" featureLabel="Application Logs">
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-900 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Application Logs</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Structured warn/error/fatal logs from all apps — refreshes on page load
          </p>
        </div>

        {/* App filter */}
        <div className="flex items-center gap-1 text-sm ml-auto">
          <Link
            href={filterUrl({ app: undefined })}
            className={`px-2 py-1 rounded ${!filterApp ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            All apps
          </Link>
          {APPS.map((a) => (
            <Link
              key={a}
              href={filterUrl({ app: a })}
              className={`px-2 py-1 rounded font-mono ${filterApp === a ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {a}
            </Link>
          ))}
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1 text-sm">
          <Link
            href={filterUrl({ level: undefined })}
            className={`px-2 py-1 rounded ${!filterLevel ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            All levels
          </Link>
          {LEVELS.map((l) => (
            <Link
              key={l}
              href={filterUrl({ level: l })}
              className={`px-2 py-1 rounded uppercase text-xs font-semibold ${filterLevel === l ? (LEVEL_STYLES[l] ?? '') : 'text-gray-400 hover:text-white'}`}
            >
              {l}
            </Link>
          ))}
        </div>
      </div>

      {dbError && (
        <div className="m-4 p-3 bg-red-900 border border-red-700 rounded text-red-200 text-sm">
          Failed to load logs: {dbError}
        </div>
      )}

      {rows.length === 0 && !dbError && (
        <div className="m-4 p-8 text-center text-gray-500">
          No log entries recorded yet.
          {filterApp || filterLevel ? (
            <span>
              {' '}
              <Link href="/admin/logs" className="text-blue-400 hover:underline">
                Clear filters
              </Link>
            </span>
          ) : (
            ' Warn+ logs will appear here once the apps ship entries in production.'
          )}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-800">
            Showing {rows.length} entries
            {filterApp ? ` · app: ${filterApp}` : ''}
            {filterLevel ? ` · level: ${filterLevel}` : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-gray-400 text-left">
                  <th className="px-4 py-2 font-medium whitespace-nowrap">Time</th>
                  <th className="px-4 py-2 font-medium">Level</th>
                  <th className="px-4 py-2 font-medium">App</th>
                  <th className="px-4 py-2 font-medium">Req ID</th>
                  <th className="px-4 py-2 font-medium w-1/2">Message / Data</th>
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
                    <td className="px-4 py-2 text-gray-300 font-mono text-xs whitespace-nowrap">
                      {row.app}
                    </td>
                    <td className="px-4 py-2 text-gray-600 font-mono text-xs">
                      {row.requestId ? row.requestId.slice(0, 8) : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-200">
                      <div className="truncate max-w-xl" title={row.message}>
                        {row.message}
                      </div>
                      {!!row.data && (
                        <details className="mt-1">
                          <summary className="text-xs text-gray-500 cursor-pointer">
                            Context / data
                          </summary>
                          <pre className="mt-1 text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap bg-gray-900 p-2 rounded">
                            {JSON.stringify(row.data, null, 2)}
                          </pre>
                        </details>
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
  )
}
