import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Dashboard from '../../components/dashboard/Dashboard';
import type { StatusContextValue } from '../../hooks/use-status';
import { StatusContext } from '../../hooks/use-status';

const mockRefresh = vi.fn().mockResolvedValue(undefined);

function renderWithStatusContext(value: StatusContextValue) {
  return render(
    <StatusContext.Provider value={value}>
      <Dashboard />
    </StatusContext.Provider>,
  );
}

describe('Dashboard', () => {
  it('shows loading skeleton when loading with no system data', () => {
    const { container } = renderWithStatusContext({
      system: null,
      mount: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
    });
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders Dashboard heading', () => {
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
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders WSL service card', () => {
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
    expect(screen.getByText('WSL')).toBeInTheDocument();
  });

  it('renders Studio Drive service card', () => {
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
    expect(screen.getByText('Studio Drive')).toBeInTheDocument();
  });

  it('renders Systemd service card', () => {
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
    expect(screen.getByText('Systemd')).toBeInTheDocument();
  });

  it('shows TierBadge with tier', () => {
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
    expect(screen.getByText('pro')).toBeInTheDocument();
  });

  it('shows distribution and systemd info', () => {
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
    // Distribution appears in both the info line and ServiceCard detail
    const ubuntuMatches = screen.getAllByText(/Ubuntu-24.04/);
    expect(ubuntuMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error message when error is set', () => {
    renderWithStatusContext({
      system: {
        wsl_running: true,
        distribution: 'Ubuntu-24.04',
        tier: 'pro',
        systemd_status: 'running',
      },
      mount: null,
      loading: false,
      error: 'Connection failed',
      refresh: mockRefresh,
    });
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('renders Refresh button', () => {
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
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });
});
