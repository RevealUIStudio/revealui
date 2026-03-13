/**
 * SystemHealthPanel Component Tests
 *
 * Tests for the system health monitoring panel
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type HealthData, SystemHealthPanel } from '../../lib/components/SystemHealthPanel';

describe('SystemHealthPanel', () => {
  const mockHealthData = {
    status: 'healthy' as const,
    checks: {
      database: {
        status: 'healthy' as const,
        latency: 15,
        message: 'Database is responding normally',
      },
      cache: {
        status: 'healthy' as const,
        latency: 5,
        message: 'Cache is operational',
      },
      storage: {
        status: 'healthy' as const,
        latency: 20,
        message: 'Storage is accessible',
      },
    },
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      expect(screen.getByText(/system health/i)).toBeInTheDocument();
    });

    it('should display overall status', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      expect(screen.getByText(/healthy/i)).toBeInTheDocument();
    });

    it('should render all health checks', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      expect(screen.getByText(/database/i)).toBeInTheDocument();
      expect(screen.getByText(/cache/i)).toBeInTheDocument();
      expect(screen.getByText(/storage/i)).toBeInTheDocument();
    });

    it('should display latency for each check', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      expect(screen.getByText(/\(15\s+ms\)/i)).toBeInTheDocument();
      expect(screen.getByText(/\(5\s+ms\)/i)).toBeInTheDocument();
      expect(screen.getByText(/\(20\s+ms\)/i)).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('should show healthy status with green indicator', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      const healthyIndicators = screen.getAllByTestId('status-healthy');
      expect(healthyIndicators.length).toBeGreaterThan(0);
    });

    it('should show warning status with yellow indicator', () => {
      const warningData = {
        ...mockHealthData,
        status: 'warning' as const,
        checks: {
          ...mockHealthData.checks,
          database: {
            ...mockHealthData.checks.database,
            status: 'warning' as const,
            latency: 150,
          },
        },
      };

      render(<SystemHealthPanel data={warningData} />);

      expect(screen.getByTestId('status-warning')).toBeInTheDocument();
    });

    it('should show critical status with red indicator', () => {
      const criticalData = {
        ...mockHealthData,
        status: 'critical' as const,
        checks: {
          ...mockHealthData.checks,
          database: {
            ...mockHealthData.checks.database,
            status: 'critical' as const,
            message: 'Database is down',
          },
        },
      };

      render(<SystemHealthPanel data={criticalData} />);

      expect(screen.getByTestId('status-critical')).toBeInTheDocument();
    });

    it('should display status messages', async () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      // Status messages are shown in expanded view
      const databaseCheck = screen.getByTestId('database-check-name');
      await act(async () => {
        await databaseCheck.click();
      });

      expect(screen.getByText(/database is responding normally/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading', () => {
      render(<SystemHealthPanel loading={true} />);

      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    });

    it('should not display data when loading', () => {
      render(<SystemHealthPanel data={mockHealthData} loading={true} />);

      expect(screen.queryByText(/database/i)).not.toBeInTheDocument();
    });

    it('should show skeleton UI when loading', () => {
      const { container } = render(<SystemHealthPanel loading={true} />);

      const skeletons = container.querySelectorAll('[data-skeleton="true"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('should display error message', () => {
      render(<SystemHealthPanel error="Failed to load health data" />);

      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    it('should show retry button on error', () => {
      render(<SystemHealthPanel error="Error" />);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should call onRetry when retry clicked', async () => {
      const onRetry = vi.fn();

      render(<SystemHealthPanel error="Error" onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await retryButton.click();

      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe('Auto-Refresh', () => {
    it('should refresh data at interval', async () => {
      vi.useFakeTimers();
      const onRefresh = vi.fn();

      render(
        <SystemHealthPanel data={mockHealthData} onRefresh={onRefresh} refreshInterval={5000} />,
      );

      // Fast-forward 5 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(onRefresh).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not refresh when refreshInterval is 0', async () => {
      vi.useFakeTimers();
      const onRefresh = vi.fn();

      render(<SystemHealthPanel data={mockHealthData} onRefresh={onRefresh} refreshInterval={0} />);

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(onRefresh).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should stop refreshing when unmounted', () => {
      vi.useFakeTimers();
      const onRefresh = vi.fn();

      const { unmount } = render(
        <SystemHealthPanel data={mockHealthData} onRefresh={onRefresh} refreshInterval={1000} />,
      );

      unmount();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(onRefresh).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Timestamp Display', () => {
    it('should show last updated timestamp', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      expect(screen.getByText(/last updated/i)).toBeInTheDocument();
    });

    it('should format timestamp as relative time', () => {
      const pastTime = Date.now() - 60000; // 1 minute ago

      render(<SystemHealthPanel data={{ ...mockHealthData, timestamp: pastTime }} />);

      expect(screen.getByText(/1 minute ago|a minute ago/i)).toBeInTheDocument();
    });

    it('should update timestamp on refresh', async () => {
      const { rerender } = render(<SystemHealthPanel data={mockHealthData} />);

      const newData = {
        ...mockHealthData,
        timestamp: Date.now(), // Current time (should show as seconds ago)
      };

      rerender(<SystemHealthPanel data={newData} />);

      await waitFor(() => {
        // Should show as "Xs ago" where X is a small number
        expect(screen.getByText(/\d+s ago/i)).toBeInTheDocument();
      });
    });
  });

  describe('Detailed View', () => {
    it('should expand to show details when clicked', async () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      const databaseCheck = screen.getByTestId('database-check-name');
      await act(async () => {
        await databaseCheck.click();
      });

      expect(screen.getByText(/database is responding normally/i)).toBeVisible();
    });

    it('should collapse details when clicked again', async () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      const databaseCheck = screen.getByTestId('database-check-name');

      // Expand
      await act(async () => {
        await databaseCheck.click();
      });
      expect(screen.getByText(/database is responding normally/i)).toBeVisible();

      // Collapse
      await act(async () => {
        await databaseCheck.click();
      });
      expect(screen.queryByText(/database is responding normally/i)).not.toBeInTheDocument();
    });

    it('should show technical details in expanded view', async () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      const databaseCheck = screen.getByTestId('database-check-name');
      await act(async () => {
        await databaseCheck.click();
      });

      // Check for the "Status:" label which only appears in expanded view
      expect(screen.getByText(/status:/i)).toBeInTheDocument();
      expect(screen.getByText(/latency:/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(/system health/i);
    });

    it('should have aria-labels for status indicators', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      const statusIndicators = screen.getAllByLabelText(/status/i);
      expect(statusIndicators.length).toBeGreaterThan(0);
    });

    it('should announce status changes to screen readers', () => {
      const { rerender } = render(<SystemHealthPanel data={mockHealthData} />);

      const criticalData = {
        ...mockHealthData,
        status: 'critical' as const,
      };

      rerender(<SystemHealthPanel data={criticalData} />);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<SystemHealthPanel data={mockHealthData} />);

      const interactiveElements = screen.getAllByRole('button');
      interactiveElements.forEach((element) => {
        expect(element).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty checks object', () => {
      const emptyData = {
        status: 'healthy' as const,
        checks: {},
        timestamp: Date.now(),
      };

      render(<SystemHealthPanel data={emptyData} />);

      expect(screen.getByText(/no health checks/i)).toBeInTheDocument();
    });

    it('should handle missing latency data', () => {
      const dataWithoutLatency = {
        ...mockHealthData,
        checks: {
          database: {
            status: 'healthy' as const,
            message: 'OK',
          },
        },
      };

      render(<SystemHealthPanel data={dataWithoutLatency as unknown as HealthData} />);

      expect(screen.queryByText(/ms/i)).not.toBeInTheDocument();
    });

    it('should handle very high latency values', () => {
      const highLatencyData = {
        ...mockHealthData,
        checks: {
          database: {
            status: 'warning' as const,
            latency: 5000,
            message: 'Slow response',
          },
        },
      };

      render(<SystemHealthPanel data={highLatencyData} />);

      expect(screen.getByText(/5000|5,000/)).toBeInTheDocument();
    });

    it('should handle missing status', () => {
      const noStatusData = {
        checks: mockHealthData.checks,
        timestamp: Date.now(),
      };

      render(<SystemHealthPanel data={noStatusData as unknown as HealthData} />);

      expect(screen.getByText(/unknown/i)).toBeInTheDocument();
    });
  });
});
