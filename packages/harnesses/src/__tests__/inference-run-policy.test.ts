import { describe, expect, it } from 'vitest';
import {
  chooseSnapForTier,
  isSignedProductSnap,
  persistSnapAtBoot,
  snapFitsHost,
} from '../server/inference-run-policy.js';

describe('isSignedProductSnap', () => {
  it('accepts the US-origin catalog only', () => {
    expect(isSignedProductSnap('gemma3')).toBe(true);
    expect(isSignedProductSnap('nemotron-3-nano')).toBe(true);
    expect(isSignedProductSnap('ollama')).toBe(false);
    expect(isSignedProductSnap('llama-server')).toBe(false);
    expect(isSignedProductSnap('deepseek-r1')).toBe(false);
  });
});

describe('snapFitsHost', () => {
  it('refuses unsigned names even with plenty of RAM', () => {
    expect(snapFitsHost('llama-server', 64)).toBe(false);
  });

  it('allows gemma3 on the 4GB WSL constrained host', () => {
    expect(snapFitsHost('gemma3', 3.2)).toBe(true);
  });

  it('refuses nemotron-3-nano on ~3Gi available (4GB WSL)', () => {
    expect(snapFitsHost('nemotron-3-nano', 3.2)).toBe(false);
    expect(snapFitsHost('nemotron-3-nano-omni', 3.2)).toBe(false);
  });

  it('allows nemotron-3-nano when available RAM is at least 8Gi', () => {
    expect(snapFitsHost('nemotron-3-nano', 8)).toBe(true);
  });

  it('unknown memory only allows nano-class snaps', () => {
    expect(snapFitsHost('gemma3', null)).toBe(true);
    expect(snapFitsHost('nemotron-3-nano', null)).toBe(false);
  });
});

describe('persistSnapAtBoot', () => {
  it('never enables boot persist on a constrained host', () => {
    expect(persistSnapAtBoot('gemma3', 3.2)).toBe(false);
    expect(persistSnapAtBoot('nemotron-3-nano', 3.2)).toBe(false);
  });

  it('may persist a fitting snap when the host has 8Gi+ available', () => {
    expect(persistSnapAtBoot('gemma3', 8)).toBe(true);
    expect(persistSnapAtBoot('nemotron-3-nano', 8)).toBe(true);
  });
});

describe('chooseSnapForTier', () => {
  it('selects gemma3 for snaps on constrained RAM', () => {
    const choice = chooseSnapForTier('snaps', 3.2);
    expect(choice.snapName).toBe('gemma3');
    expect(choice.demoted).toBe(false);
  });

  it('demotes heavy to gemma3 when nemotron does not fit', () => {
    const choice = chooseSnapForTier('heavy', 3.2);
    expect(choice.snapName).toBe('gemma3');
    expect(choice.demoted).toBe(true);
    expect(choice.reason).toMatch(/does not fit/i);
  });

  it('keeps nemotron for heavy when RAM fits', () => {
    const choice = chooseSnapForTier('heavy', 10);
    expect(choice.snapName).toBe('nemotron-3-nano');
    expect(choice.demoted).toBe(false);
  });
});
