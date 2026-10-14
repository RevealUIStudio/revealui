import { createHash, randomUUID } from 'node:crypto';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { type Database, withTransaction } from './client/index.js';
import * as contracts from './crm-contracts.js';
import { canTransitionCrmStage, isCrmStage } from './crm-policy.js';
import { accountMemberships, accounts } from './schema/accounts.js';
import {
  crmActivities,
  crmCampaigns,
  crmContacts,
  crmOpportunities,
  crmOrganizations,
} from './schema/crm.js';
import {
  crmAuditEvents,
  crmBookingLinks,
  crmEnrollments,
  crmImports,
  crmOutreachDrafts,
  crmStageHistory,
  crmSuppression,
  crmTasks,
} from './schema/crm-workflows.js';
import { sites } from './schema/sites.js';
import { users } from './schema/users.js';

export class CrmError extends Error {
  constructor(
    public readonly status: 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
/** Identity comes only from an authenticated server session. Account claims are reauthorized. */
export interface CrmActor {
  userId: string;
  accountId: string;
}
const offers = { consultation: 30000, pilot: 399700, launch: 1450000 } as const;

async function authorize(db: Database, actor: CrmActor, privileged = false) {
  const [member] = await db
    .select({ role: accountMemberships.role })
    .from(accountMemberships)
    .innerJoin(accounts, eq(accounts.id, accountMemberships.accountId))
    .innerJoin(users, eq(users.id, accountMemberships.userId))
    .where(
      and(
        eq(accountMemberships.accountId, actor.accountId),
        eq(accountMemberships.userId, actor.userId),
        eq(accountMemberships.status, 'active'),
        eq(accounts.status, 'active'),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)
    .for('share');
  if (!member || (privileged && !['owner', 'admin'].includes(member.role)))
    throw new CrmError(403, 'CRM account access denied');
}
async function activeAssignee(db: Database, actor: CrmActor, userId?: string) {
  if (userId) await authorize(db, { ...actor, userId });
}
async function receipt(
  db: Database,
  actor: CrmActor,
  resource: string,
  recordId: string,
  action: string,
) {
  await db.insert(crmAuditEvents).values({
    id: randomUUID(),
    accountId: actor.accountId,
    actorId: actor.userId,
    resource,
    recordId,
    action,
  });
}
/** Every operation authorizes within the transaction, including reads and exports. */
function scoped<T>(
  db: Database,
  actor: CrmActor,
  fn: (tx: Database) => Promise<T>,
  privileged = false,
) {
  return withTransaction(db, async (tx) => {
    await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, actor.accountId))
      .for('update');
    await authorize(tx, actor, privileged);
    return fn(tx);
  });
}
async function contactAllowed(db: Database, actor: CrmActor, id: string) {
  const [contact] = await db
    .select()
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.accountId, actor.accountId),
        eq(crmContacts.id, id),
        isNull(crmContacts.deletedAt),
      ),
    )
    .limit(1)
    .for('update');
  if (!contact) throw new CrmError(404, 'Contact unavailable');
  if (contact.doNotContact || contact.consent === 'withdrawn')
    throw new CrmError(409, 'Contact suppressed');
  if (contact.normalizedEmail) {
    const [suppression] = await db
      .select()
      .from(crmSuppression)
      .where(
        and(
          eq(crmSuppression.accountId, actor.accountId),
          eq(crmSuppression.normalizedEmail, contact.normalizedEmail),
        ),
      )
      .limit(1);
    if (suppression) throw new CrmError(409, 'Contact suppressed');
  }
  return contact;
}
export function createCrmService(db: Database, actor: CrmActor) {
  return {
    list: (resource: string, pagination: unknown) =>
      scoped(db, actor, async (tx) => {
        const { limit, offset } = contracts.crmPagination.parse(pagination);
        switch (resource) {
          case 'organizations':
            return tx
              .select()
              .from(crmOrganizations)
              .where(
                and(
                  eq(crmOrganizations.accountId, actor.accountId),
                  isNull(crmOrganizations.deletedAt),
                ),
              )
              .orderBy(asc(crmOrganizations.id))
              .limit(limit)
              .offset(offset);
          case 'contacts':
            return tx
              .select()
              .from(crmContacts)
              .where(and(eq(crmContacts.accountId, actor.accountId), isNull(crmContacts.deletedAt)))
              .orderBy(asc(crmContacts.id))
              .limit(limit)
              .offset(offset);
          case 'opportunities':
            return tx
              .select()
              .from(crmOpportunities)
              .where(and(eq(crmOpportunities.accountId, actor.accountId)))
              .orderBy(asc(crmOpportunities.id))
              .limit(limit)
              .offset(offset);
          case 'activities':
            return tx
              .select()
              .from(crmActivities)
              .where(and(eq(crmActivities.accountId, actor.accountId)))
              .orderBy(asc(crmActivities.id))
              .limit(limit)
              .offset(offset);
          case 'tasks':
            return tx
              .select()
              .from(crmTasks)
              .where(and(eq(crmTasks.accountId, actor.accountId)))
              .orderBy(asc(crmTasks.id))
              .limit(limit)
              .offset(offset);
          case 'campaigns':
            return tx
              .select()
              .from(crmCampaigns)
              .where(and(eq(crmCampaigns.accountId, actor.accountId)))
              .orderBy(asc(crmCampaigns.id))
              .limit(limit)
              .offset(offset);
          case 'drafts':
            return tx
              .select()
              .from(crmOutreachDrafts)
              .where(and(eq(crmOutreachDrafts.accountId, actor.accountId)))
              .orderBy(asc(crmOutreachDrafts.id))
              .limit(limit)
              .offset(offset);
          case 'suppression':
            return tx
              .select()
              .from(crmSuppression)
              .where(and(eq(crmSuppression.accountId, actor.accountId)))
              .orderBy(asc(crmSuppression.id))
              .limit(limit)
              .offset(offset);
          case 'enrollments':
            return tx
              .select()
              .from(crmEnrollments)
              .where(and(eq(crmEnrollments.accountId, actor.accountId)))
              .orderBy(asc(crmEnrollments.id))
              .limit(limit)
              .offset(offset);
          case 'bookings':
            return tx
              .select()
              .from(crmBookingLinks)
              .where(and(eq(crmBookingLinks.accountId, actor.accountId)))
              .orderBy(asc(crmBookingLinks.id))
              .limit(limit)
              .offset(offset);
          case 'imports':
            return tx
              .select()
              .from(crmImports)
              .where(and(eq(crmImports.accountId, actor.accountId)))
              .orderBy(asc(crmImports.id))
              .limit(limit)
              .offset(offset);
          case 'audit':
            return tx
              .select()
              .from(crmAuditEvents)
              .where(and(eq(crmAuditEvents.accountId, actor.accountId)))
              .orderBy(asc(crmAuditEvents.id))
              .limit(limit)
              .offset(offset);
          default:
            throw new CrmError(404, 'CRM resource unavailable');
        }
      }),
    createOrganization: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmOrganizationInput.parse(raw);
        const [record] = await tx
          .insert(crmOrganizations)
          .values({
            ...input,
            id: randomUUID(),
            accountId: actor.accountId,
            dedupeKey: contracts.organizationDedupeKey(input),
          })
          .returning();
        if (!record) throw new CrmError(409, 'CRM create failed');
        await receipt(tx, actor, 'organization', record.id, 'created');
        return record;
      }),
    createContact: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmContactInput.parse(raw);
        const [record] = await tx
          .insert(crmContacts)
          .values({
            ...input,
            id: randomUUID(),
            accountId: actor.accountId,
            normalizedEmail: input.businessEmail
              ? contracts.normalizeCrmEmail(input.businessEmail)
              : null,
          })
          .returning();
        if (!record) throw new CrmError(409, 'CRM create failed');
        await receipt(tx, actor, 'contact', record.id, 'created');
        return record;
      }),
    createOpportunity: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmOpportunityInput.parse(raw);
        await activeAssignee(tx, actor, input.ownerId);
        const [record] = await tx
          .insert(crmOpportunities)
          .values({
            ...input,
            id: randomUUID(),
            accountId: actor.accountId,
            valueCents: input.valueCents ?? offers[input.offer],
          })
          .returning();
        if (!record) throw new CrmError(409, 'CRM create failed');
        await receipt(tx, actor, 'opportunity', record.id, 'created');
        return record;
      }),
    createTask: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmTaskInput.parse(raw);
        await activeAssignee(tx, actor, input.assigneeId);
        const [record] = await tx
          .insert(crmTasks)
          .values({ ...input, id: randomUUID(), accountId: actor.accountId })
          .returning();
        if (!record) throw new CrmError(409, 'CRM create failed');
        await receipt(tx, actor, 'task', record.id, 'created');
        return record;
      }),
    createCampaign: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmCampaignInput.parse(raw);
        const [record] = await tx
          .insert(crmCampaigns)
          .values({ ...input, id: randomUUID(), accountId: actor.accountId })
          .returning();
        if (!record) throw new CrmError(409, 'CRM create failed');
        await receipt(tx, actor, 'campaign', record.id, 'created');
        return record;
      }),
    createDraft: (raw: unknown, model?: string) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmDraftInput.parse(raw);
        await contactAllowed(tx, actor, input.contactId);
        const [record] = await tx
          .insert(crmOutreachDrafts)
          .values({ ...input, model: model ?? null, id: randomUUID(), accountId: actor.accountId })
          .returning();
        if (!record) throw new CrmError(409, 'CRM create failed');
        await receipt(tx, actor, 'draft', record.id, 'created');
        return record;
      }),
    createActivity: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmActivityInput.parse(raw);
        const [record] = await tx
          .insert(crmActivities)
          .values({ ...input, id: randomUUID(), accountId: actor.accountId, actorId: actor.userId })
          .returning();
        if (!record) throw new CrmError(409, 'CRM create failed');
        await receipt(tx, actor, 'activity', record.id, 'created');
        return record;
      }),
    editOrganization: (id: string, raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmOrganizationUpdate.parse(raw);
        const [prior] = await tx
          .select()
          .from(crmOrganizations)
          .where(and(eq(crmOrganizations.accountId, actor.accountId), eq(crmOrganizations.id, id)))
          .limit(1)
          .for('update');
        if (!prior) throw new CrmError(404, 'Record unavailable');
        if (prior.version !== input.version) throw new CrmError(409, 'Stale edit');
        const dedupeKey = contracts.organizationDedupeKey({
          name: input.name ?? prior.name,
          website: input.website ?? prior.website ?? undefined,
          location: input.location ?? prior.location ?? undefined,
        });
        const [record] = await tx
          .update(crmOrganizations)
          .set({ ...input, version: input.version + 1, updatedAt: new Date(), dedupeKey })
          .where(and(eq(crmOrganizations.accountId, actor.accountId), eq(crmOrganizations.id, id)))
          .returning();
        await receipt(tx, actor, 'organization', id, 'edited');
        return record;
      }),
    editContact: (id: string, raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmContactUpdate.parse(raw);
        const [prior] = await tx
          .select()
          .from(crmContacts)
          .where(and(eq(crmContacts.accountId, actor.accountId), eq(crmContacts.id, id)))
          .limit(1)
          .for('update');
        if (!prior) throw new CrmError(404, 'Record unavailable');
        if (prior.version !== input.version) throw new CrmError(409, 'Stale edit');
        if (prior.doNotContact && (input.doNotContact === false || input.consent === 'permitted'))
          throw new CrmError(409, 'Suppression cannot be cleared by contact edits');
        if (input.doNotContact === true || input.consent === 'withdrawn')
          throw new CrmError(409, 'Use the suppression action to record opt-outs');
        const [record] = await tx
          .update(crmContacts)
          .set({
            ...input,
            version: input.version + 1,
            updatedAt: new Date(),
            ...(input.businessEmail
              ? { normalizedEmail: contracts.normalizeCrmEmail(input.businessEmail) }
              : {}),
          })
          .where(and(eq(crmContacts.accountId, actor.accountId), eq(crmContacts.id, id)))
          .returning();
        await tx
          .update(crmOutreachDrafts)
          .set({
            status: 'draft',
            approvedBy: null,
            approvedAt: null,
            version: sql`${crmOutreachDrafts.version}+1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(crmOutreachDrafts.accountId, actor.accountId),
              eq(crmOutreachDrafts.contactId, id),
              sql`${crmOutreachDrafts.status} <> 'cancelled'`,
            ),
          );
        await receipt(tx, actor, 'contact', id, 'edited');
        return record;
      }),
    editOpportunity: (id: string, raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmOpportunityUpdate.parse(raw);
        const [prior] = await tx
          .select()
          .from(crmOpportunities)
          .where(and(eq(crmOpportunities.accountId, actor.accountId), eq(crmOpportunities.id, id)))
          .limit(1)
          .for('update');
        if (!prior) throw new CrmError(404, 'Record unavailable');
        if (prior.version !== input.version) throw new CrmError(409, 'Stale edit');
        await activeAssignee(tx, actor, input.ownerId);
        const [record] = await tx
          .update(crmOpportunities)
          .set({ ...input, version: input.version + 1, updatedAt: new Date() })
          .where(and(eq(crmOpportunities.accountId, actor.accountId), eq(crmOpportunities.id, id)))
          .returning();
        await receipt(tx, actor, 'opportunity', id, 'edited');
        return record;
      }),
    archiveOrganization: (id: string, raw: unknown) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const { version } = contracts.crmApprovalInput.parse(raw);
          const [record] = await tx
            .update(crmOrganizations)
            .set({ deletedAt: new Date(), version: version + 1, updatedAt: new Date() })
            .where(
              and(
                eq(crmOrganizations.accountId, actor.accountId),
                eq(crmOrganizations.id, id),
                eq(crmOrganizations.version, version),
                isNull(crmOrganizations.deletedAt),
              ),
            )
            .returning();
          if (!record) throw new CrmError(409, 'Organization unavailable or stale edit');
          await receipt(tx, actor, 'organization', id, 'archived');
          return { id };
        },
        true,
      ),
    archiveContact: (id: string, raw: unknown) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const { version } = contracts.crmApprovalInput.parse(raw);
          const [record] = await tx
            .update(crmContacts)
            .set({
              deletedAt: new Date(),
              doNotContact: true,
              consent: 'withdrawn',
              version: version + 1,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(crmContacts.accountId, actor.accountId),
                eq(crmContacts.id, id),
                eq(crmContacts.version, version),
                isNull(crmContacts.deletedAt),
              ),
            )
            .returning();
          if (!record) throw new CrmError(409, 'Contact unavailable or stale edit');
          if (record.normalizedEmail)
            await tx
              .insert(crmSuppression)
              .values({
                id: randomUUID(),
                accountId: actor.accountId,
                normalizedEmail: record.normalizedEmail,
                reason: 'Contact archived',
              })
              .onConflictDoNothing();
          await tx
            .update(crmOutreachDrafts)
            .set({
              status: 'cancelled',
              approvedBy: null,
              approvedAt: null,
              version: sql`${crmOutreachDrafts.version}+1`,
            })
            .where(
              and(
                eq(crmOutreachDrafts.accountId, actor.accountId),
                eq(crmOutreachDrafts.contactId, id),
              ),
            );
          await receipt(tx, actor, 'contact', id, 'archived');
          return { id };
        },
        true,
      ),
    transition: (id: string, raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmStageInput.parse(raw);
        const [prior] = await tx
          .select()
          .from(crmOpportunities)
          .where(and(eq(crmOpportunities.accountId, actor.accountId), eq(crmOpportunities.id, id)))
          .limit(1)
          .for('update');
        if (!prior) throw new CrmError(404, 'Opportunity unavailable');
        if (
          prior.version !== input.version ||
          !isCrmStage(prior.stage) ||
          !canTransitionCrmStage(prior.stage, input.stage)
        )
          throw new CrmError(409, 'Stale edit or invalid stage transition');
        const [record] = await tx
          .update(crmOpportunities)
          .set({ stage: input.stage, version: prior.version + 1, updatedAt: new Date() })
          .where(
            and(
              eq(crmOpportunities.accountId, actor.accountId),
              eq(crmOpportunities.id, id),
              eq(crmOpportunities.version, input.version),
            ),
          )
          .returning();
        await tx.insert(crmStageHistory).values({
          id: randomUUID(),
          accountId: actor.accountId,
          opportunityId: id,
          fromStage: prior.stage,
          toStage: input.stage,
          changedBy: actor.userId,
        });
        if (input.stage === 'do_not_contact') {
          const contacts = await tx
            .update(crmContacts)
            .set({
              doNotContact: true,
              consent: 'withdrawn',
              version: sql`${crmContacts.version}+1`,
            })
            .where(
              and(
                eq(crmContacts.accountId, actor.accountId),
                eq(crmContacts.organizationId, prior.organizationId),
              ),
            )
            .returning();
          for (const contact of contacts) {
            if (contact.normalizedEmail)
              await tx
                .insert(crmSuppression)
                .values({
                  id: randomUUID(),
                  accountId: actor.accountId,
                  normalizedEmail: contact.normalizedEmail,
                  reason: 'Opportunity marked do not contact',
                })
                .onConflictDoNothing();
            await tx
              .update(crmOutreachDrafts)
              .set({
                status: 'cancelled',
                approvedBy: null,
                approvedAt: null,
                version: sql`${crmOutreachDrafts.version}+1`,
              })
              .where(
                and(
                  eq(crmOutreachDrafts.accountId, actor.accountId),
                  eq(crmOutreachDrafts.contactId, contact.id),
                ),
              );
          }
        }
        await receipt(tx, actor, 'opportunity', id, 'stage-changed');
        return record;
      }),
    updateTask: (id: string, raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmTaskUpdate.parse(raw);
        const [record] = await tx
          .update(crmTasks)
          .set({
            status: input.status,
            version: input.version + 1,
            completedAt: input.status === 'done' ? new Date() : null,
          })
          .where(
            and(
              eq(crmTasks.accountId, actor.accountId),
              eq(crmTasks.id, id),
              eq(crmTasks.version, input.version),
            ),
          )
          .returning();
        if (!record) throw new CrmError(409, 'Task unavailable or stale edit');
        await receipt(tx, actor, 'task', id, 'updated');
        return record;
      }),
    updateCampaign: (id: string, raw: unknown) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const input = contracts.crmCampaignUpdate.parse(raw);
          const [prior] = await tx
            .select()
            .from(crmCampaigns)
            .where(and(eq(crmCampaigns.accountId, actor.accountId), eq(crmCampaigns.id, id)))
            .limit(1)
            .for('update');
          if (!prior) throw new CrmError(404, 'Campaign unavailable');
          const transitions: Record<string, string[]> = {
            draft: ['review', 'archived'],
            review: ['draft', 'approved', 'archived'],
            approved: ['paused', 'archived'],
            paused: ['review', 'archived'],
            archived: [],
          };
          if (prior.version !== input.version || !transitions[prior.status]?.includes(input.status))
            throw new CrmError(409, 'Stale edit or invalid campaign transition');
          const [record] = await tx
            .update(crmCampaigns)
            .set({ status: input.status, version: input.version + 1, updatedAt: new Date() })
            .where(and(eq(crmCampaigns.accountId, actor.accountId), eq(crmCampaigns.id, id)))
            .returning();
          await receipt(tx, actor, 'campaign', id, `status:${input.status}`);
          return record;
        },
        true,
      ),
    editDraft: (id: string, raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmDraftUpdate.parse(raw);
        const [record] = await tx
          .update(crmOutreachDrafts)
          .set({
            ...input,
            version: input.version + 1,
            status: 'draft',
            approvedBy: null,
            approvedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(crmOutreachDrafts.accountId, actor.accountId),
              eq(crmOutreachDrafts.id, id),
              eq(crmOutreachDrafts.version, input.version),
            ),
          )
          .returning();
        if (!record) throw new CrmError(409, 'Draft unavailable or stale edit');
        await receipt(tx, actor, 'draft', id, 'edited-approval-cleared');
        return record;
      }),
    approveDraft: (id: string, raw: unknown) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const input = contracts.crmApprovalInput.parse(raw);
          const [draft] = await tx
            .select()
            .from(crmOutreachDrafts)
            .where(
              and(eq(crmOutreachDrafts.accountId, actor.accountId), eq(crmOutreachDrafts.id, id)),
            )
            .limit(1)
            .for('update');
          if (!draft) throw new CrmError(404, 'Draft unavailable');
          if (draft.version !== input.version || draft.status !== 'draft')
            throw new CrmError(409, 'Draft unavailable or stale edit');
          const contact = await contactAllowed(tx, actor, draft.contactId);
          if (contact.consent !== 'permitted' || !contact.normalizedEmail)
            throw new CrmError(409, 'Verified permitted contact channel required');
          if (draft.campaignId) {
            const [campaign] = await tx
              .select()
              .from(crmCampaigns)
              .where(
                and(
                  eq(crmCampaigns.accountId, actor.accountId),
                  eq(crmCampaigns.id, draft.campaignId),
                ),
              )
              .limit(1)
              .for('share');
            if (campaign?.status !== 'approved')
              throw new CrmError(409, 'Campaign is not approved');
          }
          const [record] = await tx
            .update(crmOutreachDrafts)
            .set({
              status: 'approved',
              approvedBy: actor.userId,
              approvedAt: new Date(),
              version: input.version + 1,
              updatedAt: new Date(),
            })
            .where(
              and(eq(crmOutreachDrafts.accountId, actor.accountId), eq(crmOutreachDrafts.id, id)),
            )
            .returning();
          await receipt(tx, actor, 'draft', id, 'approved');
          return record;
        },
        true,
      ),
    suppress: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmSuppressionInput.parse(raw),
          email = contracts.normalizeCrmEmail(input.email);
        await tx
          .update(crmContacts)
          .set({ doNotContact: true, consent: 'withdrawn', version: sql`${crmContacts.version}+1` })
          .where(
            and(eq(crmContacts.accountId, actor.accountId), eq(crmContacts.normalizedEmail, email)),
          );
        const [record] = await tx
          .insert(crmSuppression)
          .values({
            id: randomUUID(),
            accountId: actor.accountId,
            normalizedEmail: email,
            reason: input.reason,
          })
          .onConflictDoUpdate({
            target: [crmSuppression.accountId, crmSuppression.normalizedEmail],
            set: { reason: input.reason },
          })
          .returning();
        if (!record) throw new CrmError(409, 'Suppression failed');
        const contacts = await tx
          .select({ id: crmContacts.id })
          .from(crmContacts)
          .where(
            and(eq(crmContacts.accountId, actor.accountId), eq(crmContacts.normalizedEmail, email)),
          );
        for (const contact of contacts)
          await tx
            .update(crmOutreachDrafts)
            .set({
              status: 'cancelled',
              approvedBy: null,
              approvedAt: null,
              version: sql`${crmOutreachDrafts.version}+1`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(crmOutreachDrafts.accountId, actor.accountId),
                eq(crmOutreachDrafts.contactId, contact.id),
              ),
            );
        await receipt(tx, actor, 'suppression', record.id, 'suppressed');
        return record;
      }),
    enroll: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmEnrollmentInput.parse(raw);
        await contactAllowed(tx, actor, input.contactId);
        const [record] = await tx
          .insert(crmEnrollments)
          .values({ ...input, id: randomUUID(), accountId: actor.accountId })
          .onConflictDoNothing()
          .returning();
        if (record) await receipt(tx, actor, 'enrollment', record.id, 'created');
        return record ?? null;
      }),
    verifyBookingSyncTarget: (opportunityId: string) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const [opportunity] = await tx
            .select({ id: crmOpportunities.id })
            .from(crmOpportunities)
            .where(
              and(
                eq(crmOpportunities.accountId, actor.accountId),
                eq(crmOpportunities.id, opportunityId),
              ),
            )
            .limit(1);
          if (!opportunity) throw new CrmError(404, 'Opportunity unavailable');
          return opportunity;
        },
        true,
      ),
    syncSourceBooking: (raw: unknown, evidence: unknown, sourceUrl: string) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const input = contracts.crmBookingSyncInput.parse(raw),
            snapshot = contracts.crmSourceBooking.parse(evidence);
          if (snapshot.bookingId !== input.bookingId)
            throw new CrmError(409, 'Booking identity mismatch');
          const [opportunity] = await tx
            .select()
            .from(crmOpportunities)
            .where(
              and(
                eq(crmOpportunities.accountId, actor.accountId),
                eq(crmOpportunities.id, input.opportunityId),
              ),
            )
            .limit(1)
            .for('update');
          if (!opportunity) throw new CrmError(404, 'Opportunity unavailable');
          const [prior] = await tx
            .select()
            .from(crmBookingLinks)
            .where(
              and(
                eq(crmBookingLinks.accountId, actor.accountId),
                eq(crmBookingLinks.bookingId, input.bookingId),
              ),
            )
            .limit(1)
            .for('update');
          if (prior && prior.opportunityId !== input.opportunityId)
            throw new CrmError(409, 'Booking already linked to another opportunity');
          if (snapshot.status === 'missing' && !prior)
            throw new CrmError(404, 'Booking unavailable');
          const previous = prior?.sourceSnapshot as
            | {
                status?: string;
                stripeSessionId?: string | null;
                refund?: { amountRefunded: number; full: boolean } | null;
              }
            | undefined;
          if (snapshot.status !== 'missing' && previous) {
            if (
              previous.status === 'missing' ||
              (previous.status === 'paid_scheduled' && snapshot.status !== 'paid_scheduled') ||
              (previous.stripeSessionId && previous.stripeSessionId !== snapshot.stripeSessionId) ||
              (previous.refund &&
                (!snapshot.refund ||
                  snapshot.refund.amountRefunded < previous.refund.amountRefunded ||
                  (previous.refund.full && !snapshot.refund.full)))
            )
              throw new CrmError(409, 'Stale or conflicting booking evidence');
          }
          const summary =
            snapshot.status === 'missing'
              ? { ...snapshot }
              : {
                  contract: snapshot.contract,
                  bookingId: snapshot.bookingId,
                  status: snapshot.status,
                  start: snapshot.start,
                  end: snapshot.end,
                  hours: snapshot.hours,
                  stageB: snapshot.stageB,
                  stageBFee: snapshot.stageBFee,
                  stripeSessionId: snapshot.stripeSessionId,
                  eventId: snapshot.eventId,
                  refund: snapshot.refund,
                };
          const digest = createHash('sha256').update(JSON.stringify(summary)).digest('hex');
          if (
            prior?.sourceSnapshot &&
            createHash('sha256').update(JSON.stringify(prior.sourceSnapshot)).digest('hex') ===
              digest
          )
            return prior;
          let link = prior;
          if (prior) {
            [link] = await tx
              .update(crmBookingLinks)
              .set({ sourceSnapshot: summary })
              .where(
                and(
                  eq(crmBookingLinks.accountId, actor.accountId),
                  eq(crmBookingLinks.id, prior.id),
                ),
              )
              .returning();
          } else {
            [link] = await tx
              .insert(crmBookingLinks)
              .values({
                id: randomUUID(),
                accountId: actor.accountId,
                bookingId: input.bookingId,
                opportunityId: input.opportunityId,
                sourceSnapshot: summary,
              })
              .returning();
          }
          if (!link) throw new CrmError(409, 'Booking synchronization failed');
          if (snapshot.status !== 'missing') {
            const normalizedEmail = contracts.normalizeCrmEmail(snapshot.email);
            const [blocked] = await tx
              .select({ id: crmSuppression.id })
              .from(crmSuppression)
              .where(
                and(
                  eq(crmSuppression.accountId, actor.accountId),
                  eq(crmSuppression.normalizedEmail, normalizedEmail),
                ),
              )
              .limit(1);
            await tx
              .insert(crmContacts)
              .values({
                id: randomUUID(),
                accountId: actor.accountId,
                organizationId: opportunity.organizationId,
                name: snapshot.name,
                businessEmail: snapshot.email,
                normalizedEmail,
                contactSourceUrl: sourceUrl,
                consent: blocked ? 'withdrawn' : 'unknown',
                doNotContact: Boolean(blocked),
              })
              .onConflictDoNothing({
                target: [crmContacts.accountId, crmContacts.normalizedEmail],
              });
          }
          await tx.insert(crmActivities).values({
            id: randomUUID(),
            accountId: actor.accountId,
            opportunityId: input.opportunityId,
            kind: 'booking-source-observed',
            actorId: actor.userId,
            summary: JSON.stringify(summary),
          });
          await receipt(tx, actor, 'booking', link.id, `source:${digest}`);
          return link;
        },
        true,
      ),
    linkBooking: (raw: unknown) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const input = contracts.crmBookingInput.parse(raw);
          // Reuse canonical private consultation binding. The operator must own the source site.
          const [site] = await tx
            .select()
            .from(sites)
            .where(
              and(
                eq(sites.id, input.siteId),
                eq(sites.ownerId, actor.userId),
                eq(sites.visibility, 'private'),
                isNull(sites.deletedAt),
              ),
            )
            .limit(1)
            .for('share');
          const settings = site?.settings as
            | {
                consultation?: { version?: number; kind?: string; bookingId?: string };
                consultationLifecycle?: { revoked?: boolean };
              }
            | undefined;
          if (
            settings?.consultation?.version !== 1 ||
            settings.consultation.kind !== 'studio-consultation' ||
            settings.consultation.bookingId !== input.bookingId ||
            settings.consultationLifecycle?.revoked === true
          )
            throw new CrmError(404, 'Canonical booking unavailable');
          const [record] = await tx
            .insert(crmBookingLinks)
            .values({ ...input, id: randomUUID(), accountId: actor.accountId })
            .returning();
          if (!record) throw new CrmError(409, 'Booking link failed');
          await tx.insert(crmActivities).values({
            id: randomUUID(),
            accountId: actor.accountId,
            opportunityId: input.opportunityId,
            actorId: actor.userId,
            kind: 'booking-linked',
            summary: `Canonical booking ${input.bookingId} linked; payment and fulfillment remain authoritative at the source.`,
          });
          await receipt(tx, actor, 'booking', record.id, 'linked');
          return record;
        },
        true,
      ),
    reconcileBooking: (id: string) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const [link] = await tx
            .select()
            .from(crmBookingLinks)
            .where(and(eq(crmBookingLinks.accountId, actor.accountId), eq(crmBookingLinks.id, id)))
            .limit(1);
          if (!link) throw new CrmError(404, 'Booking link unavailable');
          if (!link.siteId)
            throw new CrmError(
              409,
              'Booking has no fulfillment site; synchronize its source instead',
            );
          const [site] = await tx
            .select({ settings: sites.settings, status: sites.status })
            .from(sites)
            .where(
              and(
                eq(sites.id, link.siteId),
                eq(sites.ownerId, actor.userId),
                eq(sites.visibility, 'private'),
                isNull(sites.deletedAt),
              ),
            )
            .limit(1)
            .for('share');
          const settings = site?.settings as
            | {
                consultation?: { bookingId?: string };
                consultationLifecycle?: Record<string, unknown>;
              }
            | undefined;
          if (settings?.consultation?.bookingId !== link.bookingId)
            throw new CrmError(404, 'Canonical booking unavailable');
          const state = {
            bookingId: link.bookingId,
            siteStatus: site?.status,
            lifecycle: settings.consultationLifecycle ?? null,
          };
          const action = `observed:${createHash('sha256').update(JSON.stringify(state)).digest('hex')}`;
          const [prior] = await tx
            .select({ id: crmAuditEvents.id })
            .from(crmAuditEvents)
            .where(
              and(
                eq(crmAuditEvents.accountId, actor.accountId),
                eq(crmAuditEvents.recordId, id),
                eq(crmAuditEvents.action, action),
              ),
            )
            .limit(1);
          if (!prior) {
            await tx.insert(crmActivities).values({
              id: randomUUID(),
              accountId: actor.accountId,
              opportunityId: link.opportunityId,
              actorId: actor.userId,
              kind: 'booking-reconciled',
              summary: JSON.stringify(state),
            });
            await receipt(tx, actor, 'booking', id, action);
          }
          return state;
        },
        true,
      ),
    recordRevenue: (id: string, raw: unknown) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const input = contracts.crmRevenueInput.parse(raw);
          const [record] = await tx
            .update(crmOpportunities)
            .set({ ...input, version: input.version + 1, updatedAt: new Date() })
            .where(
              and(
                eq(crmOpportunities.accountId, actor.accountId),
                eq(crmOpportunities.id, id),
                eq(crmOpportunities.version, input.version),
              ),
            )
            .returning();
          if (!record) throw new CrmError(409, 'Opportunity unavailable or stale edit');
          await receipt(tx, actor, 'opportunity', id, 'revenue-reconciled');
          return record;
        },
        true,
      ),
    previewContactImport: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmContactImportInput.parse(raw),
          seen = new Set<string>(),
          result = [];
        for (const [index, row] of input.rows.entries()) {
          const key = contracts.normalizeCrmEmail(row.businessEmail);
          const [existing] = await tx
            .select({ id: crmContacts.id })
            .from(crmContacts)
            .where(
              and(eq(crmContacts.accountId, actor.accountId), eq(crmContacts.normalizedEmail, key)),
            )
            .limit(1);
          result.push({ index, action: existing || seen.has(key) ? 'skip' : 'insert' });
          seen.add(key);
        }
        return result;
      }),
    commitContactImport: (raw: unknown) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const input = contracts.crmContactImportInput.parse(raw);
          if (!input.idempotencyKey) throw new CrmError(409, 'Import idempotency key required');
          const key = `contacts:${input.idempotencyKey}`,
            digest = createHash('sha256').update(JSON.stringify(input.rows)).digest('hex');
          const [prior] = await tx
            .select()
            .from(crmImports)
            .where(
              and(eq(crmImports.accountId, actor.accountId), eq(crmImports.idempotencyKey, key)),
            )
            .limit(1);
          if (prior) {
            if (prior.digest !== digest)
              throw new CrmError(409, 'Idempotency key reused for different input');
            return prior;
          }
          let inserted = 0;
          for (const row of input.rows) {
            const normalizedEmail = contracts.normalizeCrmEmail(row.businessEmail);
            const [suppression] = await tx
              .select({ id: crmSuppression.id })
              .from(crmSuppression)
              .where(
                and(
                  eq(crmSuppression.accountId, actor.accountId),
                  eq(crmSuppression.normalizedEmail, normalizedEmail),
                ),
              )
              .limit(1);
            const blocked = Boolean(suppression) || row.doNotContact || row.consent === 'withdrawn';
            const records = await tx
              .insert(crmContacts)
              .values({
                ...row,
                id: randomUUID(),
                accountId: actor.accountId,
                normalizedEmail,
                doNotContact: blocked,
                consent: blocked ? 'withdrawn' : row.consent,
              })
              .onConflictDoNothing({ target: [crmContacts.accountId, crmContacts.normalizedEmail] })
              .returning({ id: crmContacts.id });
            inserted += records.length;
          }
          const [record] = await tx
            .insert(crmImports)
            .values({
              id: randomUUID(),
              accountId: actor.accountId,
              idempotencyKey: key,
              digest,
              inserted,
              skipped: input.rows.length - inserted,
              actorId: actor.userId,
            })
            .returning();
          if (!record) throw new CrmError(409, 'Import failed');
          await receipt(tx, actor, 'import', record.id, 'contacts-committed');
          return record;
        },
        true,
      ),
    previewImport: (raw: unknown) =>
      scoped(db, actor, async (tx) => {
        const input = contracts.crmImportInput.parse(raw),
          seen = new Set<string>();
        const result = [];
        for (const [index, row] of input.rows.entries()) {
          const key = contracts.organizationDedupeKey(row);
          const [existing] = await tx
            .select({ id: crmOrganizations.id })
            .from(crmOrganizations)
            .where(
              and(
                eq(crmOrganizations.accountId, actor.accountId),
                eq(crmOrganizations.dedupeKey, key),
              ),
            )
            .limit(1);
          result.push({ index, key, action: existing || seen.has(key) ? 'skip' : 'insert' });
          seen.add(key);
        }
        return result;
      }),
    commitImport: (raw: unknown) =>
      scoped(
        db,
        actor,
        async (tx) => {
          const input = contracts.crmImportInput.parse(raw);
          if (!input.idempotencyKey) throw new CrmError(409, 'Import idempotency key required');
          // Serialize receipts within an account; concurrent identical commits return the same result.
          await tx
            .select({ id: accounts.id })
            .from(accounts)
            .where(eq(accounts.id, actor.accountId))
            .for('update');
          const digest = createHash('sha256').update(JSON.stringify(input.rows)).digest('hex');
          const [prior] = await tx
            .select()
            .from(crmImports)
            .where(
              and(
                eq(crmImports.accountId, actor.accountId),
                eq(crmImports.idempotencyKey, input.idempotencyKey),
              ),
            )
            .limit(1);
          if (prior) {
            if (prior.digest !== digest)
              throw new CrmError(409, 'Idempotency key reused for different input');
            return prior;
          }
          let inserted = 0;
          for (const row of input.rows) {
            const records = await tx
              .insert(crmOrganizations)
              .values({
                ...row,
                id: randomUUID(),
                accountId: actor.accountId,
                dedupeKey: contracts.organizationDedupeKey(row),
              })
              .onConflictDoNothing({
                target: [crmOrganizations.accountId, crmOrganizations.dedupeKey],
              })
              .returning({ id: crmOrganizations.id });
            inserted += records.length;
          }
          const [record] = await tx
            .insert(crmImports)
            .values({
              id: randomUUID(),
              accountId: actor.accountId,
              idempotencyKey: input.idempotencyKey,
              digest,
              inserted,
              skipped: input.rows.length - inserted,
              actorId: actor.userId,
            })
            .returning();
          if (!record) throw new CrmError(409, 'Import failed');
          await receipt(tx, actor, 'import', record.id, 'committed');
          return record;
        },
        true,
      ),
    draftingContext: (contactId: string) =>
      scoped(db, actor, async (tx) => {
        const contact = await contactAllowed(tx, actor, contactId);
        const [organization] = contact.organizationId
          ? await tx
              .select({
                name: crmOrganizations.name,
                industry: crmOrganizations.industry,
                website: crmOrganizations.website,
                sourceUrl: crmOrganizations.sourceUrl,
              })
              .from(crmOrganizations)
              .where(
                and(
                  eq(crmOrganizations.accountId, actor.accountId),
                  eq(crmOrganizations.id, contact.organizationId),
                  isNull(crmOrganizations.deletedAt),
                ),
              )
              .limit(1)
          : [];
        return {
          name: contact.name,
          role: contact.role,
          sourceUrl: contact.contactSourceUrl,
          organization,
        };
      }),
    dashboard: () =>
      scoped(db, actor, async (tx) => {
        const funnel = await tx
          .select({
            stage: crmOpportunities.stage,
            currency: crmOpportunities.currency,
            count: sql<number>`count(*)::int`,
            pipelineCents: sql<number>`coalesce(sum(${crmOpportunities.valueCents}),0)::bigint`,
            realizedRevenueCents: sql<number>`coalesce(sum(${crmOpportunities.realizedRevenueCents}),0)::bigint`,
          })
          .from(crmOpportunities)
          .where(eq(crmOpportunities.accountId, actor.accountId))
          .groupBy(crmOpportunities.stage, crmOpportunities.currency);
        const [tasks] = await tx
          .select({ overdue: sql<number>`count(*)::int` })
          .from(crmTasks)
          .where(
            and(
              eq(crmTasks.accountId, actor.accountId),
              sql`${crmTasks.status} IN ('todo','in_progress')`,
              sql`${crmTasks.dueAt} < now()`,
            ),
          );
        const [followups] = await tx
          .select({ overdue: sql<number>`count(*)::int` })
          .from(crmOpportunities)
          .where(
            and(
              eq(crmOpportunities.accountId, actor.accountId),
              sql`${crmOpportunities.stage} NOT IN ('won','lost','do_not_contact')`,
              sql`${crmOpportunities.nextActionAt} < now()`,
            ),
          );
        const activityCounts = await tx
          .select({ kind: crmActivities.kind, count: sql<number>`count(*)::int` })
          .from(crmActivities)
          .where(eq(crmActivities.accountId, actor.accountId))
          .groupBy(crmActivities.kind);
        const draftCounts = await tx
          .select({ status: crmOutreachDrafts.status, count: sql<number>`count(*)::int` })
          .from(crmOutreachDrafts)
          .where(eq(crmOutreachDrafts.accountId, actor.accountId))
          .groupBy(crmOutreachDrafts.status);
        const [bookings] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(crmBookingLinks)
          .where(eq(crmBookingLinks.accountId, actor.accountId));
        return {
          activityCounts,
          draftCounts,
          linkedBookings: bookings?.count ?? 0,
          responseRate: null,
          funnel,
          overdueTasks: tasks?.overdue ?? 0,
          overdueFollowups: followups?.overdue ?? 0,
        };
      }),
  };
}
