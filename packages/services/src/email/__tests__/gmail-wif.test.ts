import { afterEach, describe, expect, it, vi } from 'vitest';

const getVercelOidcToken = vi.hoisted(() => vi.fn());

vi.mock('@vercel/oidc', () => ({
  getVercelOidcToken,
}));

import { exchangeStsToken, gmailWifConfigured, mintGmailAccessToken } from '../gmail-wif.js';

const realFetch = global.fetch;
const WIF_PROVIDER = 'projects/p/locations/global/workloadIdentityPools/pool/providers/v';

afterEach(() => {
  global.fetch = realFetch;
  vi.unstubAllEnvs();
  getVercelOidcToken.mockReset();
});

function mockSts(accessToken = 'fed'): ReturnType<typeof vi.fn> {
  const fetchFn = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ access_token: accessToken }),
  });
  global.fetch = fetchFn as unknown as typeof fetch;
  return fetchFn;
}

function stsSubjectToken(fetchFn: ReturnType<typeof vi.fn>): string {
  const init = fetchFn.mock.calls[0]?.[1] as { body?: string } | undefined;
  const body = JSON.parse(init?.body ?? '{}') as { subjectToken?: string };
  return body.subjectToken ?? '';
}

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
        GOOGLE_WIF_PROVIDER: WIF_PROVIDER,
      }),
    ).rejects.toThrow('No OIDC subject token');
  });

  it('uses getVercelOidcToken as the STS subject token', async () => {
    getVercelOidcToken.mockResolvedValue('header-oidc');
    const fetchFn = mockSts();

    const access = await exchangeStsToken({
      GOOGLE_WIF_PROVIDER: WIF_PROVIDER,
    });

    expect(access).toBe('fed');
    expect(stsSubjectToken(fetchFn)).toBe('header-oidc');
    expect(getVercelOidcToken).toHaveBeenCalledTimes(1);
  });

  it('prefers getVercelOidcToken over env subject tokens', async () => {
    getVercelOidcToken.mockResolvedValue('from-helper');
    const fetchFn = mockSts();

    await exchangeStsToken({
      GOOGLE_WIF_PROVIDER: WIF_PROVIDER,
      VERCEL_OIDC_TOKEN: 'from-env',
      GOOGLE_WIF_ID_TOKEN: 'from-wif',
    });

    expect(stsSubjectToken(fetchFn)).toBe('from-helper');
  });

  it('falls back to GOOGLE_WIF_ID_TOKEN when getVercelOidcToken throws', async () => {
    getVercelOidcToken.mockRejectedValue(new Error('missing header'));
    const fetchFn = mockSts();

    await exchangeStsToken({
      GOOGLE_WIF_PROVIDER: WIF_PROVIDER,
      GOOGLE_WIF_ID_TOKEN: 'wif-id',
    });

    expect(stsSubjectToken(fetchFn)).toBe('wif-id');
  });

  it('throws when the helper and env tokens are empty', async () => {
    getVercelOidcToken.mockResolvedValue('');

    await expect(
      exchangeStsToken({
        GOOGLE_WIF_PROVIDER: WIF_PROVIDER,
      }),
    ).rejects.toThrow(
      'No OIDC subject token (VERCEL_OIDC_TOKEN or GOOGLE_WIF_ID_TOKEN). Enable Vercel OIDC.',
    );
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
