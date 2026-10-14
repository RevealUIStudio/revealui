import { getRestClient } from '@revealui/db/client';
import { CrmError, createCrmService } from '@revealui/db/crm-service';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { requireSessionWithMfa } from '@/lib/auth/require-mfa';
import { CrmLocalModelUnavailable, generateCrmLocalDraft } from '@/lib/crm/local-draft';
import { rateLimit } from '@/lib/middleware/rate-limit';
import { rejectRecoverySession } from '@/lib/utils/recovery-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) {
  const gate = await requireSessionWithMfa(request, { operation: 'CRM' });
  if (!gate.ok) return gate.response;
  const recovery = rejectRecoverySession(gate.session);
  if (recovery) return recovery;
  if (gate.session.user.mustRotatePassword)
    return NextResponse.json({ error: 'Password rotation required' }, { status: 403 });
  const accountId = request.headers.get('X-Account-ID');
  if (!accountId || accountId.length > 128)
    return NextResponse.json({ error: 'Account context required' }, { status: 400 });
  // Proxy enforces signed CSRF tokens. Require same-origin browser mutations as a second boundary.
  if (request.method !== 'GET' && request.headers.get('origin') !== request.nextUrl.origin)
    return NextResponse.json({ error: 'Same-origin mutation required' }, { status: 403 });
  const { path } = await context.params;
  const [resource, id, action] = path;
  const service = createCrmService(getRestClient(), { userId: gate.session.user.id, accountId });
  try {
    let result: unknown;
    if (request.method === 'GET' && path.length === 1) {
      result =
        resource === 'dashboard'
          ? await service.dashboard()
          : await service.list(resource ?? '', Object.fromEntries(request.nextUrl.searchParams));
    } else {
      if (Number(request.headers.get('content-length') ?? 0) > 1048576)
        return NextResponse.json({ error: 'Request too large' }, { status: 413 });
      const bodyText = await request.text();
      if (bodyText.length > 1048576)
        return NextResponse.json({ error: 'Request too large' }, { status: 413 });
      const input: unknown = JSON.parse(bodyText);
      if (
        request.method === 'POST' &&
        resource === 'drafts' &&
        id === 'generate' &&
        path.length === 2
      ) {
        const limited = await rateLimit(
          { maxRequests: 5, windowMs: 60000 },
          { failClosed: true },
        )(request);
        if (limited) return limited;
        const selection = z
          .strictObject({
            contactId: z.string().min(1).max(128),
            campaignId: z.string().min(1).max(128).optional(),
          })
          .parse(input);
        const context = await service.draftingContext(selection.contactId);
        const draft = await generateCrmLocalDraft(context);
        const evidence = [context.sourceUrl, context.organization?.sourceUrl].filter(
          (v): v is string => Boolean(v),
        );
        result = await service.createDraft(
          {
            ...selection,
            subject: draft.subject,
            body: draft.body,
            evidence,
          },
          draft.model,
        );
      } else if (request.method === 'POST' && path.length === 1) {
        switch (resource) {
          case 'organizations':
            result = await service.createOrganization(input);
            break;
          case 'contacts':
            result = await service.createContact(input);
            break;
          case 'opportunities':
            result = await service.createOpportunity(input);
            break;
          case 'activities':
            result = await service.createActivity(input);
            break;
          case 'tasks':
            result = await service.createTask(input);
            break;
          case 'campaigns':
            result = await service.createCampaign(input);
            break;
          case 'drafts':
            result = await service.createDraft(input);
            break;
          case 'suppression':
            result = await service.suppress(input);
            break;
          case 'enrollments':
            result = await service.enroll(input);
            break;
          case 'bookings':
            result = await service.linkBooking(input);
            break;
          default:
            return NextResponse.json({ error: 'Route unavailable' }, { status: 404 });
        }
      } else if (
        request.method === 'POST' &&
        resource === 'imports' &&
        id === 'contacts' &&
        path.length === 3
      ) {
        if (action === 'preview') result = await service.previewContactImport(input);
        else if (action === 'commit') result = await service.commitContactImport(input);
        else return NextResponse.json({ error: 'Route unavailable' }, { status: 404 });
      } else if (request.method === 'POST' && resource === 'imports' && path.length === 2) {
        if (id === 'preview') result = await service.previewImport(input);
        else if (id === 'commit') result = await service.commitImport(input);
        else return NextResponse.json({ error: 'Route unavailable' }, { status: 404 });
      } else if (
        request.method === 'POST' &&
        resource === 'drafts' &&
        action === 'approve' &&
        id &&
        path.length === 3
      ) {
        result = await service.approveDraft(id, input);
      } else if (
        request.method === 'DELETE' &&
        id &&
        path.length === 2 &&
        ['organizations', 'contacts'].includes(resource ?? '')
      ) {
        result =
          resource === 'organizations'
            ? await service.archiveOrganization(id, input)
            : await service.archiveContact(id, input);
      } else if (request.method === 'PATCH' && id && path.length === 2) {
        switch (resource) {
          case 'organizations':
            result = await service.editOrganization(id, input);
            break;
          case 'contacts':
            result = await service.editContact(id, input);
            break;
          case 'opportunities':
            result = await service.editOpportunity(id, input);
            break;
          case 'tasks':
            result = await service.updateTask(id, input);
            break;
          case 'campaigns':
            result = await service.updateCampaign(id, input);
            break;
          case 'drafts':
            result = await service.editDraft(id, input);
            break;
          default:
            return NextResponse.json({ error: 'Route unavailable' }, { status: 404 });
        }
      } else if (
        request.method === 'POST' &&
        resource === 'bookings' &&
        action === 'reconcile' &&
        id &&
        path.length === 3
      ) {
        result = await service.reconcileBooking(id);
      } else if (
        request.method === 'POST' &&
        resource === 'opportunities' &&
        action === 'stage' &&
        id &&
        path.length === 3
      ) {
        result = await service.transition(id, input);
      } else if (
        request.method === 'POST' &&
        resource === 'opportunities' &&
        action === 'revenue' &&
        id &&
        path.length === 3
      ) {
        result = await service.recordRevenue(id, input);
      } else return NextResponse.json({ error: 'Route unavailable' }, { status: 404 });
    }
    return NextResponse.json(
      { data: result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof CrmLocalModelUnavailable)
      return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json({ error: 'Invalid CRM input' }, { status: 400 });
    if (error instanceof CrmError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    const cause =
      error instanceof Error &&
      error.cause &&
      typeof error.cause === 'object' &&
      'code' in error.cause
        ? error.cause.code
        : code;
    if (['23503', '23505', '23514'].includes(String(cause)))
      return NextResponse.json({ error: 'CRM reference or record conflict' }, { status: 409 });
    logger.error('CRM operation failed', { resource, method: request.method });
    return NextResponse.json({ error: 'CRM temporarily unavailable' }, { status: 503 });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;

export const DELETE = handle;
