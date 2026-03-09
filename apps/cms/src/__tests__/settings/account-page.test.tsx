import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Override the global useSearchParams mock for these tests
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/settings/account',
  useSearchParams: () => mockSearchParams,
}))

// Must import AFTER the mock
import AccountSettingsPage from '../../app/(backend)/admin/settings/account/page'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window.confirm
const mockConfirm = vi.fn()
global.confirm = mockConfirm

// Mock window.location for OAuth redirect
const mockLocation = { href: '' }
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
})

// Mock window.history.replaceState
const mockReplaceState = vi.fn()
window.history.replaceState = mockReplaceState

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  hasPassword: true,
  linkedProviders: [
    { provider: 'github', email: 'test@github.com', name: 'testuser' as string | null },
  ],
}

function mockFetchSuccess(user = mockUser) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ user }),
  })
}

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.href = ''
    // Reset search params
    for (const key of [...mockSearchParams.keys()]) {
      mockSearchParams.delete(key)
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('renders loading skeleton initially', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}), // never resolves
    })

    render(<AccountSettingsPage />)
    const pulseElements = document.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('fetches and displays user profile', async () => {
    mockFetchSuccess()

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('Set')).toBeInTheDocument()
  })

  it('shows "Not set" when user has no password', async () => {
    mockFetchSuccess({
      ...mockUser,
      hasPassword: false,
      linkedProviders: [
        { provider: 'github', email: 'test@github.com', name: 'testuser' },
        { provider: 'google', email: 'test@google.com', name: null as string | null },
      ],
    })

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Not set')).toBeInTheDocument()
    })
  })

  it('shows linked provider with email', async () => {
    mockFetchSuccess()

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText(/test@github\.com/)).toBeInTheDocument()
    })
    expect(screen.getByText('Unlink')).toBeInTheDocument()
  })

  it('shows "Link" button for unlinked providers', async () => {
    mockFetchSuccess()

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument()
    })

    // Google and Vercel are not linked
    const linkButtons = screen.getAllByText('Link')
    expect(linkButtons).toHaveLength(2)
  })

  it('redirects to OAuth provider on link click', async () => {
    mockFetchSuccess()

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument()
    })

    const linkButtons = screen.getAllByText('Link')
    fireEvent.click(linkButtons[0]!)

    expect(mockLocation.href).toContain('/api/auth/link/google')
    expect(mockLocation.href).toContain('redirectTo=')
  })

  it('shows confirmation before unlinking', async () => {
    mockFetchSuccess()
    mockConfirm.mockReturnValue(false)

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Unlink'))

    expect(mockConfirm).toHaveBeenCalledWith(
      "Unlink GitHub? You'll no longer be able to sign in with this account.",
    )
    // Should NOT have called unlink API since user cancelled
    expect(mockFetch).toHaveBeenCalledTimes(1) // only the initial /api/auth/me
  })

  it('calls unlink API when confirmed', async () => {
    mockConfirm.mockReturnValue(true)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { ...mockUser, linkedProviders: [] } }),
      })

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Unlink'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/unlink',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ provider: 'github' }),
        }),
      )
    })
  })

  it('shows success message after unlinking', async () => {
    mockConfirm.mockReturnValue(true)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { ...mockUser, linkedProviders: [] } }),
      })

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Unlink'))

    await waitFor(() => {
      expect(screen.getByText('GitHub account unlinked.')).toBeInTheDocument()
    })
  })

  it('shows error when unlink fails', async () => {
    mockConfirm.mockReturnValue(true)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot unlink your only sign-in method.' }),
      })

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Unlink'))

    await waitFor(() => {
      expect(screen.getByText('Cannot unlink your only sign-in method.')).toBeInTheDocument()
    })
  })

  it('shows lockout warning when no password and only one linked provider', async () => {
    mockFetchSuccess({
      ...mockUser,
      hasPassword: false,
      linkedProviders: [{ provider: 'github', email: 'test@github.com', name: 'testuser' }],
    })

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(
        screen.getByText(/Unlinking your only connected account will lock you out/),
      ).toBeInTheDocument()
    })
  })

  it('shows critical warning when no password and no linked providers', async () => {
    mockFetchSuccess({
      ...mockUser,
      hasPassword: false,
      linkedProviders: [],
    })

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText(/no password and no linked accounts/)).toBeInTheDocument()
    })
  })

  it('does not show lockout warning when password is set', async () => {
    mockFetchSuccess({
      ...mockUser,
      hasPassword: true,
      linkedProviders: [{ provider: 'github', email: 'test@github.com', name: 'testuser' }],
    })

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Account')).toBeInTheDocument()
    })

    expect(screen.queryByText(/Unlinking your only connected account/)).not.toBeInTheDocument()
  })

  it('shows success banner on OAuth link redirect', async () => {
    mockSearchParams.set('linked', 'github')
    mockFetchSuccess()

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('GitHub account linked successfully.')).toBeInTheDocument()
    })

    expect(mockReplaceState).toHaveBeenCalledWith(null, '', '/admin/settings/account')
  })

  it('shows error banner from OAuth error redirect', async () => {
    mockSearchParams.set('error', 'invalid_state')
    mockFetchSuccess()

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('invalid_state')).toBeInTheDocument()
    })
  })

  it('handles network error on unlink', async () => {
    mockConfirm.mockReturnValue(true)

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockRejectedValueOnce(new Error('Network error'))

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Unlink'))

    await waitFor(() => {
      expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows "Unlinking..." during unlink request', async () => {
    mockConfirm.mockReturnValue(true)

    let resolveUnlink!: (value: unknown) => void
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: mockUser }) })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUnlink = resolve
          }),
      )

    render(<AccountSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Unlink')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Unlink'))

    await waitFor(() => {
      expect(screen.getByText('Unlinking...')).toBeInTheDocument()
    })

    // Resolve to clean up
    resolveUnlink({ ok: true, json: () => Promise.resolve({ success: true }) })
  })
})
