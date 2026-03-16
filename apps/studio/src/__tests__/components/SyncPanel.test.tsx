import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/use-sync', () => ({
  useSync: vi.fn().mockReturnValue({
    syncing: false,
    results: [],
    log: [],
    error: null,
    syncAll: vi.fn(),
    syncOne: vi.fn(),
  }),
}));

import SyncPanel from '../../components/sync/SyncPanel';
import { useSync } from '../../hooks/use-sync';

describe('SyncPanel', () => {
  it('renders "Repo Sync" heading', () => {
    render(<SyncPanel />);
    expect(screen.getByText('Repo Sync')).toBeInTheDocument();
  });

  it('renders "Sync All" button', () => {
    render(<SyncPanel />);
    expect(screen.getByText('Sync All')).toBeInTheDocument();
  });

  it('shows empty state message when no results and not syncing', () => {
    render(<SyncPanel />);
    expect(
      screen.getByText(/Click "Sync All" to fetch and sync all registered repos/),
    ).toBeInTheDocument();
  });

  it('shows repo cards when results exist', () => {
    vi.mocked(useSync).mockReturnValue({
      syncing: false,
      results: [
        { drive: 'C', repo: 'RevealUI', status: 'ok', branch: 'main' },
        { drive: 'E', repo: 'revealui-jv', status: 'dirty', branch: 'main' },
      ],
      log: [],
      error: null,
      syncAll: vi.fn(),
      syncOne: vi.fn(),
    });
    render(<SyncPanel />);
    expect(screen.getByText('RevealUI')).toBeInTheDocument();
    expect(screen.getByText('revealui-jv')).toBeInTheDocument();
  });

  it('shows sync log when entries exist', () => {
    vi.mocked(useSync).mockReturnValue({
      syncing: false,
      results: [],
      log: ['Syncing...', 'Done'],
      error: null,
      syncAll: vi.fn(),
      syncOne: vi.fn(),
    });
    render(<SyncPanel />);
    expect(screen.getByText('Sync Log')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows error when error is set', () => {
    vi.mocked(useSync).mockReturnValue({
      syncing: false,
      results: [],
      log: [],
      error: 'Sync failed',
      syncAll: vi.fn(),
      syncOne: vi.fn(),
    });
    render(<SyncPanel />);
    expect(screen.getByText('Sync failed')).toBeInTheDocument();
  });
});
