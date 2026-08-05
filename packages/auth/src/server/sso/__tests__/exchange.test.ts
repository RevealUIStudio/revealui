import { describe, expect, it, vi } from 'vitest';
import { exchangeOidcCode } from '../oidc.js';

describe('exchangeOidcCode', () => {
  const base = {
    tokenEndpoint: 'https://idp.example.com/token',
    clientId: 'client-1',
    clientSecret: 'secret-1',
    code: 'auth-code',
    redirectUri: 'https://app.example.com/api/auth/sso/p1/callback',
    codeVerifier: 'verifier-abc',
  };

  it('returns id_token and optional access_token on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id_token: 'id.jwt.here',
        access_token: 'access-tok',
      }),
    });

    const result = await exchangeOidcCode({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokens.id_token).toBe('id.jwt.here');
      expect(result.tokens.access_token).toBe('access-tok');
    }

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(base.tokenEndpoint);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('code_verifier')).toBe('verifier-abc');
    expect(body.get('client_id')).toBe('client-1');
    expect(body.get('client_secret')).toBe('secret-1');
  });

  it('rejects missing id_token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'only-access' }),
    });

    const result = await exchangeOidcCode({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing_id_token');
    }
  });

  it('rejects missing required params', async () => {
    const result = await exchangeOidcCode({
      ...base,
      code: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('missing_params');
    }
  });

  it('maps HTTP errors to fetch_failed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    const result = await exchangeOidcCode({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('fetch_failed');
      expect(result.message).toContain('401');
    }
  });

  it('maps network failures to fetch_failed', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await exchangeOidcCode({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('fetch_failed');
      expect(result.message).toContain('network down');
    }
  });
});
