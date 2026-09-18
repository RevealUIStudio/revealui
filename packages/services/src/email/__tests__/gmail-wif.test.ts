import { afterEach, describe, expect, it, vi } from 'vitest';

import { exchangeStsToken, gmailWifConfigured, mintGmailAccessToken } from '../gmail-wif.js';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  vi.unstubAllEnvs();
});

describe('gmailWifConfigured', () => {
  it('requires SA email and WIF provider', () => {
    expect(gmailWifConfigured({})).toBe(false);
    expect(
      gmailWifConfigured({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sa@p.iam.gserviceaccount.com',
        GOOGLE_WIF_PROVIDER: 'projects/p/locations/global/workloadIdentityPools/pool/providers/v',
      }),
    ).toBe(true);
  });
});

describe('exchangeStsToken', () => {
  it('throws when no OIDC subject token is present', async () => {
    await expect(
      exchangeStsToken({
        GOOGLE_WIF_PROVIDER: 'projects/p/locations/global/workloadIdentityPools/pool/providers/v',
      }),
    ).rejects.toThrow('No OIDC subject token');
  });
});

describe('mintGmailAccessToken', () => {
  it('walks STS → signJwt → oauth2', async () => {
    const fetchFn = vi.fn();
    fetchFn
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ access_token: 'fed' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ signedJwt: 'jwt' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ access_token: 'gmail', expires_in: 3600 }),
      });
    global.fetch = fetchFn as unknown as typeof fetch;

    const out = await mintGmailAccessToken({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'sa@p.iam.gserviceaccount.com',
      GOOGLE_WIF_PROVIDER: 'projects/p/locations/global/workloadIdentityPools/pool/providers/v',
      VERCEL_OIDC_TOKEN: 'oidc',
      EMAIL_FROM: 'founder@revealui.com',
    });
    expect(out.accessToken).toBe('gmail');
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
