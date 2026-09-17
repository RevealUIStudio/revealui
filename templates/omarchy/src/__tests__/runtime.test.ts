import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { archSnapWarning, loadRuntime, parseRuntime } from '../runtime.js';

const EXAMPLE = join(dirname(fileURLToPath(import.meta.url)), '../../runtime.example.json');

describe('Omarchy runtime config', () => {
  it('ships sku null, Quattro test target, and URL-only inference', () => {
    const runtime = loadRuntime(EXAMPLE);
    expect(runtime.sku).toBeNull();
    expect(runtime.testedOn).toBe('Omarchy Quattro');
    expect(runtime.supportedOn).toEqual(['Omarchy', 'Ubuntu', 'WSL', 'macOS']);
    expect(runtime.inference.preferred).toBe('openai-compatible');
    expect(runtime.inference.openaiCompatible.env).toBe('OPENAI_BASE_URL');
    expect(runtime.inference.ollama.env).toBe('OLLAMA_BASE_URL');
    expect(runtime.inference.hostSnaps.env).toBe('INFERENCE_SNAPS_BASE_URL');
    expect(runtime.inference.hostSnaps.note?.toLowerCase().includes('do not')).toBe(true);
    expect(runtime.install.createRevealui).toBe('npx create-revealui@latest');
    expect(runtime.install.docker).toBe('docker compose up -d');
    expect(runtime.streamSafe.tip.toLowerCase().includes('stream_safe')).toBe(true);
  });

  it('rejects a cash-ladder SKU and unknown public-template flags', () => {
    const runtime = loadRuntime(EXAMPLE);
    expect(() => parseRuntime({ ...runtime, sku: 'omarchy-pro' })).toThrow();
    expect(() => parseRuntime({ ...runtime, force_publish: true })).toThrow();
    expect(() => parseRuntime({ ...runtime, admin_bypass: true })).toThrow();
  });

  it('warns against reimplementing Ubuntu snaps on Arch', () => {
    const warning = archSnapWarning().toLowerCase();
    expect(warning.includes('do not reimplement')).toBe(true);
    expect(warning.includes('arch')).toBe(true);
    expect(warning.includes('openai-compatible') || warning.includes('ollama')).toBe(true);
  });
});
