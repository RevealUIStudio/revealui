import { describe, expect, it } from 'vitest';
import { resolveKitStampMode } from '../kit-stamp-mode.js';

describe('resolveKitStampMode', () => {
  it('defaults to thin', () => {
    expect(resolveKitStampMode({})).toBe('thin');
    expect(resolveKitStampMode({ REVEALUI_KIT_STAMP_MODE: '' })).toBe('thin');
    expect(resolveKitStampMode({ REVEALUI_KIT_STAMP_MODE: 'weird' })).toBe('thin');
  });

  it('accepts full (case-insensitive)', () => {
    expect(resolveKitStampMode({ REVEALUI_KIT_STAMP_MODE: 'full' })).toBe('full');
    expect(resolveKitStampMode({ REVEALUI_KIT_STAMP_MODE: 'FULL' })).toBe('full');
  });
});
