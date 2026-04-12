import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Dashboard from '../../components/dashboard/Dashboard';
import type { AuthContextValue } from '../../hooks/use-auth';
import { AuthContext } from '../../hooks/use-auth';
import { SettingsContext } from '../../hooks/use-settings';
import type { StatusContextValue } from '../../hooks/use-status';
import { StatusContext } from '../../hooks/use-status';

// Mock billing API to prevent fetch calls from useSubscription
vi.mock('../../lib/billing-api', () => ({
  fetchSubscription: vi.fn().mockResolvedValue({
    tier: 'pro',
    status: 'active',
    expiresAt: null,
    licenseKey: null,
  }),
  fetchUsage: vi.fn().mockResolvedValue({
    used: 10,
    quota: 100,
    overage: 0,
    cycleStart: '2026-03-01',
    resetAt: '2026-04-01',
  }),
}));

// Mock @solana/kit to prevent window reference errors during jsdom teardown
vi.mock('@solana/kit', () => ({
  address: vi.fn((s: string) => s),
  createSolanaRpc: vi.fn(() => ({ getTokenAccountsByOwner: vi.fn() })),
}));

const mockRefresh = vi.fn().mockResolvedValue(undefined);

const defaultSettings = {
  settings: {
    theme: 'system' as const,
    apiUrl: 'http://localhost:3004',
    pollingIntervalMs: 30_000,
    solanaWalletAddress: '',
    solanaNetwork: 'devnet' as const,
  },
  updateSettings: vi.fn(),
  resetSettings: vi.fn(),
};

const defaultAuth: AuthContextValue = {
  step: 'authenticated',
  user: { id: '1', email: 'test@example.com', name: 'Test', role: 'admin' },
  tokenExpiresAt: null,
  loading: false,
  error: null,
  sendOtp: vi.fn().mockResolvedValue(true),
  submitOtp: vi.fn().mockResolvedValue(true),
  signOut: vi.fn().mockResolvedValue(undefined),
  recheck: vi.fn().mockResolvedValue(undefined),
  getToken: vi.fn().mockReturnValue('mock-token'),
};

function renderWithStatusContext(value: StatusContextValue) {
  return render(
    <AuthContext.Provider value={defaultAuth}>
      <SettingsContext.Provider value={defaultSettings}>
        <StatusContext.Provider value={value}>
          <Dashboard />
        </StatusContext.Provider>
      </SettingsContext.Provider>
    </AuthContext.Provider>,
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
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
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
