import { getStudioFulfillmentConfig } from '@revealui/config';
import {
  ConsultationDnsProofSchema,
  ConsultationHostnameInputSchema,
  ConsultationVerificationSchema,
  SiteConsultationDomainSchema,
} from '@revealui/contracts/entities';
import { getRestClient } from '@revealui/db/client';
import { getSiteContentActor } from '@revealui/db/queries/sites';
import { isPlatformSuperAdmin } from '@revealui/utils/validation';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { requireSessionWithMfa } from '@/lib/auth/require-mfa';
import { rejectRecoverySession } from '@/lib/utils/recovery-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Provider attachment can include multiple bounded ownership and DNS checks.
const FULFILLMENT_DEADLINE_MS = 90_000;
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const material = z.string().trim().min(1).max(30000);
const identity = { bookingId: identifier, buyerUserId: identifier };
const inputSchema = z.discriminatedUnion('action', [
  z.strictObject({
    ...identity,
    action: z.literal('prepare'),
    notes: material,
    nextStep: material,
    domainPack: z
      .strictObject({
        dns: material,
        path: material,
        'proof-gap': material,
        stack: material,
        onboarding: material,
        walkthrough: material,
      })
      .optional(),
  }),
  z.strictObject({ ...identity, action: z.literal('publish'), sessionId: identifier }),
  z.strictObject({ ...identity, action: z.literal('revoke') }),
  z.strictObject({ ...identity, action: z.literal('reconcile') }),
  z.strictObject({
    ...identity,
    action: z.literal('attach-domain'),
    hostname: ConsultationHostnameInputSchema,
  }),
  z.strictObject({ ...identity, action: z.literal('detach-domain') }),
  z.strictObject({
    ...identity,
    action: z.literal('resolve-domain-pack'),
    chargeId: z.string().regex(/^ch_[a-zA-Z0-9]+$/),
    decision: z.enum(['retained', 'revoked']),
  }),
]);
const resultSchema = z
  .object({
    status: z.enum([
      'draft',
      'published',
      'revoked',
      'reconciled',
      'domain-pack-review-resolved',
      'domain-attached',
      'domain-pending-verification',
      'domain-detached',
    ]),
    siteId: identifier,
    sessionId: identifier.optional(),
    delivered: z.boolean(),
    decision: z.enum(['retained', 'revoked']).optional(),
    customDomainAttached: z.boolean().optional(),
    domain: SiteConsultationDomainSchema.nullable().optional(),
    hostname: ConsultationHostnameInputSchema.optional(),
    verification: ConsultationVerificationSchema.optional(),
    dns: ConsultationDnsProofSchema.optional(),
  })
  .refine(
    (value) =>
      (value.status === 'published') === value.delivered &&
      (!['draft', 'published'].includes(value.status) || Boolean(value.sessionId)) &&
      (value.status !== 'domain-pack-review-resolved' || Boolean(value.decision)),
  )
  .refine(
    (value) =>
      !value.status.startsWith('domain-') ||
      (value.status === 'domain-attached'
        ? value.customDomainAttached === true && Boolean(value.domain)
        : value.status === 'domain-pending-verification'
          ? value.customDomainAttached === false &&
            value.domain === null &&
            Boolean(value.hostname && value.dns)
          : value.status === 'domain-detached'
            ? value.customDomainAttached === false && value.domain === null
            : true),
  );
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

/** Normal session/MFA authority adapts the maintained Studio fulfillment owner. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireSessionWithMfa(request, {
    operation: 'studio-fulfillment',
    operations: ['studio-fulfillment'],
  });
  if (!gate.ok) {
    gate.response.headers.set('Cache-Control', 'private, no-store');
    return gate.response;
  }
  const recovery = rejectRecoverySession(gate.session);
  if (recovery) {
    recovery.headers.set('Cache-Control', 'private, no-store');
    return recovery;
  }
  if (gate.session.user.mustRotatePassword)
    return response({ error: 'Password rotation required' }, 403);
  const actor = await getSiteContentActor(getRestClient(), gate.session.user.id);
  if (!isPlatformSuperAdmin(actor))
    return response({ error: 'Verified platform operator required' }, 403);
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return response({ error: 'Invalid fulfillment request' }, 400);
  }
  const body = inputSchema.safeParse(input);
  if (!body.success) return response({ error: 'Invalid fulfillment request' }, 400);
  let config: ReturnType<typeof getStudioFulfillmentConfig>;
  try {
    config = getStudioFulfillmentConfig(process.env);
  } catch {
    return response({ error: 'Studio fulfillment is not configured' }, 503);
  }
  if (!config) return response({ error: 'Studio fulfillment is not configured' }, 503);
  let upstream: Response;
  try {
    upstream = await fetch(`${config.origin}/api/share`, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(FULFILLMENT_DEADLINE_MS),
      headers: {
        Authorization: `Bearer ${config.ownerSession}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body.data),
    });
  } catch {
    return response({ error: 'Studio fulfillment is unavailable' }, 502);
  }
  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return response({ error: 'Invalid Studio fulfillment response' }, 502);
  }
  if (!upstream.ok) {
    return response(
      { error: 'Studio could not complete this delivery', delivered: false },
      [400, 403, 404, 409, 503].includes(upstream.status) ? upstream.status : 502,
    );
  }
  const result = resultSchema.safeParse(data);
  if (!result.success) return response({ error: 'Invalid Studio fulfillment response' }, 502);
  if ((result.data.status === 'domain-pending-verification') !== (upstream.status === 202))
    return response({ error: 'Invalid Studio fulfillment response' }, 502);
  return response(result.data, upstream.status === 202 ? 202 : 200);
}
