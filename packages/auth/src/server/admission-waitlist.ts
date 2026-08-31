/**
 * GAP-256 PR-4 — admission_waitlist I/O (NOT marketing waitlist).
 *
 * Stores only SHA-256 of claim tokens. Raw token returned once at enqueue.
 */

import { createHash, randomBytes } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { type AdmissionWaitlistRow, admissionWaitlist } from '@revealui/db/schema';
import { and, count, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashAdmissionToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateAdmissionToken(): string {
  return randomBytes(32).toString('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function expiresAtFrom(now: Date): Date {
  return new Date(now.getTime() + TOKEN_TTL_MS);
}

async function countPendingRows(): Promise<number | null> {
  try {
    const db = getClient();
    const [row] = await db
      .select({ total: count() })
      .from(admissionWaitlist)
      .where(eq(admissionWaitlist.status, 'pending'));
    return row?.total ?? 0;
  } catch (err) {
    logger.warn('[admission-waitlist] pending count failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export interface EnqueueAdmissionWaitlistParams {
  email: string;
  snapshotId: string | null;
  modeAtEnqueue?: string;
  source?: string;
  now?: Date;
}

export interface EnqueueAdmissionWaitlistResult {
  waitlistToken: string;
  positionEstimate: number | null;
  id: string;
}

/**
 * Insert or rotate a pending admission waitlist row for email.
 * Returns a fresh raw token (never stored).
 */
export async function enqueueAdmissionWaitlist(
  params: EnqueueAdmissionWaitlistParams,
): Promise<EnqueueAdmissionWaitlistResult> {
  const db = getClient();
  const email = normalizeEmail(params.email);
  const now = params.now ?? new Date();
  const rawToken = generateAdmissionToken();
  const tokenHash = hashAdmissionToken(rawToken);
  const expiresAt = expiresAtFrom(now);
  const modeAtEnqueue = params.modeAtEnqueue ?? 'waitlist';
  const source = params.source ?? 'free_signup';

  const [existing] = await db
    .select({
      id: admissionWaitlist.id,
      position: admissionWaitlist.position,
    })
    .from(admissionWaitlist)
    .where(and(eq(admissionWaitlist.email, email), eq(admissionWaitlist.status, 'pending')))
    .limit(1);

  if (existing) {
    await db
      .update(admissionWaitlist)
      .set({
        tokenHash,
        snapshotId: params.snapshotId,
        modeAtEnqueue,
        source,
        expiresAt,
      })
      .where(eq(admissionWaitlist.id, existing.id));

    return {
      waitlistToken: rawToken,
      positionEstimate: existing.position,
      id: existing.id,
    };
  }

  const pendingCount = await countPendingRows();
  const positionEstimate = pendingCount === null ? null : pendingCount + 1;
  const id = crypto.randomUUID();

  try {
    await db.insert(admissionWaitlist).values({
      id,
      email,
      status: 'pending',
      tokenHash,
      snapshotId: params.snapshotId,
      modeAtEnqueue,
      position: positionEstimate,
      source,
      metadata: {},
      createdAt: now,
      expiresAt,
    });
  } catch (err) {
    // Race on unique pending email: rotate the winning row's token.
    logger.warn('[admission-waitlist] insert conflict; rotating existing pending', {
      error: err instanceof Error ? err.message : String(err),
    });
    const [raced] = await db
      .select({
        id: admissionWaitlist.id,
        position: admissionWaitlist.position,
      })
      .from(admissionWaitlist)
      .where(and(eq(admissionWaitlist.email, email), eq(admissionWaitlist.status, 'pending')))
      .limit(1);
    if (!raced) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    await db
      .update(admissionWaitlist)
      .set({
        tokenHash,
        snapshotId: params.snapshotId,
        modeAtEnqueue,
        source,
        expiresAt,
      })
      .where(eq(admissionWaitlist.id, raced.id));
    return {
      waitlistToken: rawToken,
      positionEstimate: raced.position,
      id: raced.id,
    };
  }

  return {
    waitlistToken: rawToken,
    positionEstimate,
    id,
  };
}

/** Active claim rows: pending or invited, not past expiresAt. */
export async function getAdmissionWaitlistByToken(
  rawToken: string,
): Promise<AdmissionWaitlistRow | null> {
  if (!rawToken || rawToken.trim() === '') {
    return null;
  }
  const db = getClient();
  const tokenHash = hashAdmissionToken(rawToken);
  const now = new Date();

  const [row] = await db
    .select()
    .from(admissionWaitlist)
    .where(
      and(
        eq(admissionWaitlist.tokenHash, tokenHash),
        inArray(admissionWaitlist.status, ['pending', 'invited']),
        or(isNull(admissionWaitlist.expiresAt), gt(admissionWaitlist.expiresAt, now)),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function getAdmissionWaitlistByTokenAnyStatus(
  rawToken: string,
): Promise<AdmissionWaitlistRow | null> {
  if (!rawToken || rawToken.trim() === '') {
    return null;
  }
  const db = getClient();
  const tokenHash = hashAdmissionToken(rawToken);
  const [row] = await db
    .select()
    .from(admissionWaitlist)
    .where(eq(admissionWaitlist.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

export async function markAdmissionWaitlistConverted(id: string, now?: Date): Promise<void> {
  const db = getClient();
  const convertedAt = now ?? new Date();
  await db
    .update(admissionWaitlist)
    .set({
      status: 'converted',
      convertedAt,
    })
    .where(eq(admissionWaitlist.id, id));
}

/** Mask email for public status (anti-enumeration still requires valid token). */
export function maskAdmissionEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf('@');
  if (at <= 0) {
    return '***';
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/** True when a waitlist row is claim-dead and should drain to `expired`. */
export function shouldExpireWaitlistRow(
  row: {
    status: string;
    expiresAt: Date | null;
  },
  now: Date,
): boolean {
  if (row.status !== 'pending' && row.status !== 'invited') return false;
  if (row.expiresAt == null) return false;
  return row.expiresAt.getTime() < now.getTime();
}

/**
 * GAP-256 PR-8 — mark stale pending/invited rows expired.
 * Flag gating lives in the cron runner (ADMISSION_WAITLIST_DRAIN_ENABLED).
 */
export async function expireStaleAdmissionWaitlist(now?: Date): Promise<number> {
  const db = getClient();
  const cutoff = now ?? new Date();
  const rows = await db
    .update(admissionWaitlist)
    .set({ status: 'expired' })
    .where(
      and(
        inArray(admissionWaitlist.status, ['pending', 'invited']),
        isNotNull(admissionWaitlist.expiresAt),
        lt(admissionWaitlist.expiresAt, cutoff),
      ),
    )
    .returning();
  return rows.length;
}

/** Position estimate among pending (best-effort; null on failure). */
export async function estimateAdmissionWaitlistPosition(id: string): Promise<number | null> {
  try {
    const db = getClient();
    const [self] = await db
      .select({
        position: admissionWaitlist.position,
        createdAt: admissionWaitlist.createdAt,
      })
      .from(admissionWaitlist)
      .where(eq(admissionWaitlist.id, id))
      .limit(1);
    if (!self) return null;
    if (self.position != null) return self.position;

    const [row] = await db
      .select({ total: count() })
      .from(admissionWaitlist)
      .where(
        and(
          eq(admissionWaitlist.status, 'pending'),
          sql`${admissionWaitlist.createdAt} <= ${self.createdAt}`,
        ),
      );
    return row?.total ?? null;
  } catch {
    return null;
  }
}
