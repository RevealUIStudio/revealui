import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: hoisted.logger,
}));

import {
  CRON_SECRET_ENV,
  CRON_SECRET_PREVIOUS_ENV,
  currentRevealuiCronSecret,
  REVEALUI_CRON_SECRET_ENV,
  REVEALUI_CRON_SECRET_PREVIOUS_ENV,
  revealuiCronSecretMatches,
  vercelCronSecretMatches,
} from '../cron-auth.js';

const CURRENT = 'current-cron-secret-value-32chars';
const PREVIOUS = 'previous-cron-secret-value-32char';
const VERCEL_CURRENT = 'vercel-cron-secret-value-32chars!';
const VERCEL_PREVIOUS = 'vercel-cron-secret-previous-32ch!';

const TOUCHED = [
  REVEALUI_CRON_SECRET_ENV,
  REVEALUI_CRON_SECRET_PREVIOUS_ENV,
  CRON_SECRET_ENV,
  CRON_SECRET_PREVIOUS_ENV,
] as const;

function clearSecrets(): void {
  for (const name of TOUCHED) delete process.env[name];
}

beforeEach(() => {
  clearSecrets();
  vi.clearAllMocks();
});

afterEach(() => {
  clearSecrets();
});

describe('revealuiCronSecretMatches', () => {
  it('accepts the current secret', () => {
    process.env.REVEALUI_CRON_SECRET = CURRENT;
    expect(revealuiCronSecretMatches(CURRENT)).toBe(true);
    expect(hoisted.logger.warn).not.toHaveBeenCalled();
  });

  it('accepts the previous secret during an overlap window', () => {
    process.env.REVEALUI_CRON_SECRET = CURRENT;
    process.env.REVEALUI_CRON_SECRET_PREVIOUS = PREVIOUS;
    expect(revealuiCronSecretMatches(PREVIOUS)).toBe(true);
    expect(hoisted.logger.warn).toHaveBeenCalledOnce();
  });

  it('rejects a value that matches neither', () => {
    process.env.REVEALUI_CRON_SECRET = CURRENT;
    process.env.REVEALUI_CRON_SECRET_PREVIOUS = PREVIOUS;
    expect(revealuiCronSecretMatches('wrong-secret-same-ish-length!!')).toBe(false);
    expect(hoisted.logger.warn).not.toHaveBeenCalled();
  });

  it('fail-closes when both env vars are unset or blank', () => {
    expect(revealuiCronSecretMatches(CURRENT)).toBe(false);
    process.env.REVEALUI_CRON_SECRET = '   ';
    process.env.REVEALUI_CRON_SECRET_PREVIOUS = '';
    expect(revealuiCronSecretMatches(CURRENT)).toBe(false);
  });

  it('rejects a missing token', () => {
    process.env.REVEALUI_CRON_SECRET = CURRENT;
    expect(revealuiCronSecretMatches(undefined)).toBe(false);
    expect(revealuiCronSecretMatches('')).toBe(false);
  });

  it('accepts previous alone when current is unset', () => {
    process.env.REVEALUI_CRON_SECRET_PREVIOUS = PREVIOUS;
    expect(revealuiCronSecretMatches(PREVIOUS)).toBe(true);
  });

  it('does not treat the Vercel bearer secret as a RevealUI secret', () => {
    process.env.CRON_SECRET = VERCEL_CURRENT;
    expect(revealuiCronSecretMatches(VERCEL_CURRENT)).toBe(false);
  });
});

describe('vercelCronSecretMatches', () => {
  it('accepts CRON_SECRET and CRON_SECRET_PREVIOUS independently of REVEALUI_CRON_SECRET', () => {
    process.env.CRON_SECRET = VERCEL_CURRENT;
    process.env.CRON_SECRET_PREVIOUS = VERCEL_PREVIOUS;
    process.env.REVEALUI_CRON_SECRET = CURRENT;
    expect(vercelCronSecretMatches(VERCEL_CURRENT)).toBe(true);
    expect(vercelCronSecretMatches(VERCEL_PREVIOUS)).toBe(true);
    expect(vercelCronSecretMatches(CURRENT)).toBe(false);
  });

  it('fail-closes when both Vercel secrets are unset', () => {
    expect(vercelCronSecretMatches(VERCEL_CURRENT)).toBe(false);
  });
});

describe('currentRevealuiCronSecret', () => {
  it('returns the trimmed current secret and ignores previous', () => {
    process.env.REVEALUI_CRON_SECRET = `  ${CURRENT}  `;
    process.env.REVEALUI_CRON_SECRET_PREVIOUS = PREVIOUS;
    expect(currentRevealuiCronSecret()).toBe(CURRENT);
  });

  it('returns undefined when current is unset', () => {
    process.env.REVEALUI_CRON_SECRET_PREVIOUS = PREVIOUS;
    expect(currentRevealuiCronSecret()).toBeUndefined();
  });
});
