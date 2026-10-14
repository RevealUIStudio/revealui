import { z } from 'zod';
import { CRM_STAGES } from './crm-policy.js';

const id = z.string().trim().min(1).max(128);
const text = z.string().trim().min(1).max(1000);
const url = z
  .url()
  .max(2048)
  .refine((v) => ['http:', 'https:'].includes(new URL(v).protocol));
const date = z.coerce.date();
export const crmOrganizationInput = z.strictObject({
  name: text,
  website: url.optional(),
  industry: text.optional(),
  location: text.optional(),
  sourceUrl: url,
  sourceVerifiedAt: date.optional(),
});
export const crmContactInput = z.strictObject({
  organizationId: id.optional(),
  name: text.optional(),
  role: text.optional(),
  businessEmail: z.email().max(254).optional(),
  contactSourceUrl: url,
  consent: z.enum(['unknown', 'permitted', 'withdrawn']).default('unknown'),
  doNotContact: z.boolean().default(false),
});
export const crmOpportunityInput = z.strictObject({
  organizationId: id,
  title: text,
  offer: z.enum(['consultation', 'pilot', 'launch']),
  valueCents: z.number().int().min(0).max(2147483647).optional(),
  ownerId: id.optional(),
  nextActionAt: date.optional(),
});
export const crmTaskInput = z.strictObject({
  opportunityId: id.optional(),
  title: text,
  dueAt: date.optional(),
  assigneeId: id.optional(),
});
export const crmCampaignInput = z.strictObject({
  name: text,
  template: z.string().max(20000).optional(),
  audience: z.record(z.string().max(80), z.string().max(500)).optional(),
});
export const crmDraftInput = z.strictObject({
  contactId: id,
  campaignId: id.optional(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(20000),
  evidence: z.array(url).min(1).max(20),
});
export const crmActivityInput = z.strictObject({
  opportunityId: id,
  kind: z.enum(['note', 'call', 'meeting', 'reply', 'proposal', 'outcome']),
  summary: z.string().trim().min(1).max(10000),
  occurredAt: date.optional(),
});
export const crmStageInput = z.strictObject({
  stage: z.enum(CRM_STAGES),
  version: z.number().int().positive(),
});
export const crmTaskUpdate = z.strictObject({
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
  version: z.number().int().positive(),
});
export const crmCampaignUpdate = z.strictObject({
  status: z.enum(['draft', 'review', 'approved', 'paused', 'archived']),
  version: z.number().int().positive(),
});
export const crmDraftUpdate = crmDraftInput
  .omit({ contactId: true, campaignId: true })
  .extend({ version: z.number().int().positive() });
export const crmApprovalInput = z.strictObject({ version: z.number().int().positive() });
export const crmSuppressionInput = z.strictObject({ email: z.email().max(254), reason: text });
export const crmEnrollmentInput = z.strictObject({ campaignId: id, contactId: id });
export const crmBookingInput = z.strictObject({ opportunityId: id, siteId: id, bookingId: id });
export const crmImportInput = z.strictObject({
  rows: z.array(crmOrganizationInput).min(1).max(500),
  idempotencyKey: id.optional(),
});
export const crmRevenueInput = z.strictObject({
  version: z.number().int().positive(),
  realizedRevenueCents: z.number().int().min(0).max(2147483647),
  revenueEvidence: url,
});
export const crmPagination = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export function normalizeCrmEmail(email: string) {
  return email.trim().toLowerCase();
}
export function organizationDedupeKey(
  input: Pick<z.infer<typeof crmOrganizationInput>, 'name' | 'website' | 'location'>,
) {
  return input.website
    ? `host:${new URL(input.website).hostname.toLowerCase()}`
    : `name:${input.name.trim().toLowerCase()}:${input.location?.trim().toLowerCase() ?? ''}`;
}

export const crmOrganizationUpdate = crmOrganizationInput
  .partial()
  .extend({ version: z.number().int().positive() });
export const crmContactUpdate = crmContactInput
  .partial()
  .extend({ version: z.number().int().positive() });
export const crmOpportunityUpdate = crmOpportunityInput
  .omit({ organizationId: true })
  .partial()
  .extend({ version: z.number().int().positive() });

export const crmContactImportInput = z.strictObject({
  rows: z
    .array(crmContactInput.extend({ businessEmail: z.email().max(254) }))
    .min(1)
    .max(500),
  idempotencyKey: id.optional(),
});
