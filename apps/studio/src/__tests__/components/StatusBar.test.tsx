import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusBar from '../../components/layout/StatusBar';
import type { StatusContextValue } from '../../hooks/use-status';
import { StatusContext } from '../../hooks/use-status';

function renderWithStatusContext(value: StatusContextValue) {
  return render(
    <StatusContext.Provider value={value}>
      <StatusBar />
    </StatusContext.Provider>,
  );
}

const mockRefresh = vi.fn().mockResolvedValue(undefined);

describe('StatusBar', () => {
  it('shows pulsing "Connecting..." when loading', () => {
    renderWithStatusContext({
      system: null,
      mount: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    renderWithStatusContext({
      system: null,
      mount: null,
      loading: false,
      error: 'Failed to connect to WSL',
      refresh: mockRefresh,
    });
    expect(screen.getByText('Failed to connect to WSL')).toBeInTheDocument();
  });

  it('truncates long error messages', () => {
    const longError = 'A'.repeat(80);
    renderWithStatusContext({
      system: null,
      mount: null,
      loading: false,
      error: longError,
      refresh: mockRefresh,
    });
    expect(screen.getByText(`${'A'.repeat(60)}...`)).toBeInTheDocument();
  });

  it('shows WSL Running when wsl_running is true', () => {
    renderWithStatusContext({
      system: {
        wsl_running: true,
        distribution: 'Ubuntu-24.04',
        tier: 'pro',
        systemd_status: 'running',
      },
      mount: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByText('WSL Running')).toBeInTheDocument();
  });

  it('shows WSL Stopped when wsl_running is false', () => {
    renderWithStatusContext({
      system: {
        wsl_running: false,
        distribution: 'Ubuntu-24.04',
        tier: 'pro',
        systemd_status: 'stopped',
      },
      mount: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByText('WSL Stopped')).toBeInTheDocument();
  });

  it('shows tier information', () => {
    renderWithStatusContext({
      system: {
        wsl_running: true,
        distribution: 'Ubuntu-24.04',
        tier: 'pro',
        systemd_status: 'running',
      },
      mount: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByText('Tier: pro')).toBeInTheDocument();
  });

  it('shows systemd status when available', () => {
    renderWithStatusContext({
      system: {
        wsl_running: true,
        distribution: 'Ubuntu-24.04',
        tier: 'pro',
        systemd_status: 'running',
      },
      mount: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByText('systemd: running')).toBeInTheDocument();
  });

  it('shows Studio: Mounted when mounted', () => {
    renderWithStatusContext({
      system: {
        wsl_running: true,
        distribution: 'Ubuntu-24.04',
        tier: 'pro',
        systemd_status: 'running',
      },
      mount: {
        mounted: true,
        mount_point: '/mnt/wsl-dev',
        device: '/dev/sdc',
        size_total: '1T',
        size_used: '500G',
        size_available: '500G',
        use_percent: '50%',
      },
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByText('Studio: Mounted')).toBeInTheDocument();
  });

  it('shows Studio: Not Mounted when not mounted', () => {
    renderWithStatusContext({
      system: {
        wsl_running: true,
        distribution: 'Ubuntu-24.04',
        tier: 'pro',
        systemd_status: 'running',
      },
      mount: {
        mounted: false,
        mount_point: '/mnt/wsl-dev',
        device: null,
        size_total: null,
        size_used: null,
        size_available: null,
        use_percent: null,
      },
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByText('Studio: Not Mounted')).toBeInTheDocument();
  });

  it('shows "?" for tier when system is null and not loading', () => {
    renderWithStatusContext({
      system: null,
      mount: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByText('Tier: ?')).toBeInTheDocument();
  });

  it('calls refresh when refresh button is clicked', () => {
    mockRefresh.mockClear();
    renderWithStatusContext({
      system: null,
      mount: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('renders refresh button in all states', () => {
    renderWithStatusContext({
      system: null,
      mount: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
    });
    expect(screen.getByRole('button', { name: 'Refresh status' })).toBeInTheDocument();
  });
});
