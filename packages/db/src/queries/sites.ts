/**
 * Site database queries
 */

import {
  canAdministerAllContent,
  canManageSiteContent,
  isPlatformSuperAdmin,
  type PlatformAuthUser,
} from '@revealui/utils/validation';
import { and, count, desc, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { siteCollaborators, sites } from '../schema/sites.js';
import { users } from '../schema/users.js';

/** Condition that excludes soft-deleted sites */
const notDeleted = isNull(sites.deletedAt);

export interface SiteReadAccess {
  actor: PlatformAuthUser | null;
  mode: 'hosted' | 'forge' | null;
  includePublic?: boolean;
  draft?: boolean;
}

export type ConsultationLifecycleMutation = { bookingId: string; buyerUserId: string } & (
  | {
      action: 'observe';
      revoked: boolean;
      domainPackEntitled: boolean;
      refund?: { chargeId: string; amountRefunded: number; full: boolean };
    }
  | {
      action: 'resolve-domain-pack';
      chargeId: string;
      amountRefunded: number;
      decision: 'retained' | 'revoked';
    }
  | { action: 'revoke' }
);

/** Trusted published deliveries require the exact buyer's current membership. */
function clientShareCondition(db: Database, buyerUserId: string, access?: SiteReadAccess): SQL {
  if (String(access?.actor?.id ?? '') !== buyerUserId) return sql`false`;
  return trustedClientDeliveryCondition(db, buyerUserId);
}

function studioOwnerIds(db: Database) {
  return db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.status, 'active'),
        eq(users.emailVerified, true),
        sql`jsonb_typeof(${users._json}) = 'object'`,
        sql`jsonb_typeof(${users._json}->'roles') = 'array'`,
        sql`(${users._json}->'roles') @> '["super-admin"]'::jsonb`,
      ),
    );
}

function consultationDomainAuthorityCondition(db: Database): SQL {
  const verifiedBuyers = db
    .select({ id: users.id })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.status, 'active'), eq(users.emailVerified, true)));
  return (
    and(
      inArray(sites.ownerId, studioOwnerIds(db)),
      inArray(sql`${sites.settings}->'consultation'->>'buyerUserId'`, verifiedBuyers),
    ) ?? sql`false`
  );
}

function trustedClientDeliveryCondition(db: Database, buyerUserId: string | SQL): SQL {
  const memberships = db
    .select({ id: siteCollaborators.siteId })
    .from(siteCollaborators)
    .innerJoin(users, eq(siteCollaborators.userId, users.id))
    .where(
      and(
        eq(siteCollaborators.userId, buyerUserId),
        isNull(users.deletedAt),
        eq(users.status, 'active'),
        eq(users.emailVerified, true),
        inArray(siteCollaborators.role, ['viewer', 'editor', 'admin']),
      ),
    );
  return (
    and(
      eq(sites.visibility, 'private'),
      eq(sites.status, 'published'),
      sql`${sites.settings}->'consultationLifecycle'->'version' = '1'::jsonb`,
      sql`${sites.settings}->'consultationLifecycle'->'revoked' = 'false'::jsonb`,
      inArray(sites.ownerId, studioOwnerIds(db)),
      inArray(sites.id, memberships),
      sql`jsonb_typeof(${sites.settings}->'consultation') = 'object'`,
      sql`${sites.settings}->'consultation'->'version' = '1'::jsonb`,
      sql`${sites.settings}->'consultation'->>'kind' = 'studio-consultation'`,
      sql`jsonb_typeof(${sites.settings}->'consultation'->'bookingId') = 'string'`,
      sql`length(btrim(${sites.settings}->'consultation'->>'bookingId')) BETWEEN 1 AND 256`,
      sql`${sites.settings}->'consultation'->>'bookingId' = btrim(${sites.settings}->'consultation'->>'bookingId')`,
      sql`(${sites.settings}->'consultation') - ARRAY['version','kind','bookingId','buyerUserId']::text[] = '{}'::jsonb`,
      sql`jsonb_typeof(${sites.settings}->'consultation'->'buyerUserId') = 'string'`,
      sql`${sites.settings}->'consultation'->>'buyerUserId' = ${buyerUserId}`,
    ) ?? sql`false`
  );
}

