/**
 * Timing-safe cron credential check with a one-secret overlap window.
 *
 * Steady state reads a single env var. During rotation the owner sets the
 * matching `*_PREVIOUS` var to the outgoing value and the unsuffixed var to
 * the incoming value. Callers still presenting the old value succeed until
 * `*_PREVIOUS` is removed. This module never generates or stores a secret.
 *
 * Accepted env vars:
 * - `REVEALUI_CRON_SECRET` — current `X-Cron-Secret` (and admin Bearer) value
 * - `REVEALUI_CRON_SECRET_PREVIOUS` — outgoing value; unset outside a rotation
 * - `CRON_SECRET` — Vercel platform cron `Authorization: Bearer` value
 * - `CRON_SECRET_PREVIOUS` — outgoing Vercel bearer; unset outside a rotation
 *
 * There is no comma-separated accept-list. Fan-out to sub-jobs always sends
 * the current `REVEALUI_CRON_SECRET`, never the previous value.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';

export const REVEALUI_CRON_SECRET_ENV = 'REVEALUI_CRON_SECRET';
export const REVEALUI_CRON_SECRET_PREVIOUS_ENV = 'REVEALUI_CRON_SECRET_PREVIOUS';
export const CRON_SECRET_ENV = 'CRON_SECRET';
export const CRON_SECRET_PREVIOUS_ENV = 'CRON_SECRET_PREVIOUS';

function readSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function timingSafeMatch(provided: string, secret: string | undefined): boolean {
  if (!secret) return false;
  try {
    const providedBytes = Buffer.from(provided);
    const secretBytes = Buffer.from(secret);
    return (
      providedBytes.length === secretBytes.length && timingSafeEqual(providedBytes, secretBytes)
    );
  } catch {
    return false;
  }
}

/** Current fan-out secret. Previous is never forwarded to sub-jobs. */
export function currentRevealuiCronSecret(): string | undefined {
  return readSecret(REVEALUI_CRON_SECRET_ENV);
}

/**
 * True when `provided` matches `REVEALUI_CRON_SECRET`, or during a rotation
 * window `REVEALUI_CRON_SECRET_PREVIOUS`. Fail closed when neither is set.
 */
export function revealuiCronSecretMatches(provided: string | undefined): boolean {
  if (!provided) return false;
  if (timingSafeMatch(provided, readSecret(REVEALUI_CRON_SECRET_ENV))) return true;
  if (timingSafeMatch(provided, readSecret(REVEALUI_CRON_SECRET_PREVIOUS_ENV))) {
    logger.warn(
      'cron secret rotation in flight: X-Cron-Secret matched REVEALUI_CRON_SECRET_PREVIOUS',
    );
    return true;
  }
  return false;
}

/**
 * True when `provided` matches `CRON_SECRET`, or during a rotation window
 * `CRON_SECRET_PREVIOUS`. Fail closed when neither is set.
 */
export function vercelCronSecretMatches(provided: string | undefined): boolean {
  if (!provided) return false;
  if (timingSafeMatch(provided, readSecret(CRON_SECRET_ENV))) return true;
  if (timingSafeMatch(provided, readSecret(CRON_SECRET_PREVIOUS_ENV))) {
    logger.warn('cron secret rotation in flight: bearer token matched CRON_SECRET_PREVIOUS');
    return true;
  }
  return false;
}
