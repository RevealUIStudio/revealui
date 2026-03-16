import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SshBookmarkSidebar from '../../components/terminal/SshBookmarkSidebar';
import type { SshBookmark } from '../../types';

const mockBookmarks: SshBookmark[] = [
  {
    id: '1',
    label: 'Dev Server',
    host: '192.168.1.100',
    port: 22,
    username: 'dev',
    auth_method: 'key',
    key_path: '~/.ssh/id_ed25519',
  },
  {
    id: '2',
    label: 'Prod Server',
    host: '10.0.0.1',
    port: 2222,
    username: 'admin',
    auth_method: 'password',
    key_path: null,
  },
];

vi.mock('../../lib/invoke', () => ({
  sshBookmarkList: vi.fn().mockResolvedValue([]),
  sshBookmarkSave: vi.fn().mockResolvedValue(undefined),
  sshBookmarkDelete: vi.fn().mockResolvedValue(undefined),
}));

const invoke = await import('../../lib/invoke');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SshBookmarkSidebar', () => {
  it('renders bookmark list', async () => {
    vi.mocked(invoke.sshBookmarkList).mockResolvedValue(mockBookmarks);

    render(<SshBookmarkSidebar onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Dev Server')).toBeInTheDocument();
    });
    expect(screen.getByText('Prod Server')).toBeInTheDocument();
  });

  it('renders connect and delete buttons for each bookmark', async () => {
    vi.mocked(invoke.sshBookmarkList).mockResolvedValue(mockBookmarks);

    render(<SshBookmarkSidebar onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('Connect')).toHaveLength(2);
    });
    expect(screen.getAllByText('Delete')).toHaveLength(2);
  });

  it('calls onSelect when Connect is clicked', async () => {
    vi.mocked(invoke.sshBookmarkList).mockResolvedValue(mockBookmarks);
    const onSelect = vi.fn();

    render(<SshBookmarkSidebar onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getAllByText('Connect')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByText('Connect')[0]);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '192.168.1.100',
        port: 22,
        username: 'dev',
      }),
    );
  });

  it('calls sshBookmarkDelete when Delete is clicked', async () => {
    vi.mocked(invoke.sshBookmarkList).mockResolvedValue(mockBookmarks);

    render(<SshBookmarkSidebar onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('Delete')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByText('Delete')[0]);
    await waitFor(() => {
      expect(invoke.sshBookmarkDelete).toHaveBeenCalledWith('1');
    });
  });

  it('shows add bookmark form when Add is clicked', async () => {
    vi.mocked(invoke.sshBookmarkList).mockResolvedValue([]);

    render(<SshBookmarkSidebar onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByLabelText('Host')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByText('Save Bookmark')).toBeInTheDocument();
  });

  it('shows empty state when no bookmarks', async () => {
    vi.mocked(invoke.sshBookmarkList).mockResolvedValue([]);

    render(<SshBookmarkSidebar onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No saved bookmarks.')).toBeInTheDocument();
    });
  });

  it('displays host and user info for each bookmark', async () => {
    vi.mocked(invoke.sshBookmarkList).mockResolvedValue(mockBookmarks);

    render(<SshBookmarkSidebar onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('dev@192.168.1.100:22')).toBeInTheDocument();
    });
    expect(screen.getByText('admin@10.0.0.1:2222')).toBeInTheDocument();
  });
});