export interface ConsultationDomain {
  hostname: string;
  provider: 'vercel';
  projectId: string;
  verifiedAt: string;
}

/** Hold this owning row lock throughout external domain mutations. */
export async function getSiteForUpdate(db: Database, siteId: string) {
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), notDeleted))
    .for('update')
    .limit(1);
  return site ?? null;
}
function consultationDomainEntitledCondition() {
  return and(
    sql`${sites.settings}->'consultationLifecycle'->'revoked' = 'false'::jsonb`,
    sql`${sites.settings}->'consultationLifecycle'->'domainPackPurchased' = 'true'::jsonb`,
    sql`${sites.settings}->'consultationLifecycle'->>'domainPack' IN ('entitled', 'retained')`,
  );
}

/** Public resolution exposes only the owning site ID; the reader still authenticates. */
export async function getConsultationSiteIdByHostname(
  db: Database,
  hostname: string,
  projectId?: string,
) {
  const [site] = await db
    .select({ siteId: sites.id })
    .from(sites)
    .where(
      and(
        notDeleted,
        sql`${sites.settings}->'consultationDomain'->>'hostname' = ${hostname}`,
        sql`${sites.settings}->'consultationDomain'->>'provider' = 'vercel'`,
        projectId
          ? sql`${sites.settings}->'consultationDomain'->>'projectId' = ${projectId}`
          : undefined,
        consultationDomainEntitledCondition(),
        trustedClientDeliveryCondition(db, sql`${sites.settings}->'consultation'->>'buyerUserId'`),
      ),
    )
    .limit(1);
  return site ?? null;
}

export async function getConsultationDomainOwner(db: Database, hostname: string) {
  const [site] = await db
    .select({ siteId: sites.id })
    .from(sites)
    .where(
      sql`COALESCE(${sites.settings}->'consultationDomain'->>'hostname', ${sites.settings}->'consultationDomainPending'->>'hostname') = ${hostname}`,
    )
    .limit(1);
  return site ?? null;
}

/** Reserve provider resources in the same store before any external mutation. */
export async function reserveConsultationDomain(
  db: Database,
  siteId: string,
  ownerId: string,
  input: Omit<ConsultationDomain, 'verifiedAt'>,
) {
  const [site] = await db
    .update(sites)
    .set({
      settings: sql`jsonb_set(${sites.settings}, '{consultationDomainPending}', ${JSON.stringify(input)}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.ownerId, ownerId),
        notDeleted,
        eq(sites.visibility, 'private'),
        sql`${sites.settings} ? 'consultation'`,
        consultationDomainAuthorityCondition(db),
        consultationDomainEntitledCondition(),
        sql`(${sites.settings}->'consultationDomain'->>'hostname' IS NULL OR ${sites.settings}->'consultationDomain'->>'hostname' = ${input.hostname})`,
        sql`(${sites.settings}->'consultationDomainPending'->>'hostname' IS NULL OR ${sites.settings}->'consultationDomainPending'->>'hostname' = ${input.hostname})`,
        sql`(${sites.settings}->'consultationDomain'->>'projectId' IS NULL OR ${sites.settings}->'consultationDomain'->>'projectId' = ${input.projectId})`,
        sql`(${sites.settings}->'consultationDomainPending'->>'projectId' IS NULL OR ${sites.settings}->'consultationDomainPending'->>'projectId' = ${input.projectId})`,
      ),
    )
    .returning()
    .catch((error: unknown) => {
      if (SiteDomainCleanupRequiredError.fromDatabase(error))
        throw new SiteDomainCleanupRequiredError(
          { cause: error },
          'Account erasure is in progress. This hostname cannot be attached.',
        );
      throw error;
    });
  return site ?? null;
}

export async function setConsultationDomain(
  db: Database,
  siteId: string,
  ownerId: string,
  domain: ConsultationDomain,
) {
  const [site] = await db
    .update(sites)
    .set({
      settings: sql`jsonb_set(${sites.settings} - 'consultationDomainPending', '{consultationDomain}', ${JSON.stringify(domain)}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.ownerId, ownerId),
        notDeleted,
        eq(sites.visibility, 'private'),
        sql`${sites.settings} ? 'consultation'`,
        consultationDomainAuthorityCondition(db),
        consultationDomainEntitledCondition(),
        sql`${sites.settings}->'consultationDomainPending'->>'hostname' = ${domain.hostname}`,
        sql`${sites.settings}->'consultationDomainPending'->>'projectId' = ${domain.projectId}`,
      ),
    )
    .returning()
    .catch((error: unknown) => {
      if (SiteDomainCleanupRequiredError.fromDatabase(error))
        throw new SiteDomainCleanupRequiredError(
          { cause: error },
          'Account erasure is in progress. This hostname cannot be attached.',
        );
      throw error;
    });
  return site ?? null;
}

