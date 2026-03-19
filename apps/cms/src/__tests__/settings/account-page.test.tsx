import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Override the global useSearchParams mock for these tests
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/settings/account',
  useSearchParams: () => mockSearchParams,
}));

// Mock presentation Dialog components to render inline (avoids portal/transition complexity)
vi.mock('@revealui/presentation/client', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    size?: string;
    children: React.ReactNode;
  }) => (open ? <div data-testid="confirm-dialog">{children}</div> : null),
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Must import AFTER the mock
import AccountSettingsPage from '../../app/(backend)/admin/settings/account/page';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location for OAuth redirect
const mockLocation = { href: '' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock window.history.replaceState
const mockReplaceState = vi.fn();
window.history.replaceState = mockReplaceState;

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  hasPassword: true,
  linkedProviders: [
    { provider: 'github', email: 'test@github.com', name: 'testuser' as string | null },
  ],
};

function mockFetchSuccess(user = mockUser) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ user }),
  });
}

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
    // Reset search params
    for (const key of [...mockSearchParams.keys()]) {
      mockSearchParams.delete(key);
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading skeleton initially', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}), // never resolves
    });

    render(<AccountSettingsPage />);
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('fetches and displays user profile', async () => {
    mockFetchSuccess();

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Set')).toBeInTheDocument();
  });

  it('shows "Not set" when user has no password', async () => {
    mockFetchSuccess({
      ...mockUser,
      hasPassword: false,
      linkedProviders: [
        { provider: 'github', email: 'test@github.com', name: 'testuser' },
        { provider: 'google', email: 'test@google.com', name: null as string | null },
      ],
    });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Not set')).toBeInTheDocument();
    });
  });

  it('shows linked provider with email', async () => {
    mockFetchSuccess();

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/test@github\.com/)).toBeInTheDocument();
    });
    expect(screen.getByText('Unlink')).toBeInTheDocument();
  });

  it('shows "Link" button for unlinked providers', async () => {
    mockFetchSuccess();

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    // Google and Vercel are not linked
    const linkButtons = screen.getAllByText('Link');
    expect(linkButtons).toHaveLength(2);
  });

  it('redirects to OAuth provider on link click', async () => {
    mockFetchSuccess();

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    const linkButtons = screen.getAllByText('Link');
    await act(async () => {
      fireEvent.click(linkButtons[0]!);
    });

    expect(mockLocation.href).toContain('/api/auth/link/google');
    expect(mockLocation.href).toContain('redirectTo=');
  });

  it('shows confirmation dialog before unlinking', async () => {
    mockFetchSuccess();

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument();
    });

    // Click Unlink to open the confirmation dialog
    await act(async () => {
      fireEvent.click(screen.getByText('Unlink'));
    });

    // Dialog should appear with provider name and description
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Unlink GitHub?')).toBeInTheDocument();
    expect(
      screen.getByText("You'll no longer be able to sign in with this account."),
    ).toBeInTheDocument();

    // Click Cancel to dismiss
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    // Dialog should close, API should NOT have been called beyond initial fetch
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1); // only the initial /api/auth/me
  });

  it('calls unlink API when confirmed via dialog', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { ...mockUser, linkedProviders: [] } }),
      });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument();
    });

    // Open confirm dialog
    await act(async () => {
      fireEvent.click(screen.getByText('Unlink'));
    });

    // Click the confirm "Unlink" button inside the dialog
    const dialog = screen.getByTestId('confirm-dialog');
    const confirmButton = dialog.querySelector('button.bg-red-600') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/unlink',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ provider: 'github' }),
        }),
      );
    });
  });

  it('shows success message after unlinking', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { ...mockUser, linkedProviders: [] } }),
      });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument();
    });

    // Open confirm dialog and confirm
    await act(async () => {
      fireEvent.click(screen.getByText('Unlink'));
    });
    const dialog = screen.getByTestId('confirm-dialog');
    const confirmButton = dialog.querySelector('button.bg-red-600') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(screen.getByText('GitHub account unlinked.')).toBeInTheDocument();
    });
  });

  it('shows error when unlink fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot unlink your only sign-in method.' }),
      });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument();
    });

    // Open confirm dialog and confirm
    await act(async () => {
      fireEvent.click(screen.getByText('Unlink'));
    });
    const dialog = screen.getByTestId('confirm-dialog');
    const confirmButton = dialog.querySelector('button.bg-red-600') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Cannot unlink your only sign-in method.')).toBeInTheDocument();
    });
  });

  it('shows lockout warning when no password and only one linked provider', async () => {
    mockFetchSuccess({
      ...mockUser,
      hasPassword: false,
      linkedProviders: [{ provider: 'github', email: 'test@github.com', name: 'testuser' }],
    });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Unlinking your only connected account will lock you out/),
      ).toBeInTheDocument();
    });
  });

  it('shows critical warning when no password and no linked providers', async () => {
    mockFetchSuccess({
      ...mockUser,
      hasPassword: false,
      linkedProviders: [],
    });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no password and no linked accounts/)).toBeInTheDocument();
    });
  });

  it('does not show lockout warning when password is set', async () => {
    mockFetchSuccess({
      ...mockUser,
      hasPassword: true,
      linkedProviders: [{ provider: 'github', email: 'test@github.com', name: 'testuser' }],
    });

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Unlinking your only connected account/)).not.toBeInTheDocument();
  });

  it('shows success banner on OAuth link redirect', async () => {
    mockSearchParams.set('linked', 'github');
    mockFetchSuccess();

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('GitHub account linked successfully.')).toBeInTheDocument();
    });

    expect(mockReplaceState).toHaveBeenCalledWith(null, '', '/admin/settings/account');
  });

  it('shows error banner from OAuth error redirect', async () => {
    mockSearchParams.set('error', 'invalid_state');
    mockFetchSuccess();

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('invalid_state')).toBeInTheDocument();
    });
  });

  it('handles network error on unlink', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument();
    });

    // Open confirm dialog and confirm
    await act(async () => {
      fireEvent.click(screen.getByText('Unlink'));
    });
    const dialog = screen.getByTestId('confirm-dialog');
    const confirmButton = dialog.querySelector('button.bg-red-600') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Unable to reach the server. Please check your connection and try again.'),
      ).toBeInTheDocument();
    });
  });

  it('shows "Unlinking..." during unlink request', async () => {
    let resolveUnlink!: (value: unknown) => void;
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUnlink = resolve;
          }),
      );

    render(<AccountSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument();
    });

    // Open confirm dialog and confirm
    await act(async () => {
      fireEvent.click(screen.getByText('Unlink'));
    });
    const dialog = screen.getByTestId('confirm-dialog');
    const confirmButton = dialog.querySelector('button.bg-red-600') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Unlinking...')).toBeInTheDocument();
    });

    // Resolve to clean up
    await act(async () => {
      resolveUnlink({ ok: true, json: () => Promise.resolve({ success: true }) });
    });
  });
});
