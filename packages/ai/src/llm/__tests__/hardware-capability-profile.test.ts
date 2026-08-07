import { describe, expect, it } from 'vitest';
import {
  CONSTRAINED_PRESET,
  getHardwareCapabilityPreset,
  hardwareTierForLocalAiTier,
  isHardwareCapabilityTier,
  isModelSizeViable,
  listHardwareCapabilityPresets,
  resolveHardwareCapabilityProfile,
} from '../hardware-capability-profile.js';

describe('hardware-capability-profile (GAP-297)', () => {
  it('ships exactly three presets', () => {
    const presets = listHardwareCapabilityPresets();
    expect(presets.map((p) => p.id).sort()).toEqual(['constrained', 'mainstream', 'workstation']);
  });

  it('constrained is the owner-machine reference (low RAM, no VRAM floor)', () => {
    expect(CONSTRAINED_PRESET.ramGbMin).toBeLessThanOrEqual(8);
    expect(CONSTRAINED_PRESET.vramGbMin).toBe(0);
    expect(CONSTRAINED_PRESET.viableModelSizes).toEqual(['nano', 'small']);
    expect(CONSTRAINED_PRESET.capabilityHints['security-design']).toBe('frontier-only');
  });

  it('resolve(null) is no-op (default dev path unchanged)', () => {
    expect(resolveHardwareCapabilityProfile(null)).toBeNull();
    expect(resolveHardwareCapabilityProfile(undefined)).toBeNull();
  });

  it('resolve(tier string) returns a deep clone of the preset', () => {
    const a = resolveHardwareCapabilityProfile('mainstream');
    const b = getHardwareCapabilityPreset('mainstream');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    if (a) a.description = 'mutated';
    expect(getHardwareCapabilityPreset('mainstream').description).not.toBe('mutated');
  });

  it('resolve(override) merges capabilityHints and marks isOverride', () => {
    const resolved = resolveHardwareCapabilityProfile({
      tier: 'constrained',
      id: 'owner-wsl-custom',
      ramGbTypical: 4.7,
      capabilityHints: { 'auto-classify': 'local-OK' },
      note: 'custom override for tests',
    });
    expect(resolved?.id).toBe('owner-wsl-custom');
    expect(resolved?.isOverride).toBe(true);
    expect(resolved?.extends).toBe('constrained');
    expect(resolved?.ramGbTypical).toBe(4.7);
    expect(resolved?.capabilityHints['auto-classify']).toBe('local-OK');
    // base hints preserved when not overridden
    expect(resolved?.capabilityHints['security-design']).toBe('frontier-only');
  });

  it('unknown tier throws (fail loud)', () => {
    expect(() => resolveHardwareCapabilityProfile('tpu-cluster' as 'constrained')).toThrow(
      /Unknown hardware capability tier/,
    );
    expect(isHardwareCapabilityTier('constrained')).toBe(true);
    expect(isHardwareCapabilityTier('tpu-cluster')).toBe(false);
  });

  it('model size viability is set-membership on the profile list', () => {
    const c = getHardwareCapabilityPreset('constrained');
    const w = getHardwareCapabilityPreset('workstation');
    expect(isModelSizeViable(c, 'large')).toBe(false);
    expect(isModelSizeViable(w, 'large')).toBe(true);
  });

  it('maps local-ai runtime tiers to hardware vocabulary without applying env', () => {
    expect(hardwareTierForLocalAiTier('daily')).toBe('constrained');
    expect(hardwareTierForLocalAiTier('heavy')).toBe('mainstream');
  });
});