/** A newly denied provider proof stops public resolution while preserving cleanup ownership. */
export async function invalidateConsultationDomainProof(
  db: Database,
  siteId: string,
  ownerId: string,
  hostname: string,
) {
  const [site] = await db
    .update(sites)
    .set({
      settings: sql`${sites.settings} - 'consultationDomain'`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.ownerId, ownerId),
        notDeleted,
        sql`${sites.settings}->'consultationDomainPending'->>'hostname' = ${hostname}`,
      ),
    )
    .returning();
  return site ?? null;
}

export async function removeConsultationDomain(
  db: Database,
  siteId: string,
  ownerId: string,
  hostname: string,
) {
  const [site] = await db
    .update(sites)
    .set({
      settings: sql`${sites.settings} - 'consultationDomain' - 'consultationDomainPending'`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sites.id, siteId),
        eq(sites.ownerId, ownerId),
        notDeleted,
        sql`${sites.settings} ? 'consultation'`,
        sql`COALESCE(${sites.settings}->'consultationDomain'->>'hostname', ${sites.settings}->'consultationDomainPending'->>'hostname') = ${hostname}`,
      ),
    )
    .returning();
  return site ?? null;
}

/** Count sites matching filters (for pagination) */
export async function countSites(
  db: Database,
  options: {
    ownerId?: string;
    status?: string;
    includeDeleted?: boolean;
    access?: SiteReadAccess;
    clientShareBuyerUserId?: string;
    consultationBookingId?: string;
  } = {},
) {
  const { ownerId, status, includeDeleted = false } = options;
  const conditions = [
    ...(includeDeleted ? [] : [notDeleted]),
    ...(options.consultationBookingId
      ? [sql`${sites.settings}->'consultation'->>'bookingId' = ${options.consultationBookingId}`]
      : []),
    ...(options.clientShareBuyerUserId
      ? [clientShareCondition(db, options.clientShareBuyerUserId, options.access)]
      : []),
    ...(options.access
      ? [
          inArray(
            sites.id,
            getSiteIdsForContentRead(db, options.access.actor, options.access.mode, options.access),
          ),
        ]
      : []),
    ...(ownerId ? [eq(sites.ownerId, ownerId)] : []),
    ...(status ? [eq(sites.status, status)] : []),
  ];
  const result = await db
    .select({ total: count() })
    .from(sites)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return result[0]?.total ?? 0;
}

