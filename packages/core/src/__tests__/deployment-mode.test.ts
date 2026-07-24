import { describe, expect, it } from 'vitest';
import {
  deploymentModeKeyConsistencyError,
  detectDeploymentMode,
  isHostedDeployment,
} from '../deployment-mode.js';

describe('detectDeploymentMode', () => {
  it('prefers REVEALUI_DEPLOYMENT_MODE=hosted over missing private key', () => {
    expect(detectDeploymentMode({ REVEALUI_DEPLOYMENT_MODE: 'hosted' })).toBe('hosted');
  });

  it('prefers REVEALUI_DEPLOYMENT_MODE=forge even when private key is set', () => {
    // Consistency error is separate; detection still honors explicit MODE.
    expect(
      detectDeploymentMode({
        REVEALUI_DEPLOYMENT_MODE: 'forge',
        REVEALUI_LICENSE_PRIVATE_KEY: 'pem',
      }),
    ).toBe('forge');
  });

  it('is case-insensitive and trims MODE', () => {
    expect(detectDeploymentMode({ REVEALUI_DEPLOYMENT_MODE: '  HOSTED  ' })).toBe('hosted');
    expect(detectDeploymentMode({ REVEALUI_DEPLOYMENT_MODE: 'Forge' })).toBe('forge');
  });

  it('falls back to private-key presence when MODE is unset', () => {
    expect(detectDeploymentMode({ REVEALUI_LICENSE_PRIVATE_KEY: 'any' })).toBe('hosted');
    expect(detectDeploymentMode({})).toBe('forge');
    expect(detectDeploymentMode({ REVEALUI_LICENSE_PRIVATE_KEY: '' })).toBe('forge');
  });

  it('ignores unknown MODE values and falls back to key presence', () => {
    expect(detectDeploymentMode({ REVEALUI_DEPLOYMENT_MODE: 'saas' })).toBe('forge');
    expect(
      detectDeploymentMode({
        REVEALUI_DEPLOYMENT_MODE: 'saas',
        REVEALUI_LICENSE_PRIVATE_KEY: 'k',
      }),
    ).toBe('hosted');
  });

  it('lenient treats empty private key as present for fallback', () => {
    expect(detectDeploymentMode({ REVEALUI_LICENSE_PRIVATE_KEY: '' }, { lenient: true })).toBe(
      'hosted',
    );
  });
});

describe('isHostedDeployment', () => {
  it('returns true for hosted MODE without private key', () => {
    expect(isHostedDeployment({ REVEALUI_DEPLOYMENT_MODE: 'hosted' })).toBe(true);
  });
});

describe('deploymentModeKeyConsistencyError', () => {
  it('errors when MODE=forge and private key is present', () => {
    const msg = deploymentModeKeyConsistencyError({
      REVEALUI_DEPLOYMENT_MODE: 'forge',
      REVEALUI_LICENSE_PRIVATE_KEY: 'pem',
    });
    expect(msg).toMatch(/MODE=forge/);
  });

  it('allows MODE=hosted without private key (signer isolation)', () => {
    expect(deploymentModeKeyConsistencyError({ REVEALUI_DEPLOYMENT_MODE: 'hosted' })).toBeNull();
  });

  it('is a no-op when MODE is unset', () => {
    expect(deploymentModeKeyConsistencyError({ REVEALUI_LICENSE_PRIVATE_KEY: 'pem' })).toBeNull();
  });
});
