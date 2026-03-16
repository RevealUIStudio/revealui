import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('../../lib/invoke', () => ({
  vaultInit: vi.fn().mockResolvedValue(undefined),
  vaultIsInitialized: vi.fn().mockResolvedValue(true),
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

import {
  DevPodRow,
  GitIdentityRow,
  NixRow,
  ProjectSetupRow,
  SetupRow,
  TailscaleRow,
  VaultRow,
  WslRow,
} from '../../components/setup/SetupRows';

describe('SetupRow', () => {
  it('renders label', () => {
    render(<SetupRow label="WSL" done={false} doneText="Running" pendingText="Not detected" />);
    expect(screen.getByText('WSL')).toBeInTheDocument();
  });

  it('shows doneText when done', () => {
    render(<SetupRow label="WSL" done={true} doneText="Running" pendingText="Not detected" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('shows pendingText when not done', () => {
    render(<SetupRow label="WSL" done={false} doneText="Running" pendingText="Not detected" />);
    expect(screen.getByText('Not detected')).toBeInTheDocument();
  });

  it('renders action slot when provided', () => {
    render(
      <SetupRow
        label="Nix"
        done={false}
        doneText="Installed"
        pendingText="Not found"
        action={<button type="button">Install</button>}
      />,
    );
    expect(screen.getByText('Install')).toBeInTheDocument();
  });
});

describe('WslRow', () => {
  it('shows "Ubuntu running" when WSL is running', () => {
    const setup = createMockSetup({ wsl_running: true });
    render(<WslRow setup={setup} />);
    expect(screen.getByText('Ubuntu running')).toBeInTheDocument();
  });

  it('shows pending text when WSL is not running', () => {
    const setup = createMockSetup({ wsl_running: false });
    render(<WslRow setup={setup} />);
    expect(screen.getByText(/WSL not detected/)).toBeInTheDocument();
  });
});

describe('NixRow', () => {
  it('shows "Nix installed" when nix is installed', () => {
    const setup = createMockSetup({ nix_installed: true });
    render(<NixRow setup={setup} />);
    expect(screen.getByText('Nix installed')).toBeInTheDocument();
  });

  it('shows install button when nix is not installed', () => {
    const setup = createMockSetup({ nix_installed: false });
    render(<NixRow setup={setup} />);
    expect(screen.getByText(/Install Nix/)).toBeInTheDocument();
  });
});

describe('DevPodRow', () => {
  it('shows "Studio drive mounted" when mounted', () => {
    const setup = createMockSetup({ devbox_mounted: true });
    render(<DevPodRow setup={setup} />);
    expect(screen.getByText('Studio drive mounted')).toBeInTheDocument();
  });

  it('shows Mount button when not mounted', () => {
    const setup = createMockSetup({ devbox_mounted: false });
    render(<DevPodRow setup={setup} />);
    expect(screen.getByText('Mount')).toBeInTheDocument();
  });
});

describe('GitIdentityRow', () => {
  it('renders git name and email inputs', () => {
    const setup = createMockSetup({});
    render(<GitIdentityRow setup={setup} />);
    expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
  });

  it('renders Save Git Config button', () => {
    const setup = createMockSetup({});
    render(<GitIdentityRow setup={setup} />);
    expect(screen.getByText('Save Git Config')).toBeInTheDocument();
  });

  it('disables Save when name is empty', () => {
    const setup = createMockSetup({});
    setup.gitName = '';
    setup.gitEmail = 'test@test.com';
    render(<GitIdentityRow setup={setup} />);
    expect(screen.getByText('Save Git Config').closest('button')).toBeDisabled();
  });
});

describe('VaultRow', () => {
  it('renders Vault label', () => {
    render(<VaultRow />);
    expect(screen.getByText('Vault')).toBeInTheDocument();
  });
});

describe('TailscaleRow', () => {
  it('renders Tailscale label', () => {
    render(<TailscaleRow />);
    expect(screen.getByText('Tailscale')).toBeInTheDocument();
  });
});

describe('ProjectSetupRow', () => {
  it('renders Project Setup label', () => {
    render(<ProjectSetupRow />);
    expect(screen.getByText('Project Setup')).toBeInTheDocument();
  });

  it('shows setup command when not done', () => {
    localStorage.removeItem('revealui_project_setup_done');
    render(<ProjectSetupRow />);
    expect(screen.getByText('pnpm setup:env')).toBeInTheDocument();
  });

  it('shows Mark done button when not done', () => {
    localStorage.removeItem('revealui_project_setup_done');
    render(<ProjectSetupRow />);
    expect(screen.getByText('Mark done')).toBeInTheDocument();
  });

  it('marks as done when Mark done is clicked', () => {
    localStorage.removeItem('revealui_project_setup_done');
    render(<ProjectSetupRow />);
    fireEvent.click(screen.getByText('Mark done'));
    expect(screen.getByText('Environment variables configured.')).toBeInTheDocument();
  });
});

// Helper to create a mock setup hook return value
function createMockSetup(
  statusOverrides: Partial<{
    wsl_running: boolean;
    nix_installed: boolean;
    devbox_mounted: boolean;
    git_name: string;
    git_email: string;
  }>,
) {
  return {
    status: {
      wsl_running: false,
      nix_installed: false,
      devbox_mounted: false,
      git_name: '',
      git_email: '',
      ...statusOverrides,
    },
    loading: false,
    error: null,
    gitName: 'Test User',
    gitEmail: 'test@test.com',
    saving: false,
    mounting: false,
    refresh: vi.fn(),
    saveGitIdentity: vi.fn(),
    doMount: vi.fn(),
    setGitName: vi.fn(),
    setGitEmail: vi.fn(),
  };
}
