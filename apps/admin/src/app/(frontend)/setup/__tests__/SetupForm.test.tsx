/**
 * SetupForm post-bootstrap navigation (GAP-247 F8).
 *
 * When /api/setup mints a session, the form must full-navigate to '/' via
 * navigateAfterAuthChange so the App Router cache does not replay a
 * logged-out RSC payload. When mint fails, soft-push to /login.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockNavigate = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/utils/auth-navigation', () => ({
  navigateAfterAuthChange: (path: string) => mockNavigate(path),
}));

vi.mock('@revealui/presentation/server', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  FormLabel: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  Heading: ({ children }: any) => <h2>{children}</h2>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  InputCVA: (props: any) => <input {...props} />,
}));

vi.mock('@/lib/components/PasswordInput', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  PasswordInput: ({ children }: any) => <div>{children}</div>,
}));

import { SetupForm } from '../SetupForm';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillAndSubmit(): Promise<void> {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'admin@test.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'securepassword12' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /create admin account/i }));
  });
}

describe('SetupForm', () => {
  it('full-navigates to / when setup mints a session', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        status: 'created',
        sessionMinted: true,
        user: { id: '1', email: 'admin@test.com', role: 'owner' },
      }),
    }) as unknown as typeof fetch;

    render(<SetupForm siteName="RevealUI" />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/taking you to the dashboard/i)).toBeTruthy();
    });
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      },
      { timeout: 3000 },
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('soft-pushes to /login when session mint is absent', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        status: 'created',
        user: { id: '1', email: 'admin@test.com', role: 'owner' },
      }),
    }) as unknown as typeof fetch;

    render(<SetupForm siteName="RevealUI" />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/redirecting to sign in/i)).toBeTruthy();
    });
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      },
      { timeout: 3000 },
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to /login when setup is locked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ status: 'locked', message: 'Already set up' }),
    }) as unknown as typeof fetch;

    render(<SetupForm siteName="RevealUI" />);
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