export async function getAllSites(
  db: Database,
  options: {
    ownerId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
    access?: SiteReadAccess;
    clientShareBuyerUserId?: string;
    consultationBookingId?: string;
  } = {},
) {
  const { ownerId, status, limit = 20, offset = 0, includeDeleted = false } = options;
  const conditions = [
    ...(includeDeleted ? [] : [notDeleted]),
    ...(options.consultationBookingId
      ? [sql`${sites.settings}->'consultation'->>'bookingId' = ${options.consultationBookingId}`]
      : []),
    ...(options.clientShareBuyerUserId
      ? [clientShareCondition(db, options.clientShareBuyerUserId, options.access)]
      : []),
    ...(options.access
      ? [
          inArray(
            sites.id,
            getSiteIdsForContentRead(db, options.access.actor, options.access.mode, options.access),
          ),
        ]
      : []),
    ...(ownerId ? [eq(sites.ownerId, ownerId)] : []),
    ...(status ? [eq(sites.status, status)] : []),
  ];
  return db
    .select()
    .from(sites)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sites.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getSiteById(
  db: Database,
  id: string,
  options: { access?: SiteReadAccess; clientShareBuyerUserId?: string } = {},
) {
  const result = await db
    .select()
    .from(sites)
    .where(
      and(
        eq(sites.id, id),
        notDeleted,
        options.access
          ? inArray(
              sites.id,
              getSiteIdsForContentRead(
                db,
                options.access.actor,
                options.access.mode,
                options.access,
              ),
            )
          : undefined,
        options.clientShareBuyerUserId
          ? clientShareCondition(db, options.clientShareBuyerUserId, options.access)
          : undefined,
      ),
    )
    .limit(1);
  return result[0] ?? null;
}

export async function getSiteBySlug(db: Database, slug: string) {
  const result = await db
    .select()
    .from(sites)
    .where(and(eq(sites.slug, slug), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

export async function createSite(db: Database, data: typeof sites.$inferInsert) {
  const settings = data.settings;
  if (
    settings &&
    typeof settings === 'object' &&
    ['consultationLifecycle', 'consultationDomain', 'consultationDomainPending'].some(
      (key) => key in settings,
    )
  ) {
    throw new SiteMutationProtectedError(
      'Consultation lifecycle and domain proof require their maintained owner.',
    );
  }
  const result = await db.insert(sites).values(data).onConflictDoNothing().returning();
  return result[0] ?? null;
}

export class SiteMutationProtectedError extends Error {
  readonly statusCode = 409;
  readonly code = 'SITE_MUTATION_PROTECTED';
}

export class SiteDomainCleanupRequiredError extends Error {
  readonly statusCode = 409;
  readonly code = 'SITE_DOMAIN_CLEANUP_REQUIRED';
  constructor(
    options?: ErrorOptions,
    message = 'Detach the consultation hostname before deleting this site.',
  ) {
    super(message, options);
  }
  static fromDatabase(error: unknown): SiteDomainCleanupRequiredError | null {
    if (error instanceof SiteDomainCleanupRequiredError) return error;
    if (!error || typeof error !== 'object') return null;
    const value = error as { code?: string; constraint?: string; cause?: unknown };
    if (value.code === '23514' && value.constraint === 'sites_consultation_domain_cleanup_required')
      return new SiteDomainCleanupRequiredError({ cause: error });
    return value.cause !== error ? SiteDomainCleanupRequiredError.fromDatabase(value.cause) : null;
  }
}

const managedSiteSettings = [
  'consultation',
  'consultationLifecycle',
  'consultationDomain',
  'consultationDomainPending',
] as const;
const genericSiteUpdateFields = new Set([
  'name',
  'slug',
  'description',
  'status',
  'visibility',
  'theme',
  'settings',
  'favicon',
  'ownerId',
]);

/** Ordinary metadata writes cannot replace provenance or manufacture provider proof. */
export async function updateSite(
  db: Database,
  id: string,
  data: Partial<typeof sites.$inferInsert>,
) {
  if (Object.keys(data).some((key) => !genericSiteUpdateFields.has(key)))
    throw new SiteMutationProtectedError('Use the maintained site owner for protected fields.');
  const settings = data.settings;
  if (settings !== undefined && settings !== null) {
    if (
      typeof settings !== 'object' ||
      Array.isArray(settings) ||
      managedSiteSettings.some((key) => key in settings)
    )
      throw new SiteMutationProtectedError('Consultation settings require their maintained owner.');
  }
  const changesBoundAuthority =
    data.ownerId !== undefined || data.settings !== undefined || data.visibility !== undefined;
  const result = await db
    .update(sites)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(sites.id, id),
        notDeleted,
        changesBoundAuthority
          ? sql`NOT COALESCE(${sites.settings} ? 'consultation', false)`
          : undefined,
      ),
    )
    .returning();
  if (!result[0] && changesBoundAuthority) {
    const current = await getSiteById(db, id);
    if (
      current?.settings &&
      typeof current.settings === 'object' &&
      'consultation' in current.settings
    )
      throw new SiteMutationProtectedError(
        'Consultation owner, audience and settings require their maintained owner.',
      );
  }
  return result[0] ?? null;
}

/** One atomic statement makes refund denial survive stale publication requests. */
export async function updateConsultationLifecycle(
  db: Database,
  siteId: string,
  ownerId: string,
  input: ConsultationLifecycleMutation,
) {
  const old = sql`${sites.settings}->'consultationLifecycle'`;
  const oldAmount = sql`COALESCE((${old}->>'amountRefunded')::bigint, 0)`;
  const oldRevoked = sql`COALESCE((${old}->>'revoked')::boolean, false)`;
  const conditions = [
    eq(sites.id, siteId),
    eq(sites.ownerId, ownerId),
    notDeleted,
    eq(sites.visibility, 'private'),
    sql`${sites.settings}->'consultation'->>'bookingId' = ${input.bookingId}`,
    sql`${sites.settings}->'consultation'->>'buyerUserId' = ${input.buyerUserId}`,
  ];
  let next: SQL;
  if (input.action === 'resolve-domain-pack') {
    conditions.push(
      sql`NOT ${oldRevoked}`,
      sql`${oldAmount} = ${input.amountRefunded}`,
      sql`${old}->>'chargeId' = ${input.chargeId}`,
      sql`${old}->>'domainPack' IN ('review_required', 'retained', 'revoked')`,
    );
    if (input.decision === 'retained')
      conditions.push(
        sql`${old}->>'domainPack' <> 'revoked'`,
        sql`${old}->'domainPackPurchased' = 'true'::jsonb`,
      );
    next = sql`jsonb_set(${old}, '{domainPack}', to_jsonb(${input.decision}::text))`;
  } else {
    const refund = input.action === 'observe' ? input.refund : undefined;
    const amount = refund?.amountRefunded ?? 0;
    const revoked = input.action === 'revoke' || input.revoked || !!refund?.full;
    const entitled = input.action === 'observe' && input.domainPackEntitled;
    if (refund) {
      conditions.push(
        sql`(${old}->>'chargeId' IS NULL OR ${old}->>'chargeId' = ${refund.chargeId})`,
      );
    }
    next = sql`jsonb_strip_nulls(jsonb_build_object(
      'version', 1,
      'revoked', (${oldRevoked} OR ${revoked}),
      'domainPackPurchased', COALESCE((${old}->>'domainPackPurchased')::boolean, true) AND ${entitled},
      'amountRefunded', GREATEST(${oldAmount}, ${amount}::bigint),
      'chargeId', COALESCE(${old}->>'chargeId', ${refund?.chargeId ?? null}::text),
      'domainPack', CASE
        WHEN ${oldRevoked} OR ${revoked} THEN 'revoked'
        WHEN ${amount}::bigint > ${oldAmount} THEN 'review_required'
        WHEN ${old} IS NULL THEN CASE WHEN ${entitled} THEN 'entitled' ELSE 'unentitled' END
        WHEN NOT ${entitled} AND ${old}->>'domainPack' = 'entitled' THEN 'unentitled'
        ELSE ${old}->>'domainPack'
      END
    ))`;
  }
  const [site] = await db
    .update(sites)
    .set({
      settings: sql`jsonb_set(${sites.settings}, '{consultationLifecycle}', ${next})`,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();
  return site ?? null;
}

/** Soft-delete: sets deletedAt timestamp instead of removing the row */
export async function deleteSite(db: Database, id: string) {
  const removed = await db
    .update(sites)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(sites.id, id),
        notDeleted,
        sql`NOT COALESCE(${sites.settings} ? 'consultationDomain' OR ${sites.settings} ? 'consultationDomainPending', false)`,
      ),
    )
    .returning();
  if (!removed[0]) {
    const current = await getSiteById(db, id);
    if (
      current?.settings &&
      typeof current.settings === 'object' &&
      ('consultationDomain' in current.settings || 'consultationDomainPending' in current.settings)
    )
      throw new SiteDomainCleanupRequiredError();
  }
}

/** Restore a soft-deleted site */
export async function restoreSite(db: Database, id: string) {
  const result = await db
    .update(sites)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(sites.id, id))
    .returning();
  return result[0] ?? null;
}

/** Permanently remove a soft-deleted site (admin cleanup) */
export async function purgeSite(db: Database, id: string) {
  try {
    const removed = await db
      .delete(sites)
      .where(
        and(
          eq(sites.id, id),
          sql`NOT COALESCE(${sites.settings} ? 'consultationDomain' OR ${sites.settings} ? 'consultationDomainPending', false)`,
        ),
      )
      .returning();
    if (!removed[0]) {
      const [retained] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(
          and(
            eq(sites.id, id),
            or(
              sql`${sites.settings} ? 'consultationDomain'`,
              sql`${sites.settings} ? 'consultationDomainPending'`,
            ),
          ),
        )
        .limit(1);
      if (retained) throw new SiteDomainCleanupRequiredError();
    }
  } catch (error) {
    throw SiteDomainCleanupRequiredError.fromDatabase(error) ?? error;
  }
}

export async function incrementPageCount(db: Database, siteId: string): Promise<void> {
  await db
    .update(sites)
    .set({ pageCount: sql`COALESCE(${sites.pageCount}, 0) + 1` })
    .where(eq(sites.id, siteId));
}

export async function decrementPageCount(db: Database, siteId: string): Promise<void> {
  await db
    .update(sites)
    .set({ pageCount: sql`GREATEST(COALESCE(${sites.pageCount}, 0) - 1, 0)` })
    .where(eq(sites.id, siteId));
}

/** Resolve authorization fields from the canonical user row, never flattened CMS roles. */
export async function getSiteContentActor(
  db: Database,
  userId: string,
): Promise<PlatformAuthUser | null> {
  const [actor] = await db
    .select({
      id: users.id,
      role: users.role,
      emailVerified: users.emailVerified,
      _json: users._json,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt), eq(users.status, 'active')))
    .limit(1);
  return actor ?? null;
}

