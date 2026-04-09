import { describe, expect, it } from 'vitest';
import { generateZedSettings } from '../zed/index.js';

describe('generateZedSettings', () => {
  it('uses Biome as external formatter', () => {
    const settings = generateZedSettings();
    expect(settings.formatter.external.command).toBe('biome');
    expect(settings.formatter.external.arguments).toContain('format');
    expect(settings.formatter.external.arguments).toContain('--write');
  });

  it('enables format on save', () => {
    const settings = generateZedSettings();
    expect(settings.format_on_save).toBe('on');
  });

  it('uses 2-space indentation', () => {
    const settings = generateZedSettings();
    expect(settings.tab_size).toBe(2);
    expect(settings.hard_tabs).toBe(false);
  });

  it('sets Biome formatter for TypeScript and TSX', () => {
    const settings = generateZedSettings();
    expect(settings.languages.TypeScript.formatter?.external.command).toBe('biome');
    expect(settings.languages.TSX.formatter?.external.command).toBe('biome');
  });

  it('sets tab_size for all configured languages', () => {
    const settings = generateZedSettings();
    expect(settings.languages.TypeScript.tab_size).toBe(2);
    expect(settings.languages.TSX.tab_size).toBe(2);
    expect(settings.languages.JavaScript.tab_size).toBe(2);
    expect(settings.languages.JSON.tab_size).toBe(2);
  });
});
