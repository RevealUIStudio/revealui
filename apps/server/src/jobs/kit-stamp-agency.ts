/**
 * Job handler: kit.stamp.agency (GAP-448 Phase 2 P2-A).
 *
 * After Agency Perpetual (max) purchase mint succeeds, this job:
 * 1. Upserts kit_fulfillments by stripe_event_id
 * 2. Builds thin kit artifact (START-HERE + revforge.json + manifest)
 * 3. Marks ready (no private keys stored)
 * 4. Emails buyer a signed download URL (best-effort)
 *
 * Failures after mint must not reverse payment/mint — retry via job queue.
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import type { Job } from '@revealui/db/schema';
import { kitFulfillments, users } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { mintKitDownloadToken } from '../lib/kit-download-token.js';
import { buildAgencyKitArtifact, resolveAgencyKitBranding } from '../lib/kit-stamp-artifact.js';
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

  if (!(stripeEventId && licenseId && customerId)) {
    throw new Error('kit.stamp.agency requires stripeEventId, licenseId, customerId');
  }

  // Idempotent: already ready
  const [existing] = await db
    .select()
    .from(kitFulfillments)
    .where(eq(kitFulfillments.stripeEventId, stripeEventId))
    .limit(1);

  if (existing?.status === 'ready' && existing.artifact) {
    return { fulfillmentId: existing.id, status: 'ready', deduplicated: true };
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
    const artifact = buildAgencyKitArtifact({
      branding,
      licenseId,
      livemode: Boolean(livemode),
    });

    await db
      .update(kitFulfillments)
      .set({
        status: 'ready',
        artifact,
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

    return { fulfillmentId, status: 'ready' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    await db
      .update(kitFulfillments)
      .set({ status: 'failed', error: message, updatedAt: new Date() })
      .where(eq(kitFulfillments.id, fulfillmentId));
    throw err;
  }
}
