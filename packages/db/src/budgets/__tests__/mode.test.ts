import { afterEach, describe, expect, it } from 'vitest';
import { configureBudgetsMode, currentBudgetsMode, parseBudgetsMode } from '../mode.js';

const ENV_KEY = 'REVEALUI_BUDGETS_MODE';

afterEach(() => {
  configureBudgetsMode(null);
  delete process.env[ENV_KEY];
});

describe('REVEALUI_BUDGETS_MODE', () => {
  it('defaults to off when unset or empty', () => {
    delete process.env[ENV_KEY];
    expect(currentBudgetsMode()).toBe('off');
    expect(parseBudgetsMode('')).toBe('off');
    expect(parseBudgetsMode(null)).toBe('off');
  });

  it('reads off, shadow, and enforce', () => {
    expect(parseBudgetsMode('off')).toBe('off');
    expect(parseBudgetsMode('shadow')).toBe('shadow');
    expect(parseBudgetsMode('enforce')).toBe('enforce');
  });

  it('fails closed to enforce for an unknown value', () => {
    process.env[ENV_KEY] = 'TRUE';
    expect(currentBudgetsMode()).toBe('enforce');
    expect(parseBudgetsMode('sometimes')).toBe('enforce');
  });

  it('lets a test override beat the env var', () => {
    process.env[ENV_KEY] = 'off';
    configureBudgetsMode('shadow');
    expect(currentBudgetsMode()).toBe('shadow');
  });
});
