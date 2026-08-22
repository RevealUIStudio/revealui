/**
 * Tests for MFAForm's post-verify navigation — must be a full document
 * navigation so the App Router client cache from the pre-auth state is
 * discarded (same class as the LoginForm sign-in bounce), and must honor the
 * upgrade/redirect intent carried through the MFA step from login.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerify = vi.fn();
const mockVerifyBackupCode = vi.fn();
const mockNavigate = vi.fn();
// Set per-test to drive useSearchParams.
let mockSearchParams: Record<string, string | null> = {};

vi.mock('@revealui/auth/react', () => ({
  useMFAVerify: () => ({
    verify: mockVerify,
    verifyBackupCode: mockVerifyBackupCode,
    isLoading: false,
    error: null,
  }),
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

import { MFAForm } from '../MFAForm';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = {};
});

function submitCode(code: string): void {
  const el = document.querySelector('#totp-code');
  if (el) fireEvent.change(el, { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
}

describe('MFAForm post-verify navigation', () => {
  it('full-navigates home after a successful TOTP verification', async () => {
    mockVerify.mockResolvedValue(true);

    render(<MFAForm />);
    submitCode('123456');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('honors a redirect carried through the MFA step', async () => {
    mockSearchParams = { redirect: '/upgrade' };
    mockVerify.mockResolvedValue(true);

    render(<MFAForm />);
    submitCode('123456');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/upgrade');
    });
  });

  it('honors ?redirect=/account/license carried through the MFA step', async () => {
    mockSearchParams = { redirect: '/account/license' };
    mockVerify.mockResolvedValue(true);

    render(<MFAForm />);
    submitCode('123456');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/account/license');
    });
  });

  it('honors an upgrade intent carried through the MFA step (over redirect)', async () => {
    mockSearchParams = { upgrade: 'pro', redirect: '/somewhere' };
    mockVerify.mockResolvedValue(true);

    render(<MFAForm />);
    submitCode('123456');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/account/billing?upgrade=pro');
    });
  });

  it('ignores an off-origin redirect and falls back home', async () => {
    mockSearchParams = { redirect: '//evil.com' };
    mockVerify.mockResolvedValue(true);

    render(<MFAForm />);
    submitCode('123456');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('stays put when verification fails', async () => {
    mockVerify.mockResolvedValue(false);

    render(<MFAForm />);
    submitCode('000000');

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith('000000');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
