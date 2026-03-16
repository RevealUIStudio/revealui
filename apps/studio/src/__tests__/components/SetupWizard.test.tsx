import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SetupWizard from '../../components/setup/SetupWizard';

vi.mock('../../hooks/use-setup', () => ({
  useSetup: vi.fn().mockReturnValue({
    status: null,
    loading: true,
    error: null,
    refresh: vi.fn(),
  }),
  markSetupComplete: vi.fn(),
}));

vi.mock('../../components/setup/SetupRows', () => ({
  WslRow: () => <div data-testid="wsl-row" />,
  NixRow: () => <div data-testid="nix-row" />,
  DevPodRow: () => <div data-testid="devpod-row" />,
  GitIdentityRow: () => <div data-testid="git-row" />,
  VaultRow: () => <div data-testid="vault-row" />,
  TailscaleRow: () => <div data-testid="tailscale-row" />,
  ProjectSetupRow: () => <div data-testid="project-row" />,
}));

const { useSetup, markSetupComplete } = await import('../../hooks/use-setup');

describe('SetupWizard', () => {
  it('renders modal with title', () => {
    render(<SetupWizard onClose={vi.fn()} />);

    expect(screen.getByText('Setup RevealUI Studio')).toBeInTheDocument();
  });

  it('shows loading text when checking environment', () => {
    render(<SetupWizard onClose={vi.fn()} />);

    expect(screen.getByText('Checking environment...')).toBeInTheDocument();
  });

  it('renders all setup rows', () => {
    render(<SetupWizard onClose={vi.fn()} />);

    expect(screen.getByTestId('wsl-row')).toBeInTheDocument();
    expect(screen.getByTestId('nix-row')).toBeInTheDocument();
    expect(screen.getByTestId('devpod-row')).toBeInTheDocument();
    expect(screen.getByTestId('git-row')).toBeInTheDocument();
    expect(screen.getByTestId('vault-row')).toBeInTheDocument();
    expect(screen.getByTestId('tailscale-row')).toBeInTheDocument();
    expect(screen.getByTestId('project-row')).toBeInTheDocument();
  });

  it('Complete Setup button is disabled when not all checks pass', () => {
    vi.mocked(useSetup).mockReturnValue({
      status: {
        wsl_running: true,
        nix_installed: false,
        devbox_mounted: false,
        git_name: '',
        git_email: '',
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<SetupWizard onClose={vi.fn()} />);

    expect(screen.getByText('Complete Setup')).toBeDisabled();
  });

  it('Complete Setup button is enabled when all checks pass', () => {
    vi.mocked(useSetup).mockReturnValue({
      status: {
        wsl_running: true,
        nix_installed: true,
        devbox_mounted: true,
        git_name: 'RevealUI Studio',
        git_email: 'founder@revealui.com',
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<SetupWizard onClose={vi.fn()} />);

    expect(screen.getByText('Complete Setup')).not.toBeDisabled();
  });

  it('calls markSetupComplete and onClose when Complete Setup is clicked', () => {
    const onClose = vi.fn();
    vi.mocked(useSetup).mockReturnValue({
      status: {
        wsl_running: true,
        nix_installed: true,
        devbox_mounted: true,
        git_name: 'RevealUI Studio',
        git_email: 'founder@revealui.com',
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<SetupWizard onClose={onClose} />);

    fireEvent.click(screen.getByText('Complete Setup'));
    expect(markSetupComplete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Skip is clicked', () => {
    const onClose = vi.fn();
    render(<SetupWizard onClose={onClose} />);

    fireEvent.click(screen.getByText('Skip'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
