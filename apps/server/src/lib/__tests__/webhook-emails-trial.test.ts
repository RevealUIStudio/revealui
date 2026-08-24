import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import {
  sendLicenseActivatedEmail,
  sendTrialEndingEmail,
  sendTrialExpiredEmail,
} from '../webhook-emails.js';

describe('Stripe trial lifecycle email copy is plan-specific', () => {
  beforeEach(() => {
    mockSendEmail.mockClear();
  });

  it('license-activated for Max says Max, not Pro', async () => {
    await sendLicenseActivatedEmail('max@example.com', 'max');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = mockSendEmail.mock.calls[0]?.[0] as {
      subject: string;
      html: string;
      text: string;
    };
    expect(payload.subject).toContain('Max');
    expect(payload.subject).not.toContain('Pro');
    expect(payload.html).toContain('Max');
    expect(`${payload.html}${payload.text}`).not.toContain('Pro license');
  });

  it('trial-ending for Max says Max and includes the Stripe trial end', async () => {
    const trialEnd = Date.UTC(2026, 7, 27) / 1000;
    await sendTrialEndingEmail('max@example.com', trialEnd, 'max');
    const payload = mockSendEmail.mock.calls[0]?.[0] as { subject: string; html: string };
    expect(payload.subject).toBe('Your RevealUI Max trial ends soon');
    expect(payload.html).toContain('Max');
    expect(payload.html).toContain('August 27, 2026');
    expect(payload.subject).not.toContain('Pro');
  });

  it('trial-expired / converted for Max says Max, not Pro', async () => {
    await sendTrialExpiredEmail('max@example.com', 'max');
    const payload = mockSendEmail.mock.calls[0]?.[0] as { subject: string };
    expect(payload.subject).toBe('Your RevealUI Max trial has ended');
    expect(payload.subject).not.toContain('Pro');
  });
});
