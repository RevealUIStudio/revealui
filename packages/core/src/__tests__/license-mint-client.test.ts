import { generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { validateLicenseKey } from '../license.js';
import {
  canMintLicense,
  isSignViaSigner,
  LicenseMintConfigError,
  LicenseMintRemoteError,
  mintConfigMissingMessage,
  mintLicenseKey,
  SIGNER_MINT_PATH,
  SIGNER_SIGNATURE_HEADER,
  SIGNER_TIMESTAMP_HEADER,
  signMintRequest,
} from '../license-mint-client.js';

let privateKeyPem: string;
let publicKeyPem: string;

beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyPem = publicKey;
  privateKeyPem = privateKey;
});

describe('isSignViaSigner / canMintLicense', () => {
  it('flag defaults off', () => {
    expect(isSignViaSigner({})).toBe(false);
    expect(isSignViaSigner({ REVEALUI_LICENSE_SIGN_VIA_SIGNER: '' })).toBe(false);
  });

  it('accepts common truthy flag values', () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) {
      expect(isSignViaSigner({ REVEALUI_LICENSE_SIGN_VIA_SIGNER: v })).toBe(true);
    }
  });

  it('canMintLicense local requires private key', () => {
    expect(canMintLicense({})).toBe(false);
    expect(canMintLicense({ REVEALUI_LICENSE_PRIVATE_KEY: privateKeyPem })).toBe(true);
  });

  it('canMintLicense remote requires url + invoke secret', () => {
    expect(
      canMintLicense({
        REVEALUI_LICENSE_SIGN_VIA_SIGNER: '1',
        REVEALUI_LICENSE_SIGNER_URL: 'http://127.0.0.1:8791',
      }),
    ).toBe(false);
    expect(
      canMintLicense({
        REVEALUI_LICENSE_SIGN_VIA_SIGNER: '1',
        REVEALUI_LICENSE_SIGNER_URL: 'http://127.0.0.1:8791',
        REVEALUI_SIGNER_INVOKE_SECRET: 'sec',
      }),
    ).toBe(true);
  });
});

describe('mintLicenseKey local path', () => {
  it('mints a JWT that verifies with the public key', async () => {
    const jwt = await mintLicenseKey(
      { tier: 'pro', customerId: 'cus_local' },
      {
        env: {
          REVEALUI_LICENSE_PRIVATE_KEY: privateKeyPem,
          REVEALUI_LICENSE_PUBLIC_KEY: publicKeyPem,
        },
      },
    );
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.tier).toBe('pro');
    expect(payload?.customerId).toBe('cus_local');
  });

  it('throws LicenseMintConfigError when private key missing', async () => {
    await expect(
      mintLicenseKey({ tier: 'pro', customerId: 'cus_x' }, { env: {} }),
    ).rejects.toBeInstanceOf(LicenseMintConfigError);
    expect(mintConfigMissingMessage({})).toMatch(/PRIVATE_KEY/);
  });

  it('passes null expiresInSeconds for perpetual', async () => {
    const jwt = await mintLicenseKey(
      { tier: 'enterprise', customerId: 'cus_perp', perpetual: true, expiresInSeconds: null },
      { env: { REVEALUI_LICENSE_PRIVATE_KEY: privateKeyPem } },
    );
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.perpetual).toBe(true);
    expect(payload?.exp).toBeUndefined();
  });
});

describe('mintLicenseKey remote path', () => {
  it('POSTs signed body to signer and returns licenseKey', async () => {
    const secret = 'unit-invoke-secret';
    const expectedJwt = 'a.b.c';
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('http://signer.example/internal/mint');
      expect(init?.method).toBe('POST');
      const headers = new Headers(init?.headers);
      const ts = headers.get(SIGNER_TIMESTAMP_HEADER);
      const sig = headers.get(SIGNER_SIGNATURE_HEADER);
      const body = String(init?.body ?? '');
      expect(ts).toBeTruthy();
      expect(sig).toBe(signMintRequest(secret, 'POST', SIGNER_MINT_PATH, body, Number(ts)));
      const parsed = JSON.parse(body) as {
        tier: string;
        customerId: string;
        expiresInSeconds: number;
      };
      expect(parsed.tier).toBe('max');
      expect(parsed.customerId).toBe('cus_remote');
      expect(parsed.expiresInSeconds).toBe(3600);
      return new Response(JSON.stringify({ licenseKey: expectedJwt }), { status: 200 });
    });

    const jwt = await mintLicenseKey(
      { tier: 'max', customerId: 'cus_remote', expiresInSeconds: 3600 },
      {
        env: {
          REVEALUI_LICENSE_SIGN_VIA_SIGNER: '1',
          REVEALUI_LICENSE_SIGNER_URL: 'http://signer.example/',
          REVEALUI_SIGNER_INVOKE_SECRET: secret,
        },
        fetch: fetchMock as unknown as typeof fetch,
      },
    );
    expect(jwt).toBe(expectedJwt);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not use REVEALUI_SECRET when invoke secret missing', async () => {
    await expect(
      mintLicenseKey(
        { tier: 'pro', customerId: 'cus_x' },
        {
          env: {
            REVEALUI_LICENSE_SIGN_VIA_SIGNER: '1',
            REVEALUI_LICENSE_SIGNER_URL: 'http://signer.example',
            REVEALUI_SECRET: 'session-only',
          },
        },
      ),
    ).rejects.toBeInstanceOf(LicenseMintConfigError);
  });

  it('throws LicenseMintRemoteError on non-2xx', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 401 }));
    await expect(
      mintLicenseKey(
        { tier: 'pro', customerId: 'cus_x' },
        {
          env: {
            REVEALUI_LICENSE_SIGN_VIA_SIGNER: 'true',
            REVEALUI_LICENSE_SIGNER_URL: 'http://signer.example',
            REVEALUI_SIGNER_INVOKE_SECRET: 'sec',
          },
          fetch: fetchMock as unknown as typeof fetch,
        },
      ),
    ).rejects.toBeInstanceOf(LicenseMintRemoteError);
  });
});
