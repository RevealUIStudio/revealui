'use client';

import type { HealthMetrics, TrackedProcess } from '@revealui/core/monitoring';
import { useEffect, useState } from 'react';

interface HealthPanelProps {
  /** Polling interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Show detailed process list */
  showProcessList?: boolean;
}

export function SystemHealthMonitor({
  pollInterval = 5000,
  showProcessList = true,
}: HealthPanelProps) {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [processes, setProcesses] = useState<TrackedProcess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [staleness, setStaleness] = useState(0);

  // Fetch health metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/health-monitoring');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as HealthMetrics;
        setMetrics(data);
        setError(null);
        setLastUpdated(Date.now());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(
          `Unable to load health metrics. ${message}. Contact support@revealui.com if this persists.`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    void fetchMetrics();

    // Set up polling
    const interval = setInterval(() => {
      void fetchMetrics();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval]);

  // Fetch process list if enabled
  useEffect(() => {
    if (!showProcessList) return;

    const fetchProcesses = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedStatus !== 'all') params.set('status', selectedStatus);
        if (selectedSource !== 'all') params.set('source', selectedSource);
        params.set('limit', '50');

        const response = await fetch(`/api/health-monitoring/processes?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as { processes: TrackedProcess[] };
        setProcesses(data.processes);
      } catch {
        // Silently fail - processes list is non-critical
        // Component continues to function without process list
      }
    };

    void fetchProcesses();

    const interval = setInterval(() => {
      void fetchProcesses();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval, showProcessList, selectedSource, selectedStatus]);

  // Staleness ticker  -  updates every second
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      setStaleness(Math.floor((Date.now() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return 'text-success';
      case 'completed':
        return 'text-primary';
      case 'failed':
        return 'text-error';
      case 'zombie':
        return 'text-warning-foreground';
      case 'killed':
        return 'text-warning-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const getAlertIcon = (level: string): string => {
    return level === 'critical' ? '🔴' : '⚠️';
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p>Loading health metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-error">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="font-medium">Health monitoring unavailable</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with staleness */}
      {lastUpdated && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">System Health</span>
          <span
            className={`text-xs ${
              staleness > 30
                ? 'text-error'
                : staleness > 10
                  ? 'text-warning-foreground'
                  : 'text-muted-foreground'
            }`}
          >
            {staleness > 30
              ? `Connection may be lost (${staleness}s ago)`
              : `Updated ${staleness}s ago`}
          </span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* System Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-card rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Memory</div>
              <div className="text-xl font-semibold text-foreground">
                {metrics.system.memoryUsage}MB
              </div>
            </div>
            <div className="bg-card rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">CPU</div>
              <div className="text-xl font-semibold text-foreground">
                {metrics.system.cpuUsage.toFixed(1)}%
              </div>
            </div>
            <div className="bg-card rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Uptime</div>
              <div className="text-xl font-semibold text-foreground">
                {formatUptime(metrics.system.uptime)}
              </div>
            </div>
            <div className="bg-card rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Processes</div>
              <div className="text-xl font-semibold text-foreground">
                {metrics.processes.active}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {metrics.alerts.length > 0 && (
            <div className="bg-card rounded-lg p-4">
              <h3 className="text-foreground font-medium mb-3 flex items-center gap-2">
                <span>Active Alerts</span>
                <span className="bg-error text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {metrics.alerts.length}
                </span>
              </h3>
              <div className="space-y-2">
                {metrics.alerts.map((alert) => (
                  <div
                    key={`alert-${alert.timestamp}-${alert.level}-${alert.message}`}
                    className={`p-3 rounded ${
                      alert.level === 'critical'
                        ? 'bg-error/10 border border-error/30'
                        : 'bg-warning/15 border border-warning/30'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{getAlertIcon(alert.level)}</span>
                      <div className="flex-1">
                        <p className="text-foreground text-sm">{alert.message}</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          {formatTimestamp(alert.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Statistics */}
          <div className="bg-card rounded-lg p-4">
            <h3 className="text-foreground font-medium mb-3">Process Statistics</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Processes:</span>
                <span className="text-success font-medium">{metrics.processes.active}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zombies:</span>
                <span
                  className={
                    metrics.processes.zombies > 0
                      ? 'text-warning-foreground font-medium'
                      : 'text-muted-foreground'
                  }
                >
                  {metrics.processes.zombies}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Failed:</span>
                <span
                  className={
                    metrics.processes.failed > 0
                      ? 'text-error font-medium'
                      : 'text-muted-foreground'
                  }
                >
                  {metrics.processes.failed}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Spawn Rate:</span>
                <span className="text-primary font-medium">{metrics.processes.spawnRate}/min</span>
              </div>
            </div>

            {/* Process by Source */}
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-foreground text-sm font-medium mb-2">By Source</h4>
              <div className="space-y-2">
                {Object.entries(metrics.processes.bySource).map(([source, count]) => {
                  if (count === 0) return null;
                  return (
                    <div key={source} className="flex items-center gap-2">
                      <div className="flex-1 bg-foreground/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${(count / metrics.processes.active) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground w-20 text-right">
                        {source}: {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Database Pools */}
          {(metrics.database.rest.length > 0 || metrics.database.vector.length > 0) && (
            <div className="bg-card rounded-lg p-4">
              <h3 className="text-foreground font-medium mb-3">Database Pools</h3>
              <div className="space-y-3">
                {metrics.database.rest.map((pool) => (
                  <div key={pool.name} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">REST: {pool.name}</span>
                      <span className="text-foreground">
                        {pool.totalCount - pool.idleCount}/{pool.totalCount} active
                      </span>
                    </div>
                    {pool.waitingCount > 0 && (
                      <div className="text-warning-foreground text-xs">
                        {pool.waitingCount} waiting
                      </div>
                    )}
                  </div>
                ))}
                {metrics.database.vector.map((pool) => (
                  <div key={pool.name} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Vector: {pool.name}</span>
                      <span className="text-foreground">
                        {pool.totalCount - pool.idleCount}/{pool.totalCount} active
                      </span>
                    </div>
                    {pool.waitingCount > 0 && (
                      <div className="text-warning-foreground text-xs">
                        {pool.waitingCount} waiting
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process List */}
          {showProcessList && (
            <div className="bg-card rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-foreground font-medium">Recent Processes</h3>
                <div className="flex gap-2">
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="bg-muted text-foreground text-xs rounded px-2 py-1 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">All Sources</option>
                    <option value="exec">Exec</option>
                    <option value="mcp">MCP</option>
                    <option value="orchestration">Orchestration</option>
                    <option value="ai-runtime">AI Runtime</option>
                    <option value="dev-server">Dev Server</option>
                  </select>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-muted text-foreground text-xs rounded px-2 py-1 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">All Status</option>
                    <option value="running">Running</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="zombie">Zombie</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground font-medium py-2 px-2">PID</th>
                      <th className="text-left text-muted-foreground font-medium py-2 px-2">
                        Command
                      </th>
                      <th className="text-left text-muted-foreground font-medium py-2 px-2">
                        Source
                      </th>
                      <th className="text-left text-muted-foreground font-medium py-2 px-2">
                        Status
                      </th>
                      <th className="text-left text-muted-foreground font-medium py-2 px-2">
                        Started
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted-foreground py-4">
                          No processes found
                        </td>
                      </tr>
                    ) : (
                      processes.map((process) => (
                        <tr key={process.pid} className="border-b border-border hover:bg-muted">
                          <td className="py-2 px-2 text-muted-foreground">{process.pid}</td>
                          <td className="py-2 px-2 text-muted-foreground truncate max-w-xs">
                            {process.command} {process.args.slice(0, 2).join(' ')}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">{process.source}</td>
                          <td className={`py-2 px-2 ${getStatusColor(process.status)}`}>
                            {process.status}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">
                            {formatTimestamp(process.startTime)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Zombies */}
          {metrics.recentZombies.length > 0 && (
            <div className="bg-card rounded-lg p-4">
              <h3 className="text-foreground font-medium mb-3">Recent Zombie Processes</h3>
              <div className="space-y-2">
                {metrics.recentZombies.slice(0, 5).map((zombie, index) => (
                  <div
                    key={zombie.pid || `zombie-${index}`}
                    className="flex justify-between text-sm bg-warning/15 border border-warning/30 rounded p-2"
                  >
                    <div>
                      <span className="text-warning-foreground font-medium">PID {zombie.pid}</span>
                      <span className="text-muted-foreground ml-2">{zombie.command}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatTimestamp(zombie.detectedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
