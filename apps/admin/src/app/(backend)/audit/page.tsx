'use client';

import {
  Badge,
  Callout,
  CodeBlock,
  EmptyState,
  Heading,
  LinkButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@revealui/presentation';
import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface AuditEntry {
  id: string;
  timestamp: string;
  severity: string;
  eventType: string;
  agentId: string;
  payload: Record<string, unknown> | null;
  policyViolations: string[];
}

interface PaginatedResponse {
  success: boolean;
  data: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface State {
  rows: AuditEntry[];
  total: number;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; rows: AuditEntry[]; total: number }
  | { type: 'FETCH_ERROR'; error: string };

const initialState: State = {
  rows: [],
  total: 0,
  loading: true,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, rows: action.rows, total: action.total };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
  }
}

// =============================================================================
// Constants
// =============================================================================

/** Legacy placeholder actor — never show as a principal (server also excludes). */
const LEGACY_ANONYMOUS_ACTOR_ID = 'anonymous';

const SEVERITIES = ['info', 'warn', 'critical'] as const;

type SeverityBadgeColor = 'muted' | 'warning' | 'danger';

const SEVERITY_BADGE_COLOR: Record<string, SeverityBadgeColor> = {
  info: 'muted',
  low: 'muted',
  warn: 'warning',
  medium: 'warning',
  critical: 'danger',
  high: 'danger',
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

function formatApiError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const err = (body as { error?: unknown }).error;
    if (typeof err === 'string' && err.trim()) return err;
    if (err && typeof err === 'object') {
      try {
        return JSON.stringify(err);
      } catch {
        // fall through
      }
    }
    const code = (body as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) {
      return `Request failed (${status}, ${code})`;
    }
  }
  return `Failed to load audit log (${status})`;
}

// =============================================================================
// Page
// =============================================================================

export default function AuditPage() {
  return (
    <LicenseGate feature="dashboard">
      <AuditDashboard />
    </LicenseGate>
  );
}

function AuditDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { rows, total, loading, error } = state;

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const filterSeverity = SEVERITIES.includes(
    searchParams.get('severity') as (typeof SEVERITIES)[number],
  )
    ? searchParams.get('severity')
    : undefined;
  const filterActor = searchParams.get('actor') || searchParams.get('agent') || undefined;
  // Must stay within PaginationQuery max (100) on /api/admin/audit — higher
  // values produce a validation error and a blank trail UI.
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 100);

  useEffect(() => {
    let cancelled = false;

    async function fetchAudit() {
      dispatch({ type: 'FETCH_START' });
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', '0');
        if (filterSeverity) params.set('severity', filterSeverity);
        if (filterActor) params.set('agentId', filterActor);

        const res = await fetch(`${apiUrl}/api/admin/audit?${params.toString()}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => null);
          throw new Error(formatApiError(body, res.status));
        }
        const data = (await res.json()) as PaginatedResponse;
        if (!cancelled) {
          // Defense in depth: never render the legacy anonymous placeholder.
          const principals = data.data.filter((row) => row.agentId !== LEGACY_ANONYMOUS_ACTOR_ID);
          dispatch({
            type: 'FETCH_SUCCESS',
            rows: principals,
            total: Math.max(0, data.total - (data.data.length - principals.length)),
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          dispatch({
            type: 'FETCH_ERROR',
            error: e instanceof Error ? e.message : 'Unable to load audit log.',
          });
        }
      }
    }

    void fetchAudit();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, filterSeverity, filterActor, limit]);

  function filterUrl(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const next = { severity: filterSeverity, actor: filterActor, ...overrides };
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `/audit${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-6 py-4">
        <div>
          <Heading level={1} className="text-xl/8 sm:text-xl/8">
            Audit Trail
          </Heading>
          <Text className="mt-0.5 text-sm text-muted-foreground">
            Receipts for users, agents, and system principals
          </Text>
        </div>

        <nav className="ml-auto flex flex-wrap items-center gap-1" aria-label="Severity filter">
          <LinkButton
            href={filterUrl({ severity: undefined })}
            appearance={filterSeverity ? 'ghost' : 'solid'}
            variant={filterSeverity ? 'neutral' : 'brand'}
            size="sm"
          >
            All
          </LinkButton>
          {SEVERITIES.map((s) => {
            const active = filterSeverity === s;
            return (
              <LinkButton
                key={s}
                href={filterUrl({ severity: s })}
                appearance={active ? 'solid' : 'ghost'}
                variant={active ? 'brand' : 'neutral'}
                size="sm"
                className="uppercase"
              >
                {s}
              </LinkButton>
            );
          })}
        </nav>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading audit log">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <Callout variant="error" title="Failed to load audit log" role="alert">
            {error}
          </Callout>
        )}

        {!(loading || error) && rows.length === 0 && (
          <EmptyState
            title="No receipts yet"
            description={
              filterSeverity || filterActor
                ? 'No entries match the current filters.'
                : 'Receipts appear here when users, agents, or system principals act.'
            }
            action={
              filterSeverity || filterActor ? (
                <LinkButton href="/audit" appearance="outline" variant="neutral" size="sm">
                  Clear filters
                </LinkButton>
              ) : undefined
            }
          />
        )}

        {rows.length > 0 && (
          <div className="flex flex-col gap-3">
            <Text className="text-xs text-muted-foreground">
              Showing {rows.length} of {total} entries
              {filterSeverity ? ` · severity: ${filterSeverity}` : ''}
              {filterActor ? ` · actor: ${filterActor}` : ''}
            </Text>

            <Table dense striped>
              <TableHead>
                <TableRow>
                  <TableHeader>Time</TableHeader>
                  <TableHeader>Severity</TableHeader>
                  <TableHeader>Event</TableHeader>
                  <TableHeader>Actor</TableHeader>
                  <TableHeader>Payload</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const hasPayload =
                    row.payload &&
                    typeof row.payload === 'object' &&
                    Object.keys(row.payload).length > 0;
                  return (
                    <TableRow key={row.id} className="align-top">
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatTime(new Date(row.timestamp))}
                      </TableCell>
                      <TableCell>
                        <Badge color={SEVERITY_BADGE_COLOR[row.severity] ?? 'muted'}>
                          {row.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {row.eventType}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        <LinkButton
                          href={filterUrl({ actor: row.agentId })}
                          appearance="link"
                          variant="neutral"
                          size="sm"
                          className="h-auto px-0 font-mono text-xs text-muted-foreground hover:text-primary"
                        >
                          {row.agentId}
                        </LinkButton>
                      </TableCell>
                      <TableCell className="min-w-48 max-w-md whitespace-normal">
                        {hasPayload ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              Payload
                            </summary>
                            <div className="mt-2">
                              <CodeBlock
                                code={JSON.stringify(row.payload, null, 2)}
                                language="json"
                                showCopy
                                className="text-xs"
                              />
                            </div>
                          </details>
                        ) : null}
                        {row.policyViolations.length > 0 && (
                          <Text className="mt-1 text-xs text-error">
                            Violations: {row.policyViolations.join(', ')}
                          </Text>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
