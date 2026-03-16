import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/use-setup', () => ({
  useSetup: vi.fn().mockReturnValue({
    status: {
      wsl_running: true,
      nix_installed: false,
      devbox_mounted: false,
      git_name: '',
      git_email: '',
    },
    loading: false,
    error: null,
    gitName: '',
    gitEmail: '',
    saving: false,
    mounting: false,
    refresh: vi.fn(),
    saveGitIdentity: vi.fn(),
    doMount: vi.fn(),
    setGitName: vi.fn(),
    setGitEmail: vi.fn(),
  }),
}));

vi.mock('../../hooks/use-tunnel', () => ({
  useTunnel: vi.fn().mockReturnValue({
    status: null,
    loading: false,
    error: null,
    toggling: false,
    up: vi.fn(),
    down: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('../../lib/invoke', () => ({
  vaultInit: vi.fn(),
  vaultIsInitialized: vi.fn().mockResolvedValue(false),
}));

import SetupPage from '../../components/setup/SetupPage';

describe('SetupPage', () => {
  it('renders "Setup" heading', () => {
    render(<SetupPage />);
    expect(screen.getByText('Setup')).toBeInTheDocument();
  });

  it('renders Refresh button', () => {
    render(<SetupPage />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('renders all setup rows', () => {
    render(<SetupPage />);
    expect(screen.getByText('WSL')).toBeInTheDocument();
    expect(screen.getByText('Nix')).toBeInTheDocument();
    expect(screen.getByText('DevPod')).toBeInTheDocument();
    expect(screen.getByText('Git Identity')).toBeInTheDocument();
    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.getByText('Tailscale')).toBeInTheDocument();
    expect(screen.getByText('Project Setup')).toBeInTheDocument();
  });
});
