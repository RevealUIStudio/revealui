import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tests — sanitizeEmailHeader
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
// Tests — sendEmail
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
    delete process.env.RESEND_API_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    const { sendEmail } = await importFresh();
    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).rejects.toThrow('No email provider configured');
  });

  it('logs and returns silently in development when no email provider is configured', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.RESEND_API_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    const { sendEmail } = await importFresh();
    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).resolves.toBeUndefined();
  });

  it('calls Resend API with sanitized headers when RESEND_API_KEY is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendEmail } = await importFresh();
    await sendEmail({
      to: 'user@example.com\r\nBcc: evil@attacker.com',
      subject: 'Hello\nInjected-Header: bad',
      html: '<p>Hi</p>',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    // Verify sanitization stripped CR/LF from to and subject
    expect(body.to).toBe('user@example.comBcc: evil@attacker.com');
    expect(body.subject).toBe('HelloInjected-Header: bad');
    expect(body.from).toBe('noreply@test.com');
    expect(body.html).toBe('<p>Hi</p>');
  });

  it('uses noreply@revealui.com as fallback when RESEND_FROM_EMAIL is not set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 'test-key';
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.EMAIL_FROM;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendEmail } = await importFresh();
    await sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.from).toBe('noreply@revealui.com');
  });

  it('uses EMAIL_FROM as fallback when RESEND_FROM_EMAIL is not set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 'test-key';
    delete process.env.RESEND_FROM_EMAIL;
    process.env.EMAIL_FROM = 'custom@example.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendEmail } = await importFresh();
    await sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.from).toBe('custom@example.com');
  });

  it('sends optional text field when provided', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendEmail } = await importFresh();
    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi plain text',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe('Hi plain text');
  });

  it('throws when Resend API returns a non-ok response', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 'test-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue('Invalid email address'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendEmail } = await importFresh();
    await expect(sendEmail({ to: 'bad', subject: 'Test', html: '<p>Hi</p>' })).rejects.toThrow(
      'Resend API error (422): Invalid email address',
    );
  });

  it('includes Authorization header with Bearer token', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESEND_API_KEY = 're_test_12345';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { sendEmail } = await importFresh();
    await sendEmail({ to: 'user@example.com', subject: 'Test', html: '<p>Hi</p>' });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer re_test_12345');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
