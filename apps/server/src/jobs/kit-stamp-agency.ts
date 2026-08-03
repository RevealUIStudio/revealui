/**
 * Job handler: kit.stamp.agency (GAP-448 Phase 2).
 *
 * After Agency Perpetual (max) purchase mint succeeds, this job:
 * 1. Upserts kit_fulfillments by stripe_event_id
 * 2. Builds kit artifact (thin text package, or full tar.gz + R2 when mode=full)
 * 3. Marks ready (no private keys stored)
 * 4. Emails buyer a signed download URL (best-effort)
 *
 * Failures after mint must not reverse payment/mint — retry via job queue.
 *
 * Modes (REVEALUI_KIT_STAMP_MODE):
 * - thin (default): jsonb artifact only (P2-A)
 * - full: package tar.gz → R2 artifact_uri; optional stamp.sh on long workers
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import type { Job } from '@revealui/db/schema';
import { kitFulfillments, users } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { mintKitDownloadToken } from '../lib/kit-download-token.js';
import { buildAgencyKitArtifact, resolveAgencyKitBranding } from '../lib/kit-stamp-artifact.js';
import { resolveKitStampMode } from '../lib/kit-stamp-mode.js';
import { produceFullKitArchive } from '../lib/kit-stamp-run.js';
import { uploadAgencyKitTarball } from '../lib/kit-stamp-storage.js';
import { sendAgencyKitPackageEmail } from '../lib/webhook-emails.js';

export interface KitStampAgencyPayload extends Record<string, unknown> {
  stripeEventId: string;
  licenseId: string;
  userId: string;
  customerId: string;
  livemode: boolean;
  branding?: {
    company?: string | null;
    slug?: string | null;
    brand?: string | null;
    email?: string | null;
  };
}

export interface KitStampAgencyResult {
  fulfillmentId: string;
  status: string;
  deduplicated?: boolean;
  mode?: 'thin' | 'full';
  stampSource?: 'package' | 'revforge-stamp';
}

function apiPublicBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    process.env.API_URL?.replace(/\/$/, '') ||
    'https://api.revealui.com'
  );
}

export async function kitStampAgencyHandler(
  data: KitStampAgencyPayload,
  _job: Job,
): Promise<KitStampAgencyResult> {
  // Infer client type from getClient(); root @revealui/db Database is types/database.
  const db = getClient();
  const { stripeEventId, licenseId, userId, customerId, livemode, branding: brandingIn } = data;
  const mode = resolveKitStampMode();

  if (!(stripeEventId && licenseId && customerId)) {
    throw new Error('kit.stamp.agency requires stripeEventId, licenseId, customerId');
  }

  // Idempotent: already ready (thin needs artifact; full needs uri or artifact)
  const [existing] = await db
    .select()
    .from(kitFulfillments)
    .where(eq(kitFulfillments.stripeEventId, stripeEventId))
    .limit(1);

  if (existing?.status === 'ready' && (existing.artifact || existing.artifactUri)) {
    return { fulfillmentId: existing.id, status: 'ready', deduplicated: true, mode };
  }

  // Resolve buyer email
  let email = brandingIn?.email?.trim() || '';
  if (!email && userId) {
    const [u] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    email = u?.email?.trim() || '';
  }
  if (!email) {
    email = `buyer+${customerId.slice(0, 12)}@customers.revealui.com`;
  }

  const branding = resolveAgencyKitBranding({
    company: brandingIn?.company,
    slug: brandingIn?.slug,
    brand: brandingIn?.brand,
    email,
  });

  const fulfillmentId = existing?.id ?? randomUUID();

  if (!existing) {
    await db.insert(kitFulfillments).values({
      id: fulfillmentId,
      stripeEventId,
      licenseId,
      userId: userId || null,
      customerId,
      tier: 'max',
      status: 'running',
      branding,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(kitFulfillments)
      .set({ status: 'running', branding, error: null, updatedAt: new Date() })
      .where(eq(kitFulfillments.id, existing.id));
  }

  try {
    const packageFormat = mode === 'full' ? 'tar.gz' : 'text';
    let artifact = buildAgencyKitArtifact({
      branding,
      licenseId,
      livemode: Boolean(livemode),
      packageFormat,
    });

    let artifactUri: string | null = null;
    let stampSource: 'package' | 'revforge-stamp' | undefined;

    if (mode === 'full') {
      const produced = await produceFullKitArchive({ branding, artifact });
      stampSource = produced.stampSource;
      artifact = { ...artifact, stampSource, packageFormat: 'tar.gz' };

      const uploaded = await uploadAgencyKitTarball({
        fulfillmentId,
        slug: branding.slug,
        livemode: Boolean(livemode),
        body: produced.tarGz,
      });
      artifactUri = uploaded.url;

      logger.info('Agency kit full package uploaded', {
        fulfillmentId,
        key: uploaded.key,
        size: uploaded.size,
        stampSource,
      });
    }

    await db
      .update(kitFulfillments)
      .set({
        status: 'ready',
        artifact,
        artifactUri,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(kitFulfillments.id, fulfillmentId));

    // Best-effort download email (mint already emailed the JWT)
    try {
      const token = mintKitDownloadToken(fulfillmentId);
      const downloadUrl = `${apiPublicBase()}/api/kits/agency-founding/download?token=${encodeURIComponent(token)}`;
      await sendAgencyKitPackageEmail(branding.email, {
        company: branding.company,
        downloadUrl,
        licensePageUrl: `${(process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.revealui.com').replace(/\/$/, '')}/account/license`,
      });
    } catch (err) {
      logger.warn('Kit package email failed (fulfillment still ready)', {
        fulfillmentId,
        detail: err instanceof Error ? err.message : 'unknown',
      });
    }

    return { fulfillmentId, status: 'ready', mode, stampSource };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    await db
      .update(kitFulfillments)
      .set({ status: 'failed', error: message, updatedAt: new Date() })
      .where(eq(kitFulfillments.id, fulfillmentId));
    throw err;
  }
}
