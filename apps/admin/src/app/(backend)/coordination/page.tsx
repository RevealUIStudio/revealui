'use client';

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

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400',
  ended: 'bg-zinc-600/20 text-zinc-300',
  crashed: 'bg-red-500/10 text-red-400',
};

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

  const displayed = scope === 'active' ? sessions.filter((s) => s.status === 'active') : sessions;

  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const staleCount = sessions.filter(isStaleSession).length;
  const uniqueAgents = new Set(sessions.map((s) => s.agent_id)).size;

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <h1 className="text-xl font-semibold text-white">Active Agents</h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          Coordination sessions across the agent fleet. Daemons running with{' '}
          <code className="font-mono text-xs">POSTGRES_URL</code> set dual-write to{' '}
          <code className="font-mono text-xs">coordination_sessions</code>; this surface reads from
          there.
        </p>
      </div>

      {/* Stat row */}
      <div className="overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-6 py-3">
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
      <div className="border-b border-zinc-800 bg-zinc-950 px-6">
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
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
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
                className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-800/40 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-5 w-16 rounded-full bg-zinc-700" />
                  <div className="h-4 flex-1 rounded bg-zinc-700/60" />
                  <div className="h-3 w-32 rounded bg-zinc-700/40" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400"
          >
            {error.message}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState scope={scope} />
        ) : (
          <>
            <div className="mb-3 text-xs text-zinc-500">
              Showing {displayed.length} of {sessions.length} session
              {sessions.length === 1 ? '' : 's'}
            </div>
            <div className="flex flex-col gap-2">
              {displayed.map((session) => (
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
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    zinc: 'text-zinc-400',
    amber: 'text-amber-400',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-semibold ${colors[color]}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'bg-zinc-700/20 text-zinc-400';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
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

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 transition-colors hover:border-zinc-700">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={session.status} />
          <span className="truncate font-mono text-sm text-zinc-300">{session.agent_id}</span>
          <span className="ml-auto shrink-0 text-xs text-zinc-500">
            {truncate(session.task, 60)}
          </span>
          <span className="hidden shrink-0 font-mono text-xs text-zinc-600 sm:inline">
            {formatAge(age)}
          </span>
          {stale && (
            <span
              title="Session has not ended after 7+ days — likely a stale row"
              className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400"
            >
              stale
            </span>
          )}
          <ChevronIcon expanded={expanded} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3">
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
              <div className="col-span-full border-t border-zinc-800 pt-3">
                <h4 className="mb-1 text-xs font-medium text-zinc-500">Tool counters</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(session.tools).map(([tool, n]) => (
                    <span
                      key={tool}
                      className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-xs text-zinc-400"
                    >
                      {tool}: {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-zinc-600">{label}: </span>
      <span className={`text-xs text-zinc-400 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function EmptyState({ scope }: { scope: Scope }) {
  const message =
    scope === 'active'
      ? 'No active coordination sessions. The daemon writes here when started with POSTGRES_URL set; sessions appear within seconds of session.register.'
      : 'No coordination sessions found. Either no daemons have run with POSTGRES_URL set, or all sessions have ended.';

  return (
    <div className="flex flex-col items-center py-16">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
        <svg
          className="h-6 w-6 text-zinc-500"
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
      </div>
      <p className="max-w-md text-center text-sm text-zinc-500">{message}</p>
    </div>
  );
}
