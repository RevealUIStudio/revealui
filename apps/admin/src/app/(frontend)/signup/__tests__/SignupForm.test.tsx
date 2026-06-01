/**
 * Tests for SignupForm's post-signup routing.
 *
 * The critical behavior: a NEW unverified user must NOT be pushed to a
 * protected route (which would bounce to /login) — they see a "Check your
 * inbox" confirmation instead. Only the auto-verified first user is sent in.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignUp = vi.fn();
const mockPush = vi.fn();

vi.mock('@revealui/auth/react', () => ({
  useSignUp: () => ({ signUp: mockSignUp, isLoading: false }),
  usePasskeyRegister: () => ({
    register: vi.fn(),
    isLoading: false,
    error: null,
    supported: false,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('@revealui/presentation/server', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  ButtonCVA: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  FormLabel: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  Heading: ({ children }: any) => <h2>{children}</h2>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  InputCVA: (props: any) => <input {...props} />,
  PasskeyIcon: () => <svg aria-hidden="true" />,
}));

vi.mock('@/lib/components/PasswordInput', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  PasswordInput: ({ children }: any) => <div>{children}</div>,
}));

import { SignupForm } from '../SignupForm';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  // GDPR consent grant is fire-and-forget; stub fetch so jsdom doesn't throw.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

function fillAndSubmit(): void {
  const set = (selector: string, value: string) => {
    const el = document.querySelector(selector);
    if (el) fireEvent.change(el, { target: { value } });
  };
  set('#name', 'Ada Lovelace');
  set('#email', 'ada@example.com');
  set('#password', 'Password123');
  const tos = document.querySelector('#tos');
  if (tos) fireEvent.click(tos);
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('SignupForm post-signup routing', () => {
  it('shows a verify-your-email screen (no redirect) when the new user is unverified', async () => {
    mockSignUp.mockResolvedValue({
      success: true,
      user: { id: '1', email: 'ada@example.com', emailVerified: false },
    });

    render(<SignupForm apiUrl="http://api.test" />);
    fillAndSubmit();

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('sends an auto-verified (first) user straight in', async () => {
    mockSignUp.mockResolvedValue({
      success: true,
      user: { id: '1', email: 'ada@example.com', emailVerified: true },
    });

    render(<SignupForm apiUrl="http://api.test" />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
    expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument();
  });
});
