/**
 * Tests for RotatePasswordForm's post-rotation navigation — must be a full
 * document navigation so the App Router client cache from the
 * rotation-pending state is discarded (same class as the LoginForm sign-in
 * bounce), and must honor the upgrade/redirect intent carried through the
 * rotation step from login.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiFetch = vi.fn();
const mockNavigate = vi.fn();
// Set per-test to drive useSearchParams.
let mockSearchParams: Record<string, string | null> = {};

vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: (url: string, init?: RequestInit) => mockApiFetch(url, init),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (k: string) => mockSearchParams[k] ?? null }),
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

import { RotatePasswordForm } from '../RotatePasswordForm';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = {};
});

function fillAndSubmit(): void {
  const set = (selector: string, value: string) => {
    const el = document.querySelector(selector);
    if (el) fireEvent.change(el, { target: { value } });
  };
  set('#current-password', 'OldPassword1');
  set('#new-password', 'NewPassword2');
  set('#confirm-password', 'NewPassword2');
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('RotatePasswordForm post-rotation navigation', () => {
  it('full-navigates home after a successful rotation', async () => {
    mockApiFetch.mockResolvedValue({ ok: true });

    render(<RotatePasswordForm />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('honors a redirect carried through the rotation step', async () => {
    mockSearchParams = { redirect: '/upgrade' };
    mockApiFetch.mockResolvedValue({ ok: true });

    render(<RotatePasswordForm />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/upgrade');
    });
  });

  it('honors an upgrade intent carried through the rotation step (over redirect)', async () => {
    mockSearchParams = { upgrade: 'max', redirect: '/somewhere' };
    mockApiFetch.mockResolvedValue({ ok: true });

    render(<RotatePasswordForm />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/account/billing?upgrade=max');
    });
  });

  it('shows the API error and does not navigate on failure', async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Current password is incorrect.' } }),
    });

    render(<RotatePasswordForm />);
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
