/**
 * HealthCard  -  Shows production API health status from /health/ready.
 *
 * Displays overall status (healthy/degraded/unhealthy/unreachable)
 * and individual check results (database, memory, etc.).
 */

import { useHealth } from '../../hooks/use-health';
import type { HealthCheck } from '../../lib/health-api';
import StatusDot from '../ui/StatusDot';

const STATUS_MAP = {
  healthy: { dot: 'ok', label: 'Healthy', color: 'text-emerald-400' },
  degraded: { dot: 'warn', label: 'Degraded', color: 'text-amber-400' },
  unhealthy: { dot: 'error', label: 'Unhealthy', color: 'text-red-400' },
  unreachable: { dot: 'off', label: 'Unreachable', color: 'text-neutral-500' },
} as const;

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function normalizeChecks(
  checks: Record<string, HealthCheck> | HealthCheck[] | undefined,
): HealthCheck[] {
  if (!checks) return [];
  if (Array.isArray(checks)) return checks;
  return Object.entries(checks).map(([name, check]) => ({
    ...check,
    name: check.name ?? name,
  }));
}

export default function HealthCard() {
  const { health, reachable, loading } = useHealth();

  if (loading && !health) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="h-5 w-20 animate-pulse rounded bg-neutral-800" />
        <div className="mt-3 h-4 w-32 animate-pulse rounded bg-neutral-800" />
      </div>
    );
  }

  const status = !reachable ? 'unreachable' : (health?.status ?? 'unreachable');
  const info = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? STATUS_MAP.unreachable;
  const checks = normalizeChecks(health?.checks);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-2">
        <StatusDot status={info.dot as 'ok' | 'warn' | 'error' | 'off'} size="md" />
        <h3 className="text-sm font-medium text-neutral-200">API Health</h3>
      </div>

      <p className={`mt-2 text-xs font-medium ${info.color}`}>{info.label}</p>

      {health?.uptime != null ? (
        <p className="mt-0.5 text-xs text-neutral-500">Uptime: {formatUptime(health.uptime)}</p>
      ) : null}

      {checks.length > 0 ? (
        <div className="mt-2 space-y-1">
          {checks.map((check) => (
            <div key={check.name} className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">{check.name}</span>
              <span
                className={
                  check.status === 'healthy'
                    ? 'text-emerald-400'
                    : check.status === 'degraded'
                      ? 'text-amber-400'
                      : 'text-red-400'
                }
              >
                {check.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
