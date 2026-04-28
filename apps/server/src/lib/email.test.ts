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
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    const { sendEmail } = await import('./email.js');
    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).rejects.toThrow('No email provider configured');
  });

  it('logs and returns silently in development when no email provider is configured', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    const { sendEmail } = await import('./email.js');
    // Should not throw
    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).resolves.toBeUndefined();
  });
});
