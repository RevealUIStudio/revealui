import { createHash, generateKeyPairSync } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLicensePublicKeyTrustManifest,
  validateLicenseKeyAgainstTrustManifest,
} from '../license.js';

const ORIGINAL_CURRENT = process.env.REVEALUI_LICENSE_PUBLIC_KEY;
const ORIGINAL_NEXT = process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
const ORIGINAL_ISSUER = process.env.REVEALUI_LICENSE_ISSUER;
const ORIGINAL_AUDIENCE = process.env.REVEALUI_LICENSE_AUDIENCE;

const FIXED_PEM =
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=\n-----END PUBLIC KEY-----';
const FIXED_KEY_ID = '06e3fd8fda29bb60ab59557de61edb0aecdb231134be30e75b455f8e1b792fa9';
const FIXED_JWT_KID = '874261a3';
const FIXED_MANIFEST_DIGEST = 'df4d41347f530f5ba0792c2a9a64cc6dd7faacecec92f9f2a87747e3f85eb917';

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function pemFromDer(der: Uint8Array, type = 'PUBLIC KEY'): string {
  let binary = '';
  for (const byte of der) binary += String.fromCharCode(byte);
  return `-----BEGIN ${type}-----\n${btoa(binary)}\n-----END ${type}-----`;
}

