import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tests  -  sanitizeEmailHeader
// ---------------------------------------------------------------------------
describe('sanitizeEmailHeader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@revealui/core/observability/logger', () => ({
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  async function importFresh() {
    return import('../email.js');
  }

  it('strips carriage return characters', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('hello\rworld')).toBe('helloworld');
  });

  it('strips line feed characters', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('hello\nworld')).toBe('helloworld');
  });

  it('strips CR+LF sequences', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('hello\r\nworld')).toBe('helloworld');
  });

  it('strips multiple CR and LF characters throughout the string', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('\rfoo\n\rbar\r\nbaz\n')).toBe('foobarbaz');
  });

  it('preserves normal strings without CR/LF', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('user@example.com')).toBe('user@example.com');
  });

  it('preserves strings with tabs and spaces', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('hello\tworld  test')).toBe('hello\tworld  test');
  });

  it('handles empty string', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('')).toBe('');
  });

  it('handles string with only CR characters', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('\r\r\r')).toBe('');
  });

  it('handles string with only LF characters', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('\n\n\n')).toBe('');
  });

  it('handles string with only CR+LF', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    expect(sanitizeEmailHeader('\r\n\r\n')).toBe('');
  });

  it('prevents header injection attempts via subject', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    // Attacker tries to inject a BCC header via newline in subject
    const malicious = 'Test Subject\r\nBcc: attacker@evil.com';
    expect(sanitizeEmailHeader(malicious)).toBe('Test SubjectBcc: attacker@evil.com');
  });

  it('prevents header injection attempts via to field', async () => {
    const { sanitizeEmailHeader } = await importFresh();
    const malicious = 'victim@example.com\nBcc: spy@evil.com';
    expect(sanitizeEmailHeader(malicious)).toBe('victim@example.comBcc: spy@evil.com');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  sendEmail
// ---------------------------------------------------------------------------
describe('sendEmail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@revealui/core/observability/logger', () => ({
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  async function importFresh() {
    return import('../email.js');
  }

  it('throws in production when no email provider is configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    const { sendEmail } = await importFresh();
    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).rejects.toThrow('No email provider configured');
  });

  it('logs and returns silently in development when no email provider is configured', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    const { sendEmail } = await importFresh();
    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).resolves.toBeUndefined();
  });
});
