import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SyncPanel from '../../components/sync/SyncPanel';
import type { SyncResult } from '../../types';

const mockUseSync = vi.fn();

vi.mock('../../hooks/use-sync', () => ({
  useSync: () => mockUseSync(),
}));

vi.mock('../../components/sync/RepoCard', () => ({
  default: ({ result }: { result: SyncResult }) => (
    <div data-testid={`repo-${result.repo}`}>{result.repo}</div>
  ),
}));

vi.mock('../../components/sync/SyncLog', () => ({
  default: ({ entries }: { entries: string[] }) => (
    <div data-testid="sync-log">{entries.length} entries</div>
  ),
}));

describe('SyncPanel', () => {
  it('renders Repo Sync header and Sync All button', () => {
    mockUseSync.mockReturnValue({
      syncing: false,
      results: [],
      log: [],
      error: null,
      syncAll: vi.fn(),
      syncOne: vi.fn(),
    });

    render(<SyncPanel />);

    expect(screen.getByText('Repo Sync')).toBeInTheDocument();
    expect(screen.getByText('Sync All')).toBeInTheDocument();
  });

  it('shows empty state when no results and not syncing', () => {
    mockUseSync.mockReturnValue({
      syncing: false,
      results: [],
      log: [],
      error: null,
      syncAll: vi.fn(),
      syncOne: vi.fn(),
    });

    render(<SyncPanel />);

    expect(
      screen.getByText(/Click "Sync All" to fetch and sync all registered repos/),
    ).toBeInTheDocument();
  });

  it('renders repo cards when results exist', () => {
    const results: SyncResult[] = [
      { drive: 'C', repo: 'RevealUI', status: 'ok', branch: 'main' },
      { drive: 'E', repo: 'revealui-jv', status: 'dirty', branch: 'main' },
    ];

    mockUseSync.mockReturnValue({
      syncing: false,
      results,
      log: [],
      error: null,
      syncAll: vi.fn(),
      syncOne: vi.fn(),
    });

    render(<SyncPanel />);

    expect(screen.getByTestId('repo-RevealUI')).toBeInTheDocument();
    expect(screen.getByTestId('repo-revealui-jv')).toBeInTheDocument();
  });

  it('calls syncAll when Sync All button is clicked', () => {
    const syncAll = vi.fn();
    mockUseSync.mockReturnValue({
      syncing: false,
      results: [],
      log: [],
      error: null,
      syncAll,
      syncOne: vi.fn(),
    });

    render(<SyncPanel />);

    fireEvent.click(screen.getByText('Sync All'));
    expect(syncAll).toHaveBeenCalledOnce();
  });

  it('shows sync log when entries exist', () => {
    mockUseSync.mockReturnValue({
      syncing: false,
      results: [],
      log: ['Syncing...', 'Done'],
      error: null,
      syncAll: vi.fn(),
      syncOne: vi.fn(),
    });

    render(<SyncPanel />);

    expect(screen.getByTestId('sync-log')).toBeInTheDocument();
  });
});
