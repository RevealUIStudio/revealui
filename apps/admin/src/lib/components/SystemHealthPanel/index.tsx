/**
 * SystemHealthPanel Component
 *
 * Displays system health status with individual health check details
 */

import { Button, IconChevronDown } from '@revealui/presentation';
import type React from 'react';
import { useEffect, useState } from 'react';

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export interface HealthCheck {
  status: HealthStatus;
  latency: number;
  message: string;
}

export interface HealthData {
  status: HealthStatus;
  checks: Record<string, HealthCheck>;
  timestamp: number;
}

export interface SystemHealthPanelProps {
  data?: HealthData;
  refreshInterval?: number;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

export function SystemHealthPanel({
  data,
  refreshInterval,
  onRefresh,
  loading,
  error,
  onRetry,
  className = '',
  ref,
}: SystemHealthPanelProps & { ref?: React.Ref<HTMLDivElement> }) {
  const [expandedChecks, setExpandedChecks] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const toggleCheck = (name: string) => {
    setExpandedChecks((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!(refreshInterval && onRefresh) || loading || error) {
      return;
    }

    const interval = setInterval(() => {
      onRefresh();
      setLastUpdated(Date.now());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, onRefresh, loading, error]);

  // Update last updated when data changes
  useEffect(() => {
    if (data?.timestamp) {
      setLastUpdated(data.timestamp);
    }
  }, [data?.timestamp]);

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return 'bg-success';
      case 'warning':
        return 'bg-warning';
      case 'critical':
        return 'bg-error';
      default:
        return 'bg-muted';
    }
  };

  const getStatusTextColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return 'text-success';
      case 'warning':
        return 'text-warning-foreground';
      case 'critical':
        return 'text-error';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  };

  if (loading) {
    return (
      <div
        ref={ref}
        className={`bg-card rounded-lg shadow p-6 ${className}`}
        role="status"
        aria-live="polite"
        aria-label="Loading system health data"
        aria-busy="true"
      >
        <div className="animate-pulse">
          <div className="h-6 bg-foreground/10 rounded w-1/3 mb-4" data-skeleton="true"></div>
          <div className="space-y-3">
            <div className="h-16 bg-foreground/10 rounded" data-skeleton="true"></div>
            <div className="h-16 bg-foreground/10 rounded" data-skeleton="true"></div>
            <div className="h-16 bg-foreground/10 rounded" data-skeleton="true"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={ref}
        className={`bg-card rounded-lg shadow p-6 ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="text-error">
          <h2 className="text-lg font-semibold mb-2">Error Loading Health Data</h2>
          <p className="mb-4">{error}</p>
          <Button type="button" variant="danger" onClick={onRetry} disabled={!onRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data.checks).length === 0) {
    return (
      <div ref={ref} className={`bg-card rounded-lg shadow p-6 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">System Health</h2>
        <p className="text-muted-foreground">No health checks available</p>
      </div>
    );
  }

  return (
    <div ref={ref} className={`bg-card rounded-lg shadow p-6 ${className}`}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">System Health</h2>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${getStatusTextColor(data.status || 'healthy')}`}
              role="status"
              aria-label={`Overall system status: ${data.status || 'unknown'}`}
            >
              {data.status ? data.status.charAt(0).toUpperCase() + data.status.slice(1) : 'Unknown'}
            </span>
            <div
              className={`w-3 h-3 rounded-full ${getStatusColor(data.status || 'healthy')}`}
              aria-hidden="true"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Last updated: {formatTimestamp(lastUpdated)}
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(data.checks).map(([name, check]) => (
          <Button
            key={name}
            type="button"
            appearance="ghost"
            variant="neutral"
            className="h-auto w-full cursor-pointer justify-start rounded-lg border border-border p-4 text-left hover:bg-muted"
            onClick={() => toggleCheck(name)}
            aria-expanded={expandedChecks[name]}
            aria-label={`${name} health check: ${check.status}`}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-1 items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${getStatusColor(check.status)}`}
                  aria-hidden="true"
                  data-testid={`status-${check.status}`}
                />
                <div className="flex items-center gap-2">
                  <span
                    className="font-medium capitalize text-foreground"
                    data-testid={`${name}-check-name`}
                  >
                    {name}
                  </span>
                  {check.latency !== undefined && (
                    <span className="text-sm text-muted-foreground" data-testid={`${name}-latency`}>
                      ({check.latency} ms)
                    </span>
                  )}
                </div>
              </div>
              <IconChevronDown
                size="md"
                className={`text-muted-foreground transition-transform ${expandedChecks[name] ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </div>

            {expandedChecks[name] && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">{check.message}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Status:</span> {check.status}
                  </div>
                  {check.latency !== undefined && (
                    <div>
                      <span className="font-medium">Latency:</span> {check.latency} ms
                    </div>
                  )}
                </div>
              </div>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
