import { describe, expect, it } from 'vitest';
import { generateVSCodeExtensions, generateVSCodeSettings } from '../vscode/index.js';

describe('generateVSCodeSettings', () => {
  it('sets Biome as default formatter', () => {
    const settings = generateVSCodeSettings();
    expect(settings['editor.defaultFormatter']).toBe('biomejs.biome');
  });

  it('enables format on save', () => {
    const settings = generateVSCodeSettings();
    expect(settings['editor.formatOnSave']).toBe(true);
  });

  it('sets Biome for all JS/TS language overrides', () => {
    const settings = generateVSCodeSettings();
    expect(settings['[typescript]']['editor.defaultFormatter']).toBe('biomejs.biome');
    expect(settings['[typescriptreact]']['editor.defaultFormatter']).toBe('biomejs.biome');
    expect(settings['[javascript]']['editor.defaultFormatter']).toBe('biomejs.biome');
    expect(settings['[javascriptreact]']['editor.defaultFormatter']).toBe('biomejs.biome');
    expect(settings['[json]']['editor.defaultFormatter']).toBe('biomejs.biome');
    expect(settings['[jsonc]']['editor.defaultFormatter']).toBe('biomejs.biome');
  });

  it('points typescript.tsdk at node_modules', () => {
    const settings = generateVSCodeSettings();
    expect(settings['typescript.tsdk']).toBe('node_modules/typescript/lib');
    expect(settings['typescript.enablePromptUseWorkspaceTsdk']).toBe(true);
  });

  it('includes Tailwind CVA class regex', () => {
    const settings = generateVSCodeSettings();
    expect(settings['tailwindCSS.experimental.classRegex']).toHaveLength(2);
    expect(settings['tailwindCSS.experimental.classRegex'][0]![0]).toContain('cva');
    expect(settings['tailwindCSS.experimental.classRegex'][1]![0]).toContain('cx');
  });
});

describe('generateVSCodeExtensions', () => {
  it('includes Biome extension', () => {
    const { recommendations } = generateVSCodeExtensions();
    expect(recommendations).toContain('biomejs.biome');
  });

  it('includes Tailwind CSS extension', () => {
    const { recommendations } = generateVSCodeExtensions();
    expect(recommendations).toContain('bradlc.vscode-tailwindcss');
  });

  it('includes Drizzle extension', () => {
    const { recommendations } = generateVSCodeExtensions();
    expect(recommendations).toContain('drizzle-team.drizzle-vscode');
  });

  it('returns an array of strings', () => {
    const { recommendations } = generateVSCodeExtensions();
    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.every((r) => typeof r === 'string')).toBe(true);
  });
});
