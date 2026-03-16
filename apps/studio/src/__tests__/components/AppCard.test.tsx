import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppCard from '../../components/apps/AppCard';
import type { AppStatus } from '../../types';

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('../../lib/invoke', () => ({
  readAppLog: vi.fn().mockResolvedValue('[mock log output]'),
}));

const RUNNING_APP: AppStatus = {
  app: { name: 'api', display_name: 'API', port: 3004, url: 'http://localhost:3004' },
  running: true,
};

const STOPPED_APP: AppStatus = {
  app: { name: 'cms', display_name: 'CMS', port: 4000, url: 'http://localhost:4000' },
  running: false,
};

describe('AppCard', () => {
  it('renders app name and port', () => {
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText(':3004')).toBeInTheDocument();
  });

  it('shows running status text when running', () => {
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('Running on localhost:3004')).toBeInTheDocument();
  });

  it('shows stopped status when not running', () => {
    render(<AppCard status={STOPPED_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('shows Start button when stopped', () => {
    const onStart = vi.fn();
    render(<AppCard status={STOPPED_APP} isOperating={false} onStart={onStart} onStop={vi.fn()} />);

    const startButton = screen.getByText('Start');
    expect(startButton).toBeInTheDocument();
    fireEvent.click(startButton);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('shows Open, Stop, and Logs buttons when running', () => {
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('calls onStop when Stop button is clicked', () => {
    const onStop = vi.fn();
    render(<AppCard status={RUNNING_APP} isOperating={false} onStart={vi.fn()} onStop={onStop} />);

    fireEvent.click(screen.getByText('Stop'));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('shows Starting... when operating and not running', () => {
    render(<AppCard status={STOPPED_APP} isOperating={true} onStart={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  it('shows Stopping... when operating and running', () => {
    render(<AppCard status={RUNNING_APP} isOperating={true} onStart={vi.fn()} onStop={vi.fn()} />);

    expect(screen.getByText('Stopping...')).toBeInTheDocument();
  });
});
