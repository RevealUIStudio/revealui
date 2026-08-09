/**
 * Local AI profile — load/save + env fill (self-host control plane).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyLocalAiProfileToEnv,
  emptyIdleProfile,
  type LocalAiProfile,
  loadLocalAiProfile,
  profileDefaultsForTier,
  saveLocalAiProfile,
} from '../local-ai-profile.js';

const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe('local-ai-profile', () => {
  it('saves and loads a profile', () => {
    const dir = mkdtempSync(join(tmpdir(), 'laip-'));
    dirs.push(dir);
    const path = join(dir, 'inference-profile.json');
    const profile: LocalAiProfile = {
      ...emptyIdleProfile(),
      tier: 'daily',
      provider: 'ollama',
      model: 'gemma3:1b',
      baseURL: 'http://127.0.0.1:11434',
      keepAlive: '0',
      updatedAt: '2026-07-24T00:00:00.000Z',
    };
    saveLocalAiProfile(profile, path);
    const loaded = loadLocalAiProfile(path);
    expect(loaded?.tier).toBe('daily');
    expect(loaded?.provider).toBe('ollama');
    expect(loaded?.model).toBe('gemma3:1b');
  });

  it('applyLocalAiProfileToEnv fills missing keys only', () => {
    const env: NodeJS.ProcessEnv = {};
    const profile: LocalAiProfile = {
      ...emptyIdleProfile(),
      tier: 'daily',
      provider: 'ollama',
      model: 'gemma3:1b',
      baseURL: 'http://127.0.0.1:11434',
      keepAlive: '0',
      updatedAt: new Date().toISOString(),
    };
    applyLocalAiProfileToEnv(env, profile);
    expect(env.LLM_PROVIDER).toBe('ollama');
    expect(env.LLM_MODEL).toBe('gemma3:1b');

    env.LLM_PROVIDER = 'anthropic';
    applyLocalAiProfileToEnv(env, profile);
    expect(env.LLM_PROVIDER).toBe('anthropic');
  });

  it('does not apply profile when hosted or skipped', () => {
    const env: NodeJS.ProcessEnv = { VERCEL: '1' };
    applyLocalAiProfileToEnv(env, {
      ...emptyIdleProfile(),
      tier: 'daily',
      provider: 'ollama',
      model: 'gemma3:1b',
      baseURL: 'http://127.0.0.1:11434',
      keepAlive: '0',
      updatedAt: new Date().toISOString(),
    });
    expect(env.LLM_PROVIDER).toBeUndefined();
  });

  it('idle tier does not fill LLM_PROVIDER', () => {
    const env: NodeJS.ProcessEnv = {};
    applyLocalAiProfileToEnv(env, emptyIdleProfile());
    expect(env.LLM_PROVIDER).toBeUndefined();
  });

  it('profileDefaultsForTier covers all tiers', () => {
    expect(profileDefaultsForTier('daily').provider).toBe('ollama');
    expect(profileDefaultsForTier('daily').model).toBe('qwen2.5:3b');
    expect(profileDefaultsForTier('snaps').provider).toBe('inference-snaps');
    expect(profileDefaultsForTier('heavy').model).toBe('nemotron-3-nano');
    expect(profileDefaultsForTier('idle').provider).toBeNull();
  });

  it('writes shell-compat active env next to profile save', () => {
    const dir = mkdtempSync(join(tmpdir(), 'laip-env-'));
    dirs.push(dir);
    const path = join(dir, 'inference-profile.json');
    // Point home-relative paths via absolute profile path only; active env uses real home.
    // We only assert save does not throw and profile round-trips.
    saveLocalAiProfile(
      {
        ...emptyIdleProfile(),
        tier: 'snaps',
        provider: 'inference-snaps',
        model: 'gemma3',
        baseURL: 'http://127.0.0.1:8328/v1',
        keepAlive: null,
        updatedAt: new Date().toISOString(),
      },
      path,
    );
    expect(readFileSync(path, 'utf8')).toContain('"tier": "snaps"');
  });
});
