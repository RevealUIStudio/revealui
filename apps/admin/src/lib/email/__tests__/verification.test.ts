/**
 * Verification email links must target the admin origin.
 *
 * Hosted env sets NEXT_PUBLIC_SERVER_URL / REVEALUI_PUBLIC_SERVER_URL to
 * https://api.revealui.com. GET /api/auth/verify-email lives on admin
 * (admin.revealui.com). Using serverURL put both signup and resend links
 * on the API, which has no verify route and surfaces as a 500.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendEmail = vi.fn();

vi.mock('../index', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock('@revealui/config', () => ({
  default: {
    reveal: {
      serverURL: 'https://api.revealui.com',
      publicServerURL: 'https://api.revealui.com',
    },
  },
}));

import { sendVerificationEmail } from '../verification';

describe('sendVerificationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ success: true });
    process.env.NEXT_PUBLIC_APP_URL = 'https://admin.revealui.com';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('puts the verify link on NEXT_PUBLIC_APP_URL, never the API serverURL', async () => {
    const result = await sendVerificationEmail('ada@example.com', 'raw-token-hex');

    expect(result).toEqual({ success: true });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const opts = mockSendEmail.mock.calls[0]?.[0] as { html: string; text: string };
    expect(opts.html).toContain(
      'https://admin.revealui.com/api/auth/verify-email?token=raw-token-hex',
    );
    expect(opts.text).toContain(
      'https://admin.revealui.com/api/auth/verify-email?token=raw-token-hex',
    );
    expect(opts.html).not.toContain('https://api.revealui.com');
    expect(opts.text).not.toContain('https://api.revealui.com');
  });

  it('refuses to send when NEXT_PUBLIC_APP_URL is unset (no API fallback)', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const result = await sendVerificationEmail('ada@example.com', 'raw-token-hex');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/NEXT_PUBLIC_APP_URL/);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
