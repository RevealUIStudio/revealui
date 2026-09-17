import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OMARCHY_AGENT_SPEC, OMARCHY_INSTRUCTIONS } from '../agent-spec.js';
import { loadRuntime } from '../runtime.js';

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const README = readFileSync(join(TEMPLATE_ROOT, 'README.md'), 'utf8');
const RUNTIME = loadRuntime(join(TEMPLATE_ROOT, 'runtime.example.json'));

const FORBIDDEN = [
  'CapCut',
  'capcut',
  'only runs on Omarchy',
  'buy Omarchy',
  'Railway is production',
  'snap install on Arch',
] as const;

function blob(): string {
  return [
    README,
    JSON.stringify(RUNTIME),
    JSON.stringify(OMARCHY_AGENT_SPEC),
    OMARCHY_INSTRUCTIONS,
  ].join('\n');
}

describe('Omarchy honesty', () => {
  it('states the Omarchy plus Ubuntu/WSL/macOS beat and the Quattro test target', () => {
    expect(README.includes('Runs great on Omarchy')).toBe(true);
    expect(README.includes('Also Ubuntu, WSL, and macOS')).toBe(true);
    expect(README.includes('Omarchy Quattro')).toBe(true);
    expect(README.includes('No exclusivity claim')).toBe(true);
    expect(README.includes('STREAM_SAFE=1')).toBe(true);
    expect(README.includes('npx create-revealui@latest')).toBe(true);
    expect(README.includes('docker compose up -d')).toBe(true);
  });

  it('does not overclaim exclusivity, CapCut, or Railway-as-prod', () => {
    const text = blob();
    for (const phrase of FORBIDDEN) {
      expect(text.includes(phrase), `omarchy copy must not include ${phrase}`).toBe(false);
    }
    expect(README.includes('Railway as production')).toBe(true);
    expect(README.toLowerCase().includes('railway is production')).toBe(false);
    expect(README.toLowerCase().includes('not required for consultation')).toBe(true);
  });

  it('keeps sku null on the runtime file', () => {
    expect(RUNTIME.sku).toBeNull();
    expect(Object.hasOwn(RUNTIME, 'price')).toBe(false);
  });
});
