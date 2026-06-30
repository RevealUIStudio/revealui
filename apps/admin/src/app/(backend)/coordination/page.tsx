'use client';

import { Badge, Card, EmptyState, Skeleton } from '@revealui/presentation';
import type { CoordinationSessionRecord } from '@revealui/sync';
import { useCoordinationSessions } from '@revealui/sync';
import { useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

type Scope = 'active' | 'all';

// Seven days in milliseconds — sessions older than this without an end are stale
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function ageSeconds(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}

function isStaleSession(record: CoordinationSessionRecord): boolean {
  if (record.status !== 'active') return false;
  return Date.now() - new Date(record.started_at).getTime() > STALE_THRESHOLD_MS;
}

// =============================================================================
// Helpers
// =============================================================================

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

// =============================================================================
// Page
// =============================================================================

export default function CoordinationPage() {
  return (
    <LicenseGate feature="dashboard">
      <CoordinationDashboard />
    </LicenseGate>
  );
}

function CoordinationDashboard() {
  const { sessions, isLoading, error } = useCoordinationSessions();
  const [scope, setScope] = useState<Scope>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const displayed =
    scope === 'active'
      ? sessions.filter((s: CoordinationSessionRecord) => s.status === 'active')
      : sessions;

  const activeCount = sessions.filter(
    (s: CoordinationSessionRecord) => s.status === 'active',
  ).length;
  const staleCount = sessions.filter(isStaleSession).length;
  const uniqueAgents = new Set(sessions.map((s: CoordinationSessionRecord) => s.agent_id)).size;

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Active Agents</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Coordination sessions across the agent fleet. Daemons running with{' '}
          <code className="font-mono text-xs">POSTGRES_URL</code> set dual-write to{' '}
          <code className="font-mono text-xs">coordination_sessions</code>; this surface reads from
          there.
        </p>
      </div>

      {/* Stat row */}
      <div className="overflow-x-auto border-b border-border bg-muted px-6 py-3">
        <div className="flex min-w-max gap-6">
          <StatPill label="Active" value={activeCount} color="emerald" />
          <StatPill label="Total Agents" value={uniqueAgents} color="blue" />
          <StatPill
            label="Stale (>7d)"
            value={staleCount}
            color={staleCount > 0 ? 'amber' : 'zinc'}
          />
        </div>
      </div>

      {/* Filter row */}
      <div className="border-b border-border bg-muted px-6">
        <nav className="flex min-w-max gap-1 -mb-px" aria-label="Scope filter">
          {(['active', 'all'] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setScope(s);
                setExpandedId(null);
              }}
              className={`border-b-2 px-4 py-3 text-sm font-medium capitalize transition-colors ${
                scope === s
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'active' ? 'Active only' : 'All sessions'}
              {s === 'active' && activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading && sessions.length === 0 ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading sessions">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders
                key={i}
                className="rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error"
          >
            {error.message}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="h-6 w-6 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            }
            title={scope === 'active' ? 'No active sessions' : 'No sessions found'}
            description={
              scope === 'active'
                ? 'No active coordination sessions. The daemon writes here when started with POSTGRES_URL set; sessions appear within seconds of session.register.'
                : 'No coordination sessions found. Either no daemons have run with POSTGRES_URL set, or all sessions have ended.'
            }
          />
        ) : (
          <>
            <div className="mb-3 text-xs text-muted-foreground">
              Showing {displayed.length} of {sessions.length} session
              {sessions.length === 1 ? '' : 's'}
            </div>
            <div className="flex flex-col gap-2">
              {displayed.map((session: CoordinationSessionRecord) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  expanded={expandedId === session.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === session.id ? null : session.id))
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'blue' | 'zinc' | 'amber';
}) {
  const colors = {
    emerald: 'text-success',
    blue: 'text-primary',
    zinc: 'text-muted-foreground',
    amber: 'text-warning-foreground',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-semibold ${colors[color]}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function SessionRow({
  session,
  expanded,
  onToggle,
}: {
  session: CoordinationSessionRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const age = ageSeconds(session.started_at);
  const stale = isStaleSession(session);

  const statusColor = (status: string) => {
    if (status === 'active') return 'success' as const;
    if (status === 'ended') return 'muted' as const;
    if (status === 'crashed') return 'danger' as const;
    return 'muted' as const;
  };

  return (
    <Card className="hover:border-ring transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <Badge color={statusColor(session.status)}>{session.status}</Badge>
          <span className="truncate font-mono text-sm text-muted-foreground">
            {session.agent_id}
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {truncate(session.task, 60)}
          </span>
          <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
            {formatAge(age)}
          </span>
          {stale && (
            <Badge color="warning" title="Session has not ended after 7+ days — likely a stale row">
              stale
            </Badge>
          )}
          <ChevronIcon expanded={expanded} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <div className="grid gap-4 text-sm lg:grid-cols-2">
            <MetaField label="Session ID" value={session.id} mono />
            <MetaField label="Agent ID" value={session.agent_id} mono />
            <MetaField label="Status" value={session.status} />
            <MetaField label="PID" value={session.pid?.toString() ?? '—'} />
            <MetaField label="Age" value={formatAge(age)} />
            <MetaField label="Started" value={formatTimestamp(session.started_at)} />
            <MetaField label="Ended" value={formatTimestamp(session.ended_at)} />
            <MetaField label="Task" value={session.task} />

            {session.tools && Object.keys(session.tools).length > 0 && (
              <div className="col-span-full border-t border-border pt-3">
                <h4 className="mb-1 text-xs font-medium text-muted-foreground">Tool counters</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(session.tools).map(([tool, n]) => (
                    <Badge key={tool} color="muted">
                      <span className="font-mono">
                        {tool}: {n}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function MetaField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className={`text-xs text-muted-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
