import { describe, expect, it } from 'vitest';
import { generateCsrfToken, validateCsrfToken } from '../../lib/utils/csrf-token';

const SECRET = 'test-secret-32-chars-long-xxxxxx';
const SESSION = 'session-cookie-value';

describe('CSRF token', () => {
  it('generates a token in nonce:hmac format', async () => {
    const token = await generateCsrfToken(SESSION, SECRET);
    const parts = token.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(32);
    expect(parts[1]).toHaveLength(64);
  });

  it('validates a token it generated', async () => {
    const token = await generateCsrfToken(SESSION, SECRET);
    await expect(validateCsrfToken(token, SESSION, SECRET)).resolves.toBe(true);
  });

  it('rejects a token with wrong session binding', async () => {
    const token = await generateCsrfToken(SESSION, SECRET);
    await expect(validateCsrfToken(token, 'different-session', SECRET)).resolves.toBe(false);
  });

  it('rejects a token with wrong secret', async () => {
    const token = await generateCsrfToken(SESSION, SECRET);
    await expect(validateCsrfToken(token, SESSION, 'wrong-secret')).resolves.toBe(false);
  });

  it('rejects a tampered token', async () => {
    const token = await generateCsrfToken(SESSION, SECRET);
    const tampered = `${token.slice(0, -4)}ffff`;
    await expect(validateCsrfToken(tampered, SESSION, SECRET)).resolves.toBe(false);
  });

  it('rejects malformed tokens', async () => {
    await expect(validateCsrfToken('', SESSION, SECRET)).resolves.toBe(false);
    await expect(validateCsrfToken('nocolon', SESSION, SECRET)).resolves.toBe(false);
    await expect(validateCsrfToken('bad:hex:extra', SESSION, SECRET)).resolves.toBe(false);
  });
});