/** Site authority. Agents may propose session drafts; human editors own live writes. */
export async function actorCanManageSite(
  db: Database,
  actor: PlatformAuthUser | null,
  siteId: string,
  mode: 'hosted' | 'forge' | null,
  action: 'edit' | 'admin' | 'propose' = 'edit',
): Promise<boolean> {
  const site = await getSiteById(db, siteId);
  if (!(site && actor?.id)) return false;
  if (site.settings && typeof site.settings === 'object' && 'consultation' in site.settings) {
    return String(actor.id) === site.ownerId && isPlatformSuperAdmin(actor);
  }
  if (actor.role === 'agent' && action !== 'propose') return false;
  if (canManageSiteContent(actor, site.ownerId, mode)) return true;
  const [membership] = await db
    .select({ role: siteCollaborators.role })
    .from(siteCollaborators)
    .where(
      and(eq(siteCollaborators.siteId, siteId), eq(siteCollaborators.userId, String(actor.id))),
    )
    .limit(1);
  return membership?.role === 'admin' || (action !== 'admin' && membership?.role === 'editor');
}

/** Live-site scope for queries whose caller already supplies authorization. */
export function getLiveSiteIds(db: Database) {
  return db.select({ id: sites.id }).from(sites).where(notDeleted);
}

/** Unpaginated SQL subquery for page reads; deleted sites never grant visibility. */
export function getSiteIdsForContentRead(
  db: Database,
  actor: PlatformAuthUser | null,
  mode: 'hosted' | 'forge' | null,
  options: { draft?: boolean; includePublic?: boolean } = {},
) {
  const { draft = false, includePublic = !actor } = options;
  const memberships = actor?.id
    ? db
        .select({ id: siteCollaborators.siteId })
        .from(siteCollaborators)
        .where(
          and(
            eq(siteCollaborators.userId, String(actor.id)),
            inArray(
              siteCollaborators.role,
              draft ? ['admin', 'editor'] : ['admin', 'editor', 'viewer'],
            ),
          ),
        )
    : undefined;
  const editors = actor?.id
    ? db
        .select({ id: siteCollaborators.siteId })
        .from(siteCollaborators)
        .where(
          and(
            eq(siteCollaborators.userId, String(actor.id)),
            inArray(siteCollaborators.role, ['admin', 'editor']),
          ),
        )
    : undefined;
  const memberAccess = actor?.id
    ? or(
        eq(sites.ownerId, String(actor.id)),
        editors ? inArray(sites.id, editors) : undefined,
        !draft && memberships
          ? and(eq(sites.status, 'published'), inArray(sites.id, memberships))
          : undefined,
      )
    : undefined;
  return db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        notDeleted,
        isPlatformSuperAdmin(actor)
          ? undefined
          : or(
              sql`NOT COALESCE(${sites.settings} ? 'consultation', false)`,
              !draft && actor?.id
                ? clientShareCondition(db, String(actor.id), { actor, mode })
                : undefined,
            ),
        canAdministerAllContent(actor, mode)
          ? undefined
          : or(
              memberAccess,
              !draft && includePublic
                ? and(eq(sites.visibility, 'public'), eq(sites.status, 'published'))
                : undefined,
              sql`false`,
            ),
      ),
    );
}

