import { describe, expect, it } from 'vitest';
import { shouldShowUpgradeNavItem } from '../should-show-upgrade-nav';

describe('shouldShowUpgradeNavItem', () => {
  const base = { isFleetMode: false, isLoading: false, resolveError: null };

  it('shows for free and pro', () => {
    expect(shouldShowUpgradeNavItem('free', base)).toBe(true);
    expect(shouldShowUpgradeNavItem('pro', base)).toBe(true);
  });

  it('shows for max (enterprise still above)', () => {
    expect(shouldShowUpgradeNavItem('max', base)).toBe(true);
  });

  it('hides for enterprise (top commercial tier / founder grant)', () => {
    expect(shouldShowUpgradeNavItem('enterprise', base)).toBe(false);
  });

  it('hides in fleet mode', () => {
    expect(shouldShowUpgradeNavItem('free', { ...base, isFleetMode: true })).toBe(false);
  });

  it('hides while loading or on resolve error', () => {
    expect(shouldShowUpgradeNavItem('free', { ...base, isLoading: true })).toBe(false);
    expect(shouldShowUpgradeNavItem('free', { ...base, resolveError: 'unavailable' })).toBe(false);
  });
});
