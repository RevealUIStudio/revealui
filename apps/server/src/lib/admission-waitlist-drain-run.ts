/**
 * GAP-256 PR-8 — admission waitlist drain (stale pending/invited → expired).
 * Default off. Schedule is the Hobby dispatcher, not a second vercel.json cron.
 */
import { expireStaleAdmissionWaitlist } from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';

export function isAdmissionWaitlistDrainEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.ADMISSION_WAITLIST_DRAIN_ENABLED === 'true';
}

export interface RunAdmissionWaitlistDrainResult {
  skipped: boolean;
  reason?: string;
  expired?: number;
}

export async function runAdmissionWaitlistDrain(options?: {
  now?: Date;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  expire?: (now: Date) => Promise<number>;
}): Promise<RunAdmissionWaitlistDrainResult> {
  const env = options?.env ?? process.env;
  if (!isAdmissionWaitlistDrainEnabled(env)) {
    return { skipped: true, reason: 'ADMISSION_WAITLIST_DRAIN_ENABLED not true' };
  }
  const now = options?.now ?? new Date();
  const expire = options?.expire ?? expireStaleAdmissionWaitlist;
  const expired = await expire(now);
  logger.info('[admission-waitlist-drain] expired stale rows', { expired });
  return { skipped: false, expired };
}