/** Same audience predicate used by collection queries, with absent/deleted sites denied. */
export async function actorCanReadSite(
  db: Database,
  actor: PlatformAuthUser | null,
  siteId: string,
  mode: 'hosted' | 'forge' | null,
  options: { draft?: boolean; includePublic?: boolean } = {},
): Promise<boolean> {
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        eq(sites.id, siteId),
        inArray(sites.id, getSiteIdsForContentRead(db, actor, mode, options)),
      ),
    )
    .limit(1);
  return Boolean(site);
}

/** Collaborator mutations are used only after the caller verifies site administration. */
export async function listSiteCollaborators(db: Database, siteId: string) {
  return db.select().from(siteCollaborators).where(eq(siteCollaborators.siteId, siteId));
}

export async function setSiteCollaborator(
  db: Database,
  input: { siteId: string; userId: string; role: 'admin' | 'editor' | 'viewer'; addedBy: string },
) {
  const [member] = await db
    .insert(siteCollaborators)
    .values({ id: crypto.randomUUID(), ...input })
    .onConflictDoUpdate({
      target: [siteCollaborators.siteId, siteCollaborators.userId],
      set: { role: input.role, addedBy: input.addedBy },
    })
    .returning();
  return member;
}

export async function removeSiteCollaborator(db: Database, siteId: string, userId: string) {
  await db
    .delete(siteCollaborators)
    .where(and(eq(siteCollaborators.siteId, siteId), eq(siteCollaborators.userId, userId)));
}
