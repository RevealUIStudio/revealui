import type { Database, DatabaseClient } from '@revealui/db/client';
import * as siteQueries from '@revealui/db/queries/sites';
import {
  getSiteContentActor,
  removeConsultationDomain,
  reserveConsultationDomain,
  setConsultationDomain,
  updateConsultationLifecycle,
} from '@revealui/db/queries/sites';
import * as schema from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { OpenAPIHono } from '@revealui/openapi';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../content/consultation-domain.js';
import type { ContentVariables } from '../content/index.js';
import userRoutes from '../content/users.js';

const transaction = vi.hoisted(() => ({ current: null as Database | null }));
vi.mock('@revealui/db/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@revealui/db/client')>();
  return {
    ...original,
    withTransaction: <T>(db: Database, operation: (tx: Database) => Promise<T>) =>
      original.withTransaction(db, async (tx) => {
        transaction.current = tx;
        try {
          return await operation(tx);
        } finally {
          transaction.current = null;
        }
      }),
  };
});

let testDb: TestDb;
const provider = vi.fn();
const hostname = 'client.customer.com';
const project = { name: hostname, projectId: 'prj_studio', verified: true };
const dns = {
  configuredBy: 'CNAME',
  misconfigured: false,
  acceptedChallenges: ['http-01'],
  recommendedCNAME: [{ rank: 1, value: 'cname.vercel-dns.com' }],
  recommendedIPv4: [],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function app(actor: string | null) {
  const result = new OpenAPIHono<{ Variables: ContentVariables }>();
  result.use('*', async (c, next) => {
    c.set('db', testDb.drizzle as unknown as DatabaseClient);
    if (actor) {
      const user = await getSiteContentActor(testDb.drizzle, actor);
      if (user) c.set('user', { ...user, id: String(user.id), role: user.role ?? 'viewer' });
    }
    await next();
  });
  result.route('/api/content', routes);
  result.route('/api/content', userRoutes);
  result.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    throw error;
  });
  return result;
}
async function createSite(id: string) {
  await testDb.drizzle.insert(schema.sites).values({
    id,
    name: 'Private delivery',
    slug: id,
    ownerId: 'operator',
    visibility: 'private',
    status: 'published',
    settings: {
      consultation: {
        version: 1,
        kind: 'studio-consultation',
        bookingId: id,
        buyerUserId: 'buyer',
      },
      consultationLifecycle: {
        version: 1,
        revoked: false,
        domainPackPurchased: true,
        domainPack: 'entitled',
        amountRefunded: 0,
      },
    },
  });
  await testDb.drizzle
    .insert(schema.siteCollaborators)
    .values({ id: `${id}-buyer`, siteId: id, userId: 'buyer', role: 'viewer' });
}
const attach = (id: string, actor = 'operator', body: unknown = { hostname }) =>
  app(actor).request(`/api/content/sites/${id}/consultation-domain`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const resolve = () => app(null).request(`/api/content/consultation-domain?hostname=${hostname}`);
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.drizzle.insert(schema.users).values(
    ['operator', 'other-operator', 'buyer', 'account-admin'].map((id) => ({
      id,
      name: id,
      email: `${id}@customer.com`,
      role: id === 'account-admin' ? 'admin' : 'viewer',
      status: 'active',
      emailVerified: true,
      _json: ['buyer', 'account-admin'].includes(id) ? {} : { roles: ['super-admin'] },
    })),
  );
});
beforeEach(async () => {
  // Fixture teardown uses the same persisted cleanup owner before hard deletion.
  for (const site of await testDb.drizzle.select().from(schema.sites)) {
    const settings = site.settings as Record<string, { hostname?: string }> | null;
    const savedHostname =
      settings?.consultationDomain?.hostname ?? settings?.consultationDomainPending?.hostname;
    if (savedHostname)
      await removeConsultationDomain(testDb.drizzle, site.id, site.ownerId, savedHostname);
  }
  await testDb.drizzle.delete(schema.sites);
  vi.clearAllMocks();
  vi.stubGlobal('fetch', provider);
  vi.stubEnv('STUDIO_VERCEL_TOKEN', 'provider-secret');
  vi.stubEnv('STUDIO_VERCEL_PROJECT_ID', 'prj_studio');
  vi.stubEnv('STUDIO_VERCEL_TEAM_ID', 'team_studio');
  provider.mockImplementation(async (url: URL) =>
    json(url.pathname.includes('/config') ? dns : project),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await testDb?.close();
});

describe('provider-backed private consultation domains', () => {
  it('returns the known erasure admission conflict before any provider mutation', async () => {
    await createSite('erasure-admission-conflict');
    vi.spyOn(siteQueries, 'reserveConsultationDomain').mockRejectedValueOnce(
      new siteQueries.SiteDomainCleanupRequiredError(
        { cause: { code: '23514', constraint: 'sites_consultation_domain_cleanup_required' } },
        'Account erasure is in progress. This hostname cannot be attached.',
      ),
    );
    const response = await attach('erasure-admission-conflict');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'Account erasure is in progress. This hostname cannot be attached.',
    });
    expect(provider).not.toHaveBeenCalled();
    expect((await testDb.drizzle.select().from(schema.sites))[0]?.settings).not.toHaveProperty(
      'consultationDomainPending',
    );
  });
  it('preserves the current cleanup owner through direct account deletion and status mutation attempts', async () => {
    await createSite('account-deletion-prerequisite');
    expect((await attach('account-deletion-prerequisite')).status).toBe(200);
    expect(
      (await app('account-admin').request('/api/content/users/operator', { method: 'DELETE' }))
        .status,
    ).toBe(409);
    expect(
      (
        await app('account-admin').request('/api/content/users/operator', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'deleted' }),
        })
      ).status,
    ).toBe(409);
    expect(
      (await testDb.drizzle.select().from(schema.users).where(eq(schema.users.id, 'operator')))[0],
    ).toMatchObject({ status: 'active', deletedAt: null, anonymizedAt: null });
    expect((await resolve()).status).toBe(200);
    provider
      .mockResolvedValueOnce(json(project))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(
      (
        await app('operator').request(
          '/api/content/sites/account-deletion-prerequisite/consultation-domain',
          { method: 'DELETE' },
        )
      ).status,
    ).toBe(200);
  });
  it.each([
    ['operator verification', 'operator', { emailVerified: false }],
    ['operator role', 'operator', { _json: { roles: [] } }],
    ['buyer status', 'buyer', { status: 'suspended' }],
    ['buyer verification', 'buyer', { emailVerified: false }],
  ])(
    'denies promotion after current %s is lost during provider verification',
    async (_name, userId, change) => {
      await createSite('authority-during-verification');
      provider.mockImplementation(async (url: URL) => {
        if (url.pathname.includes('/config')) {
          // Change canonical rows in the actual transaction before promotion. PGlite
          // has one connection; using that transaction avoids a second queued query.
          if (!transaction.current) throw new Error('Expected the owning transaction');
          await transaction.current
            .update(schema.users)
            .set(change)
            .where(eq(schema.users.id, userId));
          return json(dns);
        }
        return json(project);
      });
      expect((await attach('authority-during-verification')).status).toBe(409);
      const [site] = await testDb.drizzle
        .select()
        .from(schema.sites)
        .where(eq(schema.sites.id, 'authority-during-verification'));
      expect(site?.settings).not.toHaveProperty('consultationDomain');
      expect(site?.settings).toHaveProperty('consultationDomainPending');
      expect((await resolve()).status).toBe(404);
    },
  );

  it('uses one deadline across sequential provider calls and retains the committed reservation after abort', async () => {
    await createSite('deadline');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const deadline = vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(
        () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
        milliseconds,
      );
      return controller.signal;
    });
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    provider.mockImplementation((_url: URL, options: RequestInit) => {
      started();
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(json({}, 404)), 6_000);
        options.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(options.signal?.reason);
          },
          { once: true },
        );
      });
    });
    const result = attach('deadline');
    await entered;
    await vi.advanceTimersByTimeAsync(6_000);
    expect(provider).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4_000);
    expect((await result).status).toBe(503);
    expect(deadline).toHaveBeenCalledExactlyOnceWith(10_000);
    expect(provider.mock.calls[0][1].signal).toBe(provider.mock.calls[1][1].signal);
    expect(
      (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'deadline')))[0]
        ?.settings,
    ).toHaveProperty('consultationDomainPending');
  });
  it('creates provider attachment and reports ownership/DNS pending without persisting a public mapping', async () => {
    await createSite('pending');
    const unverified = {
      ...project,
      verified: false,
      verification: [{ type: 'TXT', domain: '_vercel.client.customer.com', value: 'challenge' }],
    };
    provider
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json(unverified))
      .mockResolvedValueOnce(json(unverified))
      .mockResolvedValueOnce(json({}, 400))
      .mockResolvedValueOnce(json(unverified))
      .mockResolvedValueOnce(json({ ...dns, misconfigured: true }));
    const result = await attach('pending');
    expect(result.status).toBe(202);
    expect((await result.json()).data).toMatchObject({
      siteId: 'pending',
      domain: null,
      customDomainAttached: false,
      status: 'pending-verification',
      hostname,
      verification: unverified.verification,
    });
    const [url, request] = provider.mock.calls[1];
    expect(String(url)).toBe(
      'https://api.vercel.com/v10/projects/prj_studio/domains?teamId=team_studio',
    );
    expect(request).toMatchObject({
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      headers: { Authorization: 'Bearer provider-secret' },
    });
    expect(JSON.parse(request.body)).toEqual({ name: hostname });
    expect((await resolve()).status).toBe(404);
    expect(
      (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'pending')))[0]
        ?.settings,
    ).not.toHaveProperty('consultationDomain');
    expect(
      (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'pending')))[0]
        ?.settings,
    ).toHaveProperty('consultationDomainPending', {
      hostname,
      provider: 'vercel',
      projectId: 'prj_studio',
    });
    await createSite('pending-duplicate');
    provider.mockClear();
    expect((await attach('pending-duplicate')).status).toBe(409);
    expect(provider).not.toHaveBeenCalled();
    // Cleanup uses the persisted reservation through a fresh request, even before verification.
    provider
      .mockResolvedValueOnce(json(unverified))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(
      (
        await app('operator').request('/api/content/sites/pending/consultation-domain', {
          method: 'DELETE',
        })
      ).status,
    ).toBe(200);
    expect(
      (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'pending')))[0]
        ?.settings,
    ).not.toHaveProperty('consultationDomainPending');
  });

  it('binds canonical unique hostnames only after exact production-project and DNS proof', async () => {
    await createSite('attached');
    const result = await attach('attached', 'operator', { hostname: ' Client.Customer.COM ' });
    expect(result.status).toBe(200);
    expect((await result.json()).data).toMatchObject({
      siteId: 'attached',
      customDomainAttached: true,
      status: 'attached',
      domain: { hostname, provider: 'vercel', projectId: 'prj_studio' },
    });
    expect(String(provider.mock.calls[1][0])).toBe(
      'https://api.vercel.com/v6/domains/client.customer.com/config?teamId=team_studio&projectIdOrName=prj_studio&strict=true',
    );
    const publicResult = await resolve();
    expect(publicResult.status).toBe(200);
    expect(publicResult.headers.get('Cache-Control')).toBe('no-store');
    expect(await publicResult.json()).toEqual({ success: true, data: { siteId: 'attached' } });
    await createSite('duplicate');
    provider.mockClear();
    expect((await attach('duplicate')).status).toBe(409);
    expect(provider).not.toHaveBeenCalled();
    await expect(
      reserveConsultationDomain(testDb.drizzle, 'duplicate', 'operator', {
        hostname,
        provider: 'vercel',
        projectId: 'prj_studio',
      }),
    ).rejects.toThrow();
  });

  it('denies unowned, untrusted, forged or reserved hostname requests before provider calls', async () => {
    await createSite('authority');
    expect((await attach('authority', 'buyer')).status).toBe(403);
    expect((await attach('authority', 'other-operator')).status).toBe(404);
    for (const forbidden of [
      'admin.revealui.com',
      'www.revealuistudio.com',
      'preview.vercel.app',
      'host.local',
      '127.0.0.1',
      '*.customer.com',
      'https://customer.com',
      'customer.com:443',
    ]) {
      expect((await attach('authority', 'operator', { hostname: forbidden })).status).toBe(400);
    }
    expect(
      (await attach('authority', 'operator', { hostname, verifiedAt: new Date().toISOString() }))
        .status,
    ).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });

  it('fails closed on wrong projects, redirects, preview branches and malformed provider DNS data', async () => {
    await createSite('proof');
    const proofHost = 'proof.customer.com';
    for (const mismatch of [
      { projectId: 'prj_wrong' },
      { name: 'wrong.customer.com' },
      { gitBranch: 'preview' },
      { customEnvironmentId: 'env_preview' },
      { redirect: 'elsewhere.customer.com' },
    ]) {
      provider.mockResolvedValueOnce(json({ ...project, name: proofHost, ...mismatch }));
      expect((await attach('proof', 'operator', { hostname: proofHost })).status).toBe(503);
    }
    provider
      .mockResolvedValueOnce(json({ ...project, name: proofHost }))
      .mockResolvedValueOnce(json({ ...dns, misconfigured: 'false' }));
    expect((await attach('proof', 'operator', { hostname: proofHost })).status).toBe(503);
    vi.stubEnv('STUDIO_VERCEL_PROJECT_ID', '');
    expect((await attach('proof', 'operator', { hostname: proofHost })).status).toBe(503);
  });

  it('denies public resolution on current review, account, membership or publication loss and detaches after revocation', async () => {
    await createSite('attached');
    expect((await attach('attached')).status).toBe(200);
    for (const id of ['operator', 'buyer']) {
      await testDb.drizzle
        .update(schema.users)
        .set({ emailVerified: false })
        .where(eq(schema.users.id, id));
      expect((await resolve()).status).toBe(404);
      await testDb.drizzle
        .update(schema.users)
        .set({ emailVerified: true })
        .where(eq(schema.users.id, id));
    }
    await testDb.drizzle
      .delete(schema.siteCollaborators)
      .where(eq(schema.siteCollaborators.siteId, 'attached'));
    expect((await resolve()).status).toBe(404);
    await testDb.drizzle.insert(schema.siteCollaborators).values({
      id: 'attached-buyer-restored',
      siteId: 'attached',
      userId: 'buyer',
      role: 'viewer',
    });
    await testDb.drizzle
      .update(schema.sites)
      .set({ status: 'draft' })
      .where(eq(schema.sites.id, 'attached'));
    expect((await resolve()).status).toBe(404);
    await testDb.drizzle
      .update(schema.sites)
      .set({ status: 'published' })
      .where(eq(schema.sites.id, 'attached'));
    await updateConsultationLifecycle(testDb.drizzle, 'attached', 'operator', {
      action: 'observe',
      bookingId: 'attached',
      buyerUserId: 'buyer',
      revoked: false,
      domainPackEntitled: true,
      refund: { chargeId: 'ch_domain', amountRefunded: 50, full: false },
    });
    expect((await resolve()).status).toBe(404);
    expect((await attach('attached')).status).toBe(409);
    await updateConsultationLifecycle(testDb.drizzle, 'attached', 'operator', {
      action: 'revoke',
      bookingId: 'attached',
      buyerUserId: 'buyer',
    });
    provider
      .mockResolvedValueOnce(json(project))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const detached = await app('operator').request(
      '/api/content/sites/attached/consultation-domain',
      { method: 'DELETE' },
    );
    expect(detached.status).toBe(200);
    expect((await detached.json()).data).toEqual({
      siteId: 'attached',
      status: 'detached',
      domain: null,
      customDomainAttached: false,
    });
    expect(provider.mock.calls.at(-1)?.[1].method).toBe('DELETE');
    expect((await resolve()).status).toBe(404);
  });

  it('denies an attachment whose current lifecycle was revoked before provider work', async () => {
    await createSite('race');
    await updateConsultationLifecycle(testDb.drizzle, 'race', 'operator', {
      action: 'revoke',
      bookingId: 'race',
      buyerUserId: 'buyer',
    });
    expect((await attach('race')).status).toBe(409);
    expect((await resolve()).status).toBe(404);
    expect(
      (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'race')))[0]
        ?.settings,
    ).not.toHaveProperty('consultationDomain');
    expect(provider).not.toHaveBeenCalled();
  });

  it('retains cleanup ownership on provider failure and refuses deletion of a different project', async () => {
    await createSite('failure');
    provider.mockRejectedValueOnce(new Error('Provider unavailable'));
    expect((await attach('failure')).status).toBe(503);
    expect(
      (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'failure')))[0]
        ?.settings,
    ).toHaveProperty('consultationDomainPending');
    provider.mockClear();
    provider.mockResolvedValueOnce(json({ ...project, projectId: 'prj_other' }));
    expect(
      (
        await app('operator').request('/api/content/sites/failure/consultation-domain', {
          method: 'DELETE',
        })
      ).status,
    ).toBe(503);
    expect(provider.mock.calls.every(([, options]) => options.method !== 'DELETE')).toBe(true);
    expect(
      (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'failure')))[0]
        ?.settings,
    ).toHaveProperty('consultationDomainPending');
    provider.mockResolvedValueOnce(json({}, 404));
    expect(
      (
        await app('operator').request('/api/content/sites/failure/consultation-domain', {
          method: 'DELETE',
        })
      ).status,
    ).toBe(200);
    expect(
      (await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'failure')))[0]
        ?.settings,
    ).not.toHaveProperty('consultationDomainPending');
  });

  it('removes an obsolete verified proof when provider DNS becomes pending, preserving retry ownership', async () => {
    await createSite('reverify');
    expect((await attach('reverify')).status).toBe(200);
    provider
      .mockResolvedValueOnce(json(project))
      .mockResolvedValueOnce(json({ ...dns, configuredBy: 'dns-01' }));
    expect((await attach('reverify')).status).toBe(202);
    expect((await resolve()).status).toBe(404);
    const settings = (
      await testDb.drizzle.select().from(schema.sites).where(eq(schema.sites.id, 'reverify'))
    )[0]?.settings;
    expect(settings).not.toHaveProperty('consultationDomain');
    expect(settings).toHaveProperty('consultationDomainPending');
  });

  it('serializes same-host detach and reattach without erasing a newer provider resource', async () => {
    await createSite('serialized');
    expect((await attach('serialized')).status).toBe(200);
    let attached = true;
    let enterDelete!: () => void;
    let releaseDelete!: () => void;
    const entered = new Promise<void>((resolve) => {
      enterDelete = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const operations: string[] = [];
    provider.mockImplementation(async (url: URL, options: RequestInit) => {
      operations.push(options.method ?? 'GET');
      if (url.pathname.includes('/config')) return json(dns);
      if (options.method === 'DELETE') {
        attached = false;
        enterDelete();
        await release;
        return new Response(null, { status: 204 });
      }
      if (options.method === 'POST') attached = true;
      return attached ? json(project) : json({}, 404);
    });
    const deleting = app('operator').request('/api/content/sites/serialized/consultation-domain', {
      method: 'DELETE',
    });
    await entered;
    const attaching = attach('serialized');
    releaseDelete();
    expect((await deleting).status).toBe(200);
    expect((await attaching).status).toBe(200);
    expect(operations.indexOf('DELETE')).toBeLessThan(operations.indexOf('POST'));
    expect(attached).toBe(true);
    expect(await (await resolve()).json()).toEqual({
      success: true,
      data: { siteId: 'serialized' },
    });
  });
  it('enforces domain shape, active entitlement and cleanup before soft deletion in the database', async () => {
    await createSite('guards');
    const [site] = await testDb.drizzle
      .select()
      .from(schema.sites)
      .where(eq(schema.sites.id, 'guards'));
    const base = site?.settings as Record<string, unknown>;
    const pending = { hostname, provider: 'vercel' as const, projectId: 'prj_studio' };
    for (const malformed of [
      { ...pending, hostname: 'Client.Customer.com' },
      { ...pending, hostname: 'admin.revealui.com' },
      { ...pending, hostname: '127.0.0.1' },
      { ...pending, projectId: 'wrong' },
      { ...pending, provider: 'untrusted' },
      { ...pending, verifiedAt: new Date().toISOString() },
      { ...pending, callerProof: true },
    ]) {
      await expect(
        testDb.drizzle
          .update(schema.sites)
          .set({ settings: { ...base, consultationDomainPending: malformed } })
          .where(eq(schema.sites.id, 'guards')),
      ).rejects.toThrow();
    }
    await reserveConsultationDomain(testDb.drizzle, 'guards', 'operator', pending);
    await expect(
      testDb.drizzle
        .update(schema.sites)
        .set({ deletedAt: new Date() })
        .where(eq(schema.sites.id, 'guards')),
    ).rejects.toThrow();
    await updateConsultationLifecycle(testDb.drizzle, 'guards', 'operator', {
      action: 'revoke',
      bookingId: 'guards',
      buyerUserId: 'buyer',
    });
    const [revoked] = await testDb.drizzle
      .select()
      .from(schema.sites)
      .where(eq(schema.sites.id, 'guards'));
    await expect(
      testDb.drizzle
        .update(schema.sites)
        .set({
          settings: {
            ...(revoked?.settings as Record<string, unknown>),
            consultationDomain: { ...pending, verifiedAt: new Date().toISOString() },
          },
        })
        .where(eq(schema.sites.id, 'guards')),
    ).rejects.toThrow();
    provider.mockResolvedValueOnce(json({}, 404));
    expect(
      (
        await app('operator').request('/api/content/sites/guards/consultation-domain', {
          method: 'DELETE',
        })
      ).status,
    ).toBe(200);
    await expect(
      testDb.drizzle
        .update(schema.sites)
        .set({ deletedAt: new Date() })
        .where(eq(schema.sites.id, 'guards')),
    ).resolves.toBeDefined();
  });
  it('rejects raw new domain assignments after canonical authority loss while preserving existing cleanup state', async () => {
    await createSite('canonical-domain-guard');
    const pending = { hostname, provider: 'vercel' as const, projectId: 'prj_studio' };
    await reserveConsultationDomain(testDb.drizzle, 'canonical-domain-guard', 'operator', pending);
    const [site] = await testDb.drizzle
      .select()
      .from(schema.sites)
      .where(eq(schema.sites.id, 'canonical-domain-guard'));
    for (const userId of ['operator', 'buyer']) {
      await testDb.drizzle
        .update(schema.users)
        .set({ emailVerified: false })
        .where(eq(schema.users.id, userId));
      try {
        await expect(
          testDb.drizzle
            .update(schema.sites)
            .set({
              settings: {
                ...(site?.settings as Record<string, unknown>),
                consultationDomain: { ...pending, verifiedAt: new Date().toISOString() },
              },
            })
            .where(eq(schema.sites.id, 'canonical-domain-guard')),
        ).rejects.toThrow();
        // Losing authority does not invalidate the durable cleanup reservation.
        await expect(
          testDb.drizzle
            .update(schema.sites)
            .set({ status: 'draft' })
            .where(eq(schema.sites.id, 'canonical-domain-guard')),
        ).resolves.toBeDefined();
      } finally {
        await testDb.drizzle
          .update(schema.users)
          .set({ emailVerified: true })
          .where(eq(schema.users.id, userId));
      }
    }
    await updateConsultationLifecycle(testDb.drizzle, 'canonical-domain-guard', 'operator', {
      action: 'revoke',
      bookingId: 'canonical-domain-guard',
      buyerUserId: 'buyer',
    });
    provider.mockResolvedValueOnce(json({}, 404));
    expect(
      (
        await app('operator').request(
          '/api/content/sites/canonical-domain-guard/consultation-domain',
          { method: 'DELETE' },
        )
      ).status,
    ).toBe(200);
  });
  it('rejects stale verified completion after a reservation has been detached', async () => {
    await createSite('stale');
    const reserved = { hostname, provider: 'vercel' as const, projectId: 'prj_studio' };
    expect(
      await reserveConsultationDomain(testDb.drizzle, 'stale', 'operator', reserved),
    ).not.toBeNull();
    provider.mockResolvedValueOnce(json({}, 404));
    expect(
      (
        await app('operator').request('/api/content/sites/stale/consultation-domain', {
          method: 'DELETE',
        })
      ).status,
    ).toBe(200);
    expect(
      await setConsultationDomain(testDb.drizzle, 'stale', 'operator', {
        ...reserved,
        verifiedAt: new Date().toISOString(),
      }),
    ).toBeNull();
    expect((await resolve()).status).toBe(404);
  });
});