function fixedSpkiBytes(): Uint8Array {
  const body = FIXED_PEM.split('\n').slice(1, -1).join('');
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

afterEach(() => {
  restoreEnv('REVEALUI_LICENSE_PUBLIC_KEY', ORIGINAL_CURRENT);
  restoreEnv('REVEALUI_LICENSE_PUBLIC_KEY_NEXT', ORIGINAL_NEXT);
  restoreEnv('REVEALUI_LICENSE_ISSUER', ORIGINAL_ISSUER);
  restoreEnv('REVEALUI_LICENSE_AUDIENCE', ORIGINAL_AUDIENCE);
  vi.resetModules();
});

describe('getLicensePublicKeyTrustManifest', () => {
  it('matches the fixed SPKI, legacy JWT kid, and ordered-set digest vectors', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = FIXED_PEM;

    const manifest = await getLicensePublicKeyTrustManifest();
    const digestInput = JSON.stringify({
      version: 1,
      issuer: 'https://revealui.com',
      audience: 'revealui-license',
      keys: [{ role: 'current', algorithm: 'EdDSA', keyId: FIXED_KEY_ID }],
    });

    expect(createHash('sha256').update(fixedSpkiBytes()).digest('hex')).toBe(FIXED_KEY_ID);
    expect(createHash('sha256').update(FIXED_PEM).digest('hex').slice(0, 8)).toBe(FIXED_JWT_KID);
    expect(createHash('sha256').update(digestInput).digest('hex')).toBe(FIXED_MANIFEST_DIGEST);
    expect(manifest.keys).toEqual([
      {
        role: 'current',
        algorithm: 'EdDSA',
        publicKey: FIXED_PEM,
        jwtKid: FIXED_JWT_KID,
        keyId: FIXED_KEY_ID,
      },
    ]);
    expect(manifest.digest).toBe(FIXED_MANIFEST_DIGEST);
    expect(manifest.publicKey).toBe(FIXED_PEM);
  });

  it('returns the exact full key identity and digest that verified a NEXT-signed token', async () => {
    const current = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const next = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = current.publicKey;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = next.publicKey;
    const manifest = await getLicensePublicKeyTrustManifest();
    const token = await new SignJWT({ tier: 'pro', customerId: 'customer', jti: 'registration' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt()
      .setIssuer('https://revealui.com')
      .setAudience('revealui-license')
      .setExpirationTime('5m')
      .sign(await importPKCS8(next.privateKey, 'EdDSA'));

    const result = await validateLicenseKeyAgainstTrustManifest(token, manifest, 'customer');
    expect(result).toEqual({
      payload: expect.objectContaining({ customerId: 'customer', tier: 'pro' }),
      verifiedKeyId: manifest.keys[1]?.keyId,
      trustSetDigest: manifest.digest,
    });

    const mutableManifest = {
      ...manifest,
      keys: manifest.keys.map((key) => ({ ...key })),
    };
    const inFlight = validateLicenseKeyAgainstTrustManifest(token, mutableManifest, 'customer');
    mutableManifest.digest = 'f'.repeat(64);
    mutableManifest.keys[1]!.keyId = 'e'.repeat(64);
    await expect(inFlight).resolves.toMatchObject({
      verifiedKeyId: manifest.keys[1]?.keyId,
      trustSetDigest: manifest.digest,
    });

    const substitutedKeys = manifest.keys.map((key, index) =>
      index === 1 ? { ...key, keyId: 'f'.repeat(64) } : key,
    );
    const substitutedDigestInput = JSON.stringify({
      version: manifest.version,
      issuer: manifest.issuer,
      audience: manifest.audience,
      keys: substitutedKeys.map(({ role, algorithm, keyId }) => ({ role, algorithm, keyId })),
    });
    await expect(
      validateLicenseKeyAgainstTrustManifest(token, {
        ...manifest,
        keys: substitutedKeys,
        digest: createHash('sha256').update(substitutedDigestInput).digest('hex'),
      }),
    ).resolves.toBeNull();
    await expect(
      validateLicenseKeyAgainstTrustManifest(token, {
        ...manifest,
        keys: manifest.keys.map((key, index) =>
          index === 1 ? { ...key, jwtKid: 'ffffffff' } : key,
        ),
      }),
    ).resolves.toBeNull();
    await expect(
      validateLicenseKeyAgainstTrustManifest(token, {
        ...manifest,
        digest: 'f'.repeat(64),
      }),
    ).resolves.toBeNull();
    await expect(
      validateLicenseKeyAgainstTrustManifest(token, {
        ...manifest,
        keys: manifest.keys.map((key, index) =>
          index === 1 ? { ...key, publicKey: 'not PEM' } : key,
        ),
      }),
    ).resolves.toBeNull();
  });

  it('trims after unescaping a terminal newline and preserves the current JWT kid', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = `${FIXED_PEM}\n`;
    const realNewline = await getLicensePublicKeyTrustManifest();

    process.env.REVEALUI_LICENSE_PUBLIC_KEY = `${FIXED_PEM.split('\n').join('\\n')}\\n`;
    const escapedNewline = await getLicensePublicKeyTrustManifest();

    expect(escapedNewline.publicKey).toBe(FIXED_PEM);
    expect(escapedNewline.keys[0].jwtKid).toBe(realNewline.keys[0].jwtKid);
    expect(escapedNewline.keys[0].keyId).toBe(realNewline.keys[0].keyId);
    expect(escapedNewline.digest).toBe(realNewline.digest);
  });

  it('keeps SPKI identity and set digest stable across wrapping and CRLF representations', async () => {
    const body = FIXED_PEM.split('\n')[1];
    const wrapped = `-----BEGIN PUBLIC KEY-----\n${body.slice(0, 24)}\n${body.slice(24)}\n-----END PUBLIC KEY-----`;
    const crlf = FIXED_PEM.split('\n').join('\r\n');
    const escaped = FIXED_PEM.split('\n').join('\\n');
    const representations = [FIXED_PEM, wrapped, crlf, escaped];
    const manifests = [];

    for (const pem of representations) {
      process.env.REVEALUI_LICENSE_PUBLIC_KEY = pem;
      manifests.push(await getLicensePublicKeyTrustManifest());
    }

    expect(manifests.map(({ keys }) => keys[0].keyId)).toEqual(Array(4).fill(FIXED_KEY_ID));
    expect(manifests.map(({ digest }) => digest)).toEqual(Array(4).fill(FIXED_MANIFEST_DIGEST));
    expect(manifests.map(({ keys }) => keys[0].jwtKid)).toEqual(
      representations.map((pem) =>
        createHash('sha256').update(pem.split('\\n').join('\n').trim()).digest('hex').slice(0, 8),
      ),
    );
  });

  it('fails closed when no current key exists, even with NEXT or when both keys are absent', async () => {
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = FIXED_PEM;
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow('current public key');

    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow('current public key');
  });

  it('rejects a fresh module whose configured issuer or audience differs from the fixed contract', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = FIXED_PEM;
    process.env.REVEALUI_LICENSE_ISSUER = 'https://issuer.invalid';
    vi.resetModules();
    const isolated = await import('../license.js');
    await expect(isolated.getLicensePublicKeyTrustManifest()).rejects.toThrow(
      'issuer configuration',
    );

    process.env.REVEALUI_LICENSE_ISSUER = 'https://revealui.com';
    process.env.REVEALUI_LICENSE_AUDIENCE = 'other-audience';
    vi.resetModules();
    const otherAudience = await import('../license.js');
    await expect(otherAudience.getLicensePublicKeyTrustManifest()).rejects.toThrow(
      'issuer configuration',
    );
  });

  it('fails closed for malformed current or NEXT keys instead of dropping an entry', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = FIXED_PEM;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = 'not a PEM';
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow();

    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'not a PEM';
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow();
  });

  it('rejects private keys, malformed/trailing DER, unsupported curves, and duplicate key material', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const privateDer = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = pemFromDer(privateDer, 'PRIVATE KEY');
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow();

    process.env.REVEALUI_LICENSE_PUBLIC_KEY = pemFromDer(Uint8Array.from([48, 1, 0]));
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow();

    const trailingDer = new Uint8Array([...fixedSpkiBytes(), 0]);
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = pemFromDer(trailingDer);
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow();

    const p256 = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ]);
    const p256Der = new Uint8Array(await crypto.subtle.exportKey('spki', p256.publicKey));
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = pemFromDer(p256Der);
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow();

    process.env.REVEALUI_LICENSE_PUBLIC_KEY = FIXED_PEM;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = FIXED_PEM;
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow('duplicate key identities');
  });

  it('changes the ordered digest for replacement, removal, and role reversal', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const otherPem = pemFromDer(
      new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)),
    );
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = FIXED_PEM;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = otherPem;
    const currentThenNext = await getLicensePublicKeyTrustManifest();

    process.env.REVEALUI_LICENSE_PUBLIC_KEY = otherPem;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = FIXED_PEM;
    const nextThenCurrent = await getLicensePublicKeyTrustManifest();
    expect(nextThenCurrent.digest).not.toBe(currentThenNext.digest);

    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
    const removedNext = await getLicensePublicKeyTrustManifest();
    expect(removedNext.digest).not.toBe(nextThenCurrent.digest);

    process.env.REVEALUI_LICENSE_PUBLIC_KEY = FIXED_PEM;
    const replacedCurrent = await getLicensePublicKeyTrustManifest();
    expect(replacedCurrent.digest).not.toBe(removedNext.digest);
  });

  it('enforces the per-key bound before attempting SPKI parsing', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = FIXED_PEM.replace('MCow', `${' '.repeat(2048)}MCow`);
    await expect(getLicensePublicKeyTrustManifest()).rejects.toThrow('supported size');
  });
});
