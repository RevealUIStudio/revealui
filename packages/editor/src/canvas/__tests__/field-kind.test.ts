import { describe, expect, it } from 'vitest';
import {
  EDITABLE_THEME_TOKENS,
  fieldKindFromPath,
  fieldPathLeaf,
  isEditableThemeToken,
} from '../field-kind.js';

describe('fieldKindFromPath', () => {
  it('classifies prose paths as text', () => {
    expect(fieldKindFromPath('blocks.0.data.heading')).toBe('text');
    expect(fieldKindFromPath('blocks.1.data.items.0.body')).toBe('text');
    expect(fieldKindFromPath('blocks.2.data.links.0.label')).toBe('text');
  });

  it('classifies href paths as url', () => {
    expect(fieldKindFromPath('blocks.2.data.links.0.href')).toBe('url');
    expect(fieldKindFromPath('cta.href')).toBe('url');
  });

  it('classifies image src paths as media', () => {
    expect(fieldKindFromPath('blocks.3.data.src')).toBe('media');
    expect(fieldKindFromPath('blocks.0.data.imageSrc')).toBe('media');
  });
});

describe('fieldPathLeaf', () => {
  it('returns the last segment', () => {
    expect(fieldPathLeaf('blocks.0.data.heading')).toBe('heading');
    expect(fieldPathLeaf('href')).toBe('href');
  });
});

describe('theme token allowlist', () => {
  it('accepts only the editable brand tokens', () => {
    expect(EDITABLE_THEME_TOKENS.length).toBeGreaterThan(0);
    expect(isEditableThemeToken('--rvui-brand')).toBe(true);
    expect(isEditableThemeToken('--color-primary')).toBe(false);
    expect(isEditableThemeToken('background')).toBe(false);
  });
});
