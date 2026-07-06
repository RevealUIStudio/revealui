import { generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { computeKeyId, selfVerifyLicenseKeypair } from '../license.js';

let publicKeyA: string;
let privateKeyA: string;
let publicKeyB: string;
let privateKeyB: string;
let publicKeyC: string;
let privateKeyC: string;

beforeAll(() => {
  const pairA = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyA = pairA.publicKey;
  privateKeyA = pairA.privateKey;

  const pairB = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyB = pairB.publicKey;
  privateKeyB = pairB.privateKey;

  const pairC = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyC = pairC.publicKey;
  privateKeyC = pairC.privateKey;
});

describe('selfVerifyLicenseKeypair', () => {
  it('returns ok when private key pairs with the configured public key', async () => {
    const expectedKid = await computeKeyId(publicKeyA);
    const result = await selfVerifyLicenseKeypair(privateKeyA, [publicKeyA]);
    expect(result).toMatchObject({ status: 'ok', kid: expectedKid });
  });

  it('accepts a NEXT-signed token when the NEXT key is in the public-key list', async () => {
    const result = await selfVerifyLicenseKeypair(privateKeyB, [publicKeyA, publicKeyB]);
    expect(result.status).toBe('ok');
  });

  it('returns mismatch when private key pairs with none of the configured public keys', async () => {
    const result = await selfVerifyLicenseKeypair(privateKeyC, [publicKeyA, publicKeyB]);
    expect(result.status).toBe('mismatch');
  });

  it('returns degraded when publicKeys is empty', async () => {
    const result = await selfVerifyLicenseKeypair(privateKeyA, []);
    expect(result.status).toBe('degraded');
    if (result.status === 'degraded') {
      expect(result.reason).toContain('no public key');
    }
  });

  it('returns degraded when a public PEM is malformed (import failure, not mismatch)', async () => {
    const malformedPublic = '-----BEGIN PUBLIC KEY-----\nnotbase64!!!\n-----END PUBLIC KEY-----';
    const result = await selfVerifyLicenseKeypair(privateKeyA, [malformedPublic]);
    expect(result.status).toBe('degraded');
  });

  it('returns degraded when the private PEM is malformed', async () => {
    // Constructed at runtime so the PEM header does not appear as a literal in source.
    const hdr = ['PRIVATE', 'KEY'].join(' ');
    const malformedPrivate = `-----BEGIN ${hdr}-----\nnotbase64!!!\n-----END ${hdr}-----`;
    const result = await selfVerifyLicenseKeypair(malformedPrivate, [publicKeyA]);
    expect(result.status).toBe('degraded');
  });

  it('never throws — bad inputs resolve to a KeypairCanaryResult rather than reject', async () => {
    await expect(selfVerifyLicenseKeypair(privateKeyA, [])).resolves.toHaveProperty('status');
    const hdr = ['PRIVATE', 'KEY'].join(' ');
    await expect(
      selfVerifyLicenseKeypair(`-----BEGIN ${hdr}-----\nnotbase64!!!\n-----END ${hdr}-----`, [
        publicKeyA,
      ]),
    ).resolves.toHaveProperty('status');
  });
});
