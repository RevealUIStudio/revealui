/**
 * Agency Founding Kit stamp-on-payment handler (GAP-448 Phase 2).
 *
 * Job name: `kit.stamp.agency`
 * Spec: .jv docs/specs/2026-08-02-gap-448-phase2-stamp-deliver.md
 *
 * P2-A (default): thin artifact package on kit_fulfillments.
 * P2-B (REVEALUI_KIT_STAMP_MODE=full): mode=full + thin package until Fly worker ships.
 */

import { createHash, randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import type { Job } from '@revealui/db/schema';
import {
  type KitArtifactMeta,
  type KitFulfillmentStatus,
  kitFulfillments,
} from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import {
  buildThinKitPackage,
  type KitArtifactMode,
  type KitBranding,
  resolveKitBranding,
  resolveKitStampMode,
} from './kit-stamp-agency-lib.js';

export type { KitArtifactMode, KitBranding, ThinKitPackage } from './kit-stamp-agency-lib.js';
export {
  buildThinKitPackage,
  resolveKitBranding,
  resolveKitStampMode,
} from './kit-stamp-agency-lib.js';

export const KIT_STAMP_AGENCY_JOB = 'kit.stamp.agency' as const;

export interface KitStampAgencyPayload extends Record<string, unknown> {
  stripeEventId: string;
  licenseId: string;
  userId: string | null;
  customerId: string;
  livemode: boolean;
  githubUsername?: string | null;
  branding?: Partial<KitBranding>;
  buyerEmail?: string | null;
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Durable handler: upsert fulfillment, produce thin artifact (P2-A) or mark
 * full-mode deferred (P2-B path until Fly worker exists).
 */
export async function kitStampAgencyHandler(
  data: KitStampAgencyPayload,
  _job: Job,
): Promise<{ status: KitFulfillmentStatus; fulfillmentId: string; mode: KitArtifactMode }> {
  const db = getClient();
  const mode = resolveKitStampMode();
  const branding = resolveKitBranding({
    branding: data.branding,
    buyerEmail: data.buyerEmail,
    customerId: data.customerId,
  });

  const [existing] = await db
    .select()
    .from(kitFulfillments)
    .where(eq(kitFulfillments.stripeEventId, data.stripeEventId))
    .limit(1);

  if (existing?.status === 'ready') {
    return {
      status: 'ready',
      fulfillmentId: existing.id,
      mode: existing.artifactMode,
    };
  }

  const fulfillmentId = existing?.id ?? randomUUID();
  const livemode = data.livemode ? 'live' : 'test';

  if (!existing) {
    await db.insert(kitFulfillments).values({
      id: fulfillmentId,
      stripeEventId: data.stripeEventId,
      licenseId: data.licenseId,
      userId: data.userId,
      customerId: data.customerId,
      tier: 'max',
      status: 'running',
      artifactMode: mode,
      branding,
      livemode,
    });
  } else {
    await db
      .update(kitFulfillments)
      .set({ status: 'running', artifactMode: mode, branding, error: null })
      .where(eq(kitFulfillments.id, fulfillmentId));
  }

  try {
    const thin = buildThinKitPackage({
      branding,
      licenseId: data.licenseId,
      customerId: data.customerId,
    });
    const body = JSON.stringify(thin);
    const hash = sha256Hex(body);

    const artifact: KitArtifactMeta =
      mode === 'full'
        ? {
            mode: 'full',
            templateVersion: 'gap-448-p2b-deferred',
            note:
              'Full kit tarball requires long-running stamp worker (P2-B). ' +
              'Thin package attached; use revforge stamp.sh offline for full kit.',
            uri: `inline:thin+deferred-full:${hash.slice(0, 16)}`,
            contentSha256: hash,
            package: thin as unknown as Record<string, unknown>,
          }
        : {
            mode: 'thin',
            uri: `inline:agency-kit:${hash.slice(0, 16)}`,
            contentSha256: hash,
            templateVersion: 'gap-448-p2a-v1',
            note: 'Thin package (manifest + START-HERE + revforge config). License JWT is not re-stored here.',
            package: thin as unknown as Record<string, unknown>,
          };

    await db
      .update(kitFulfillments)
      .set({
        status: 'ready',
        artifact,
        error: null,
        licenseId: data.licenseId,
        userId: data.userId,
      })
      .where(eq(kitFulfillments.id, fulfillmentId));

    logger.info('[kit.stamp.agency] fulfillment ready', {
      fulfillmentId,
      mode,
      stripeEventId: data.stripeEventId,
      slug: branding.slug,
    });

    return { status: 'ready', fulfillmentId, mode };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(kitFulfillments)
      .set({ status: 'failed', error: message.slice(0, 500) })
      .where(eq(kitFulfillments.id, fulfillmentId));
    logger.error('[kit.stamp.agency] fulfillment failed', undefined, {
      fulfillmentId,
      detail: message,
    });
    throw err;
  }
}
