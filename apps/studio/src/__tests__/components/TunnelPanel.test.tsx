import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/use-tunnel', () => ({
  useTunnel: vi.fn().mockReturnValue({
    status: null,
    loading: true,
    error: null,
    toggling: false,
    up: vi.fn(),
    down: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import TunnelPanel from '../../components/tunnel/TunnelPanel';
import { useTunnel } from '../../hooks/use-tunnel';

describe('TunnelPanel', () => {
  it('shows skeleton when loading with no status', () => {
    const { container } = render(<TunnelPanel />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders "Tunnel" heading when loaded', () => {
    vi.mocked(useTunnel).mockReturnValue({
      status: { running: false, ip: null, hostname: null, peers: [] },
      loading: false,
      error: null,
      toggling: false,
      up: vi.fn(),
      down: vi.fn(),
      refresh: vi.fn(),
    });
    render(<TunnelPanel />);
    expect(screen.getByText('Tunnel')).toBeInTheDocument();
  });

  it('shows "Disconnected" when not running', () => {
    vi.mocked(useTunnel).mockReturnValue({
      status: { running: false, ip: null, hostname: null, peers: [] },
      loading: false,
      error: null,
      toggling: false,
      up: vi.fn(),
      down: vi.fn(),
      refresh: vi.fn(),
    });
    render(<TunnelPanel />);
    expect(screen.getByText('Tailscale Disconnected')).toBeInTheDocument();
  });

  it('shows "Connected" with IP when running', () => {
    vi.mocked(useTunnel).mockReturnValue({
      status: { running: true, ip: '100.64.0.1', hostname: 'devbox', peers: [] },
      loading: false,
      error: null,
      toggling: false,
      up: vi.fn(),
      down: vi.fn(),
      refresh: vi.fn(),
    });
    render(<TunnelPanel />);
    expect(screen.getByText('Tailscale Connected')).toBeInTheDocument();
    expect(screen.getByText('100.64.0.1')).toBeInTheDocument();
    expect(screen.getByText('devbox')).toBeInTheDocument();
  });

  it('renders Connect and Disconnect buttons', () => {
    vi.mocked(useTunnel).mockReturnValue({
      status: { running: false, ip: null, hostname: null, peers: [] },
      loading: false,
      error: null,
      toggling: false,
      up: vi.fn(),
      down: vi.fn(),
      refresh: vi.fn(),
    });
    render(<TunnelPanel />);
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('shows peers when available', () => {
    vi.mocked(useTunnel).mockReturnValue({
      status: {
        running: true,
        ip: '100.64.0.1',
        hostname: 'devbox',
        peers: [
          { hostname: 'windows-pc', ip: '100.64.0.2', online: true, os: 'windows' },
          { hostname: 'macbook', ip: '100.64.0.3', online: false, os: 'macOS' },
        ],
      },
      loading: false,
      error: null,
      toggling: false,
      up: vi.fn(),
      down: vi.fn(),
      refresh: vi.fn(),
    });
    render(<TunnelPanel />);
    expect(screen.getByText('Peers (2)')).toBeInTheDocument();
    expect(screen.getByText('windows-pc')).toBeInTheDocument();
    expect(screen.getByText('macbook')).toBeInTheDocument();
  });

  it('shows "No peers connected" when running with empty peers', () => {
    vi.mocked(useTunnel).mockReturnValue({
      status: { running: true, ip: '100.64.0.1', hostname: 'devbox', peers: [] },
      loading: false,
      error: null,
      toggling: false,
      up: vi.fn(),
      down: vi.fn(),
      refresh: vi.fn(),
    });
    render(<TunnelPanel />);
    expect(screen.getByText('No peers connected.')).toBeInTheDocument();
  });

  it('shows error when error is set', () => {
    vi.mocked(useTunnel).mockReturnValue({
      status: { running: false, ip: null, hostname: null, peers: [] },
      loading: false,
      error: 'Tailscale error',
      toggling: false,
      up: vi.fn(),
      down: vi.fn(),
      refresh: vi.fn(),
    });
    render(<TunnelPanel />);
    expect(screen.getByText('Tailscale error')).toBeInTheDocument();
  });
});
