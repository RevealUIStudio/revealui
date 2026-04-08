import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('../../lib/invoke', () => ({
  readAppLog: vi.fn().mockResolvedValue('[mock] log output'),
}));

import AppCard from '../../components/apps/AppCard';
import type { AppStatus } from '../../types';

const RUNNING_APP: AppStatus = {
  app: {
    name: 'api',
    display_name: 'API',
    port: 3004,
    url: 'http://localhost:3004',
  },
  running: true,
};

const STOPPED_APP: AppStatus = {
  app: {
    name: 'admin',
    display_name: 'Admin',
    port: 4000,
    url: 'http://localhost:4000',
  },
  running: false,
};

describe('AppCard', () => {
  it('renders app display name', () => {
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('API')).toBeInTheDocument();
  });

  it('renders port number', () => {
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText(':3004')).toBeInTheDocument();
  });

  it('shows running status text when running', () => {
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Running on localhost:3004')).toBeInTheDocument();
  });

  it('shows Stopped status text when not running', () => {
    render(<AppCard status={STOPPED_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('shows Starting... when operating and not running', () => {
    render(<AppCard status={STOPPED_APP} isOperating={true} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  it('shows Stopping... when operating and running', () => {
    render(<AppCard status={RUNNING_APP} isOperating={true} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Stopping...')).toBeInTheDocument();
  });

  it('shows Open, Stop, and Logs buttons when running', () => {
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('shows Start button when stopped', () => {
    render(<AppCard status={STOPPED_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.queryByText('Stop')).not.toBeInTheDocument();
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('calls onStart when Start is clicked', () => {
    const onStart = vi.fn();
    render(<AppCard status={STOPPED_APP} isOperating={false} onStart={onStart} onStop={vi.fn()} />);
    fireEvent.click(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('calls onStop when Stop is clicked', () => {
    const onStop = vi.fn();
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={onStop} />);
    fireEvent.click(screen.getByText('Stop'));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('opens URL when Open is clicked', async () => {
    const { open } = await import('@tauri-apps/plugin-shell');
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);
    fireEvent.click(screen.getByText('Open'));
    expect(open).toHaveBeenCalledWith('http://localhost:3004');
  });

  it('toggles log visibility', () => {
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);
    fireEvent.click(screen.getByText('Logs'));
    expect(screen.getByText('Hide Logs')).toBeInTheDocument();
  });
});
