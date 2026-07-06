import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../cron-alerts.js', () => ({
  sendCronFailureAlert: vi.fn().mockResolvedValue(undefined),
}));

import { sendCronFailureAlert } from '../cron-alerts.js';
import { runHostedLicenseCanary } from '../license-canary.js';
import { licenseCanaryDegraded, setLicenseCanaryDegraded } from '../startup-state.js';

const alertMock = vi.mocked(sendCronFailureAlert);

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

beforeEach(() => {
  setLicenseCanaryDegraded(false);
  vi.clearAllMocks();
  delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
  delete process.env.SKIP_ENV_VALIDATION;
});

afterEach(() => {
  delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
  delete process.env.SKIP_ENV_VALIDATION;
  setLicenseCanaryDegraded(false);
});

describe('runHostedLicenseCanary', () => {
  it('is a no-op in forge mode (no REVEALUI_LICENSE_PRIVATE_KEY)', async () => {
    await expect(runHostedLicenseCanary()).resolves.toBeUndefined();
    expect(alertMock).not.toHaveBeenCalled();
    expect(licenseCanaryDegraded).toBe(false);
  });

  it('is a no-op when SKIP_ENV_VALIDATION is true', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = privateKeyA;
    process.env.SKIP_ENV_VALIDATION = 'true';
    await expect(runHostedLicenseCanary()).resolves.toBeUndefined();
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('resolves cleanly when hosted and keypair is consistent', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = privateKeyA;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyA;
    await expect(runHostedLicenseCanary()).resolves.toBeUndefined();
    expect(alertMock).not.toHaveBeenCalled();
    expect(licenseCanaryDegraded).toBe(false);
  });

  it('resolves ok when the NEXT private key signs and NEXT public key is in the list', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = privateKeyB;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyA;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = publicKeyB;
    await expect(runHostedLicenseCanary()).resolves.toBeUndefined();
    expect(alertMock).not.toHaveBeenCalled();
    expect(licenseCanaryDegraded).toBe(false);
  });

  it('throws with LICENSE CANARY FAILED when private key pairs with no configured public key', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = privateKeyC;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyA;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT = publicKeyB;
    await expect(runHostedLicenseCanary()).rejects.toThrow('LICENSE CANARY FAILED');
  });

  it('degrades readiness when a jose/parse exception occurs, without throwing', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = privateKeyA;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY =
      '-----BEGIN PUBLIC KEY-----\nnotbase64!!!\n-----END PUBLIC KEY-----';
    await expect(runHostedLicenseCanary()).resolves.toBeUndefined();
    expect(licenseCanaryDegraded).toBe(true);
    expect(alertMock).toHaveBeenCalledOnce();
    expect(alertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: 'hosted-license-canary',
        metadata: expect.objectContaining({ degraded: true }),
      }),
    );
  });
});
