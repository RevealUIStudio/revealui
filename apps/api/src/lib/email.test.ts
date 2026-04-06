import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('sendEmail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws in production when no email provider is configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    const { sendEmail } = await import('./email.js');
    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).rejects.toThrow('No email provider configured');
  });

  it('logs and returns silently in development when no email provider is configured', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.RESEND_API_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    const { sendEmail } = await import('./email.js');
    // Should not throw
    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).resolves.toBeUndefined();
  });

  it('calls Resend API when RESEND_API_KEY is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendEmail } = await import('./email.js');
    await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    vi.unstubAllGlobals();
  });

  it('throws when Resend API returns error', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 'test-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue('Invalid email'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendEmail } = await import('./email.js');
    await expect(sendEmail({ to: 'bad', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow(
      'Resend API error (422)',
    );

    vi.unstubAllGlobals();
  });
});
