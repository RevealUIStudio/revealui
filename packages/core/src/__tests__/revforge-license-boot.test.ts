/**
 * Shared Forge license boot gate (admin + server).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  detectDeploymentMode,
  validateLicenseKey,
  computeKeyId,
  hostMatchesLicensedDomains,
  loggerInfo,
} = vi.hoisted(() => ({
  detectDeploymentMode: vi.fn(),
  validateLicenseKey: vi.fn(),
  computeKeyId: vi.fn(),
  hostMatchesLicensedDomains: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('../deployment-mode.js', () => ({
  detectDeploymentMode: (...args: unknown[]) => detectDeploymentMode(...args),
}));

vi.mock('../license.js', () => ({
  validateLicenseKey: (...args: unknown[]) => validateLicenseKey(...args),
  computeKeyId: (...args: unknown[]) => computeKeyId(...args),
  hostMatchesLicensedDomains: (...args: unknown[]) => hostMatchesLicensedDomains(...args),
}));

vi.mock('../observability/logger.js', () => ({
  logger: { info: loggerInfo, warn: vi.fn(), error: vi.fn() },
}));

import {
  ALLOW_UNLICENSED_SELF_HOST_ENV,
  decodeJwtKid,
  validateForgeLicenseAtStartup,
} from '../revforge-license-boot.js';

describe('validateForgeLicenseAtStartup', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('no-ops when SKIP_ENV_VALIDATION=true', async () => {
    await expect(
      validateForgeLicenseAtStartup({ SKIP_ENV_VALIDATION: 'true' }),
    ).resolves.toBeUndefined();
    expect(detectDeploymentMode).not.toHaveBeenCalled();
  });

  it('no-ops in hosted mode', async () => {
    detectDeploymentMode.mockReturnValue('hosted');
    await expect(validateForgeLicenseAtStartup({})).resolves.toBeUndefined();
  });

  it('allows Free (OSS) tier with opt-in and no key', async () => {
    detectDeploymentMode.mockReturnValue('forge');
    await expect(
      validateForgeLicenseAtStartup({ [ALLOW_UNLICENSED_SELF_HOST_ENV]: 'true' }),
    ).resolves.toBeUndefined();
    expect(loggerInfo).toHaveBeenCalledWith('no license key — running Free (OSS) tier');
  });

  it('throws when forge mode has no key and no opt-in', async () => {
    detectDeploymentMode.mockReturnValue('forge');
    await expect(validateForgeLicenseAtStartup({})).rejects.toThrow(
      /REVEALUI_LICENSE_KEY is required/,
    );
  });

  it('throws when public key missing', async () => {
    detectDeploymentMode.mockReturnValue('forge');
    await expect(validateForgeLicenseAtStartup({ REVEALUI_LICENSE_KEY: 'a.b.c' })).rejects.toThrow(
      /REVEALUI_LICENSE_PUBLIC_KEY is required/,
    );
  });

  it('throws when validateLicenseKey rejects', async () => {
    detectDeploymentMode.mockReturnValue('forge');
    validateLicenseKey.mockResolvedValue(null);
    await expect(
      validateForgeLicenseAtStartup({
        REVEALUI_LICENSE_KEY: 'a.b.c',
        REVEALUI_LICENSE_PUBLIC_KEY: 'pem',
      }),
    ).rejects.toThrow(/invalid, expired beyond grace/);
  });

  it('accepts a valid payload', async () => {
    detectDeploymentMode.mockReturnValue('forge');
    validateLicenseKey.mockResolvedValue({ tier: 'pro', customerId: 'acme' });
    await expect(
      validateForgeLicenseAtStartup({
        REVEALUI_LICENSE_KEY: 'a.b.c',
        REVEALUI_LICENSE_PUBLIC_KEY: 'pem',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('decodeJwtKid', () => {
  it('returns kid from a well-formed header segment', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'abc' })).toString('base64url');
    expect(decodeJwtKid(`${header}.payload.sig`)).toBe('abc');
  });

  it('returns undefined for garbage', () => {
    expect(decodeJwtKid('not-a-jwt')).toBeUndefined();
  });
});
