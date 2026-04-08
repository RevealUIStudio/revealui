/**
 * SystemHealthPanel Component
 *
 * Displays system health status with individual health check details
 */

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
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusTextColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
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
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
        role="status"
        aria-live="polite"
        aria-label="Loading system health data"
        aria-busy="true"
      >
        <div className="animate-pulse">
          <div
            className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"
            data-skeleton="true"
          ></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" data-skeleton="true"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" data-skeleton="true"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" data-skeleton="true"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={ref}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="text-red-500">
          <h2 className="text-lg font-semibold mb-2">Error Loading Health Data</h2>
          <p className="mb-4">{error}</p>
          <button
            onClick={onRetry}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
            type="button"
            disabled={!onRetry}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data.checks).length === 0) {
    return (
      <div ref={ref} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">System Health</h2>
        <p className="text-gray-600 dark:text-gray-400">No health checks available</p>
      </div>
    );
  }

  return (
    <div ref={ref} className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System Health</h2>
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
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Last updated: {formatTimestamp(lastUpdated)}
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(data.checks).map(([name, check]) => (
          <button
            key={name}
            type="button"
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer w-full text-left"
            onClick={() => toggleCheck(name)}
            aria-expanded={expandedChecks[name]}
            aria-label={`${name} health check: ${check.status}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-2 h-2 rounded-full ${getStatusColor(check.status)}`}
                  aria-hidden="true"
                  data-testid={`status-${check.status}`}
                />
                <div className="flex items-center gap-2">
                  <span
                    className="font-medium text-gray-900 dark:text-white capitalize"
                    data-testid={`${name}-check-name`}
                  >
                    {name}
                  </span>
                  {check.latency !== undefined && (
                    <span
                      className="text-sm text-gray-600 dark:text-gray-400"
                      data-testid={`${name}-latency`}
                    >
                      ({check.latency} ms)
                    </span>
                  )}
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expandedChecks[name] ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            {expandedChecks[name] && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400">{check.message}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-500">
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
          </button>
        ))}
      </div>
    </div>
  );
}
