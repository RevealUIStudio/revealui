import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../client/index.js';
import { createCrmService } from '../crm-service.js';

let pg: PGlite;
let db: Database;
let crm: ReturnType<typeof createCrmService>;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE TABLE users(id text PRIMARY KEY,status text NOT NULL DEFAULT 'active',deleted_at timestamptz);
    CREATE TABLE accounts(id text PRIMARY KEY,name text,slug text,status text NOT NULL DEFAULT 'active',created_at timestamptz,updated_at timestamptz);
    CREATE TABLE account_memberships(id text PRIMARY KEY,account_id text REFERENCES accounts(id),user_id text REFERENCES users(id),role text,status text);
    CREATE TABLE sites(id text PRIMARY KEY,owner_id text,schema_version text DEFAULT '1',version int DEFAULT 1,name text,slug text,description text,status text DEFAULT 'draft',visibility text DEFAULT 'private',theme jsonb,settings jsonb,page_count int,favicon text,created_at timestamptz,updated_at timestamptz,published_at timestamptz,deleted_at timestamptz);
    INSERT INTO users(id) VALUES ('owner'),('member'),('other'),('revoked');
    INSERT INTO accounts(id) VALUES ('a'),('b');
    INSERT INTO account_memberships VALUES ('m1','a','owner','owner','active'),('m2','a','member','member','active'),('m3','b','other','owner','active'),('m4','a','revoked','owner','revoked');`);
  await pg.exec(
    await readFile(new URL('../../migrations/0053_studio_crm_v1.sql', import.meta.url), 'utf8'),
  );
  await pg.exec(
    await readFile(
      new URL('../../migrations/0054_crm_booking_source.sql', import.meta.url),
      'utf8',
    ),
  );
  db = drizzle(pg) as unknown as Database;
  crm = createCrmService(db, { userId: 'owner', accountId: 'a' });
});
afterAll(async () => pg.close());
const org = (name: string) => ({
  name,
  website: `https://${name}.example`,
  sourceUrl: `https://${name}.example/about`,
});
describe('native CRM persistence and security', () => {
  it('denies nonmembers, revoked membership and inactive accounts on reads and writes', async () => {
    for (const userId of ['other', 'revoked', 'absent']) {
      const denied = createCrmService(db, { userId, accountId: 'a' });
      await expect(denied.list('contacts', {})).rejects.toThrow('access denied');
      await expect(denied.createOrganization(org('denied'))).rejects.toThrow('access denied');
    }
    await pg.exec("UPDATE accounts SET status='suspended' WHERE id='b'");
    await expect(
      createCrmService(db, { userId: 'other', accountId: 'b' }).dashboard(),
    ).rejects.toThrow('access denied');
    await pg.exec("UPDATE accounts SET status='active' WHERE id='b'");
  });
  it('enforces account-safe relationships and active same-account opportunity/task assignment', async () => {
    const other = createCrmService(db, { userId: 'other', accountId: 'b' });
    const organization = await other.createOrganization(org('foreign'));
    await expect(
      crm.createContact({
        organizationId: organization.id,
        businessEmail: 'foreign@example.test',
        contactSourceUrl: 'https://foreign.example/team',
      }),
    ).rejects.toThrow();
    const own = await crm.createOrganization(org('own'));
    await expect(
      crm.createOpportunity({
        organizationId: own.id,
        title: 'Invalid assignment',
        offer: 'pilot',
        ownerId: 'other',
      }),
    ).rejects.toThrow('access denied');
    await expect(crm.createTask({ title: 'Invalid task', assigneeId: 'revoked' })).rejects.toThrow(
      'access denied',
    );
    expect(await crm.list('organizations', {})).not.toContainEqual(
      expect.objectContaining({ id: organization.id }),
    );
  });
  it('deduplicates and validates import commits with durable idempotency receipts', async () => {
    const input = { rows: [org('imported'), org('imported')], idempotencyKey: 'first-import' };
    expect(await crm.previewImport(input)).toEqual([
      expect.objectContaining({ action: 'insert' }),
      expect.objectContaining({ action: 'skip' }),
    ]);
    const receipt = await crm.commitImport(input);
    expect(receipt).toMatchObject({ inserted: 1, skipped: 1 });
    expect(await crm.commitImport(input)).toEqual(receipt);
    await expect(crm.commitImport({ ...input, rows: [org('different')] })).rejects.toThrow(
      'different input',
    );
    await expect(crm.commitImport({ rows: [org('no-key')] })).rejects.toThrow('idempotency key');
    await expect(
      createCrmService(db, { userId: 'member', accountId: 'a' }).commitImport(input),
    ).rejects.toThrow('access denied');
  });
  it('keeps stage changes atomic, refuses invalid/stale transitions and distinguishes booked from realized revenue', async () => {
    const organization = await crm.createOrganization(org('pipeline'));
    const opportunity = await crm.createOpportunity({
      organizationId: organization.id,
      title: 'Pilot',
      offer: 'pilot',
      ownerId: 'owner',
      nextActionAt: '2020-01-01',
    });
    expect(opportunity.valueCents).toBe(399700);
    await expect(crm.transition(opportunity.id, { stage: 'won', version: 1 })).rejects.toThrow(
      'invalid stage',
    );
    await crm.transition(opportunity.id, { stage: 'qualified', version: 1 });
    await expect(
      crm.transition(opportunity.id, { stage: 'contact_ready', version: 1 }),
    ).rejects.toThrow('Stale');
    expect(await crm.list('audit', {})).toContainEqual(
      expect.objectContaining({ recordId: opportunity.id, action: 'stage-changed' }),
    );
    expect((await crm.dashboard()).overdueFollowups).toBeGreaterThan(0);
    const rows = (await crm.dashboard()).funnel;
    expect(rows.find((r) => r.stage === 'qualified')).toMatchObject({ realizedRevenueCents: 0 });
  });
  it('requires human approval, invalidates approval on edits, and cancels suppressed drafts', async () => {
    const contact = await crm.createContact({
      businessEmail: 'Person@Example.test',
      contactSourceUrl: 'https://example.test/team',
      consent: 'permitted',
    });
    const draft = await crm.createDraft({
      contactId: contact.id,
      subject: 'Question',
      body: 'Possible priorities?',
      evidence: ['https://example.test/team'],
    });
    await expect(
      createCrmService(db, { userId: 'member', accountId: 'a' }).approveDraft(draft.id, {
        version: 1,
      }),
    ).rejects.toThrow('access denied');
    expect(await crm.approveDraft(draft.id, { version: 1 })).toMatchObject({
      status: 'approved',
      approvedBy: 'owner',
      version: 2,
    });
    expect(
      await crm.editDraft(draft.id, {
        subject: 'Revised question',
        body: 'Revised hypothesis',
        evidence: ['https://example.test/team'],
        version: 2,
      }),
    ).toMatchObject({ status: 'draft', approvedBy: null, version: 3 });
    await crm.approveDraft(draft.id, { version: 3 });
    await crm.suppress({ email: 'PERSON@example.test', reason: 'opt-out' });
    expect(await crm.list('drafts', {})).toContainEqual(
      expect.objectContaining({ id: draft.id, status: 'cancelled', approvedBy: null }),
    );
    await expect(
      crm.createDraft({
        contactId: contact.id,
        subject: 'No',
        body: 'No',
        evidence: ['https://example.test/team'],
      }),
    ).rejects.toThrow('suppressed');
  });
  it('requires canonical booking identity, owner access and a same-account opportunity; linking never marks won', async () => {
    const organization = await crm.createOrganization(org('booking'));
    const opportunity = await crm.createOpportunity({
      organizationId: organization.id,
      title: 'Consultation',
      offer: 'consultation',
    });
    await pg.query('INSERT INTO sites(id,owner_id,settings) VALUES ($1,$2,$3::jsonb)', [
      'site',
      'owner',
      JSON.stringify({
        consultation: { version: 1, kind: 'studio-consultation', bookingId: 'booking-1' },
        consultationLifecycle: { revoked: false },
      }),
    ]);
    await expect(
      crm.linkBooking({ opportunityId: opportunity.id, siteId: 'site', bookingId: 'forged' }),
    ).rejects.toThrow('unavailable');
    await crm.linkBooking({
      opportunityId: opportunity.id,
      siteId: 'site',
      bookingId: 'booking-1',
    });
    expect(await crm.list('opportunities', {})).toContainEqual(
      expect.objectContaining({ id: opportunity.id, stage: 'research', realizedRevenueCents: 0 }),
    );
    await expect(
      crm.linkBooking({ opportunityId: opportunity.id, siteId: 'site', bookingId: 'booking-1' }),
    ).rejects.toThrow();
  });
  it('imports external contacts idempotently and preserves existing suppression', async () => {
    await crm.suppress({ email: 'import-contact@example.test', reason: 'Prior opt-out' });
    const input = {
      rows: [
        {
          businessEmail: 'Import-Contact@Example.test',
          contactSourceUrl: 'https://example.test/team',
          consent: 'permitted',
        },
      ],
      idempotencyKey: 'contact-import',
    };
    const receipt = await crm.commitContactImport(input);
    expect(receipt.inserted).toBe(1);
    expect(await crm.commitContactImport(input)).toEqual(receipt);
    expect(await crm.list('contacts', {})).toContainEqual(
      expect.objectContaining({
        normalizedEmail: 'import-contact@example.test',
        doNotContact: true,
        consent: 'withdrawn',
      }),
    );
  });
  it('archives contacts and enforces do-not-contact across opportunity-linked contacts', async () => {
    const organization = await crm.createOrganization(org('opt-out'));
    const contact = await crm.createContact({
      organizationId: organization.id,
      businessEmail: 'dnc@example.test',
      contactSourceUrl: 'https://example.test/team',
      consent: 'permitted',
    });
    const opportunity = await crm.createOpportunity({
      organizationId: organization.id,
      title: 'Stop outreach',
      offer: 'consultation',
    });
    await crm.transition(opportunity.id, { stage: 'do_not_contact', version: 1 });
    await expect(crm.editContact(contact.id, { consent: 'permitted', version: 2 })).rejects.toThrow(
      'Suppression',
    );
    await crm.archiveContact(contact.id, { version: 2 });
    expect(await crm.list('contacts', {})).not.toContainEqual(
      expect.objectContaining({ id: contact.id }),
    );
  });
  it('reconciles booking lifecycle idempotently, including revocation', async () => {
    const links = await crm.list('bookings', {});
    const link = links[0];
    if (!link) throw new Error('Fixture link missing');
    const first = await crm.reconcileBooking(link.id);
    expect(first).toMatchObject({ bookingId: 'booking-1' });
    const before = (await crm.list('activities', {})).length;
    await crm.reconcileBooking(link.id);
    expect((await crm.list('activities', {})).length).toBe(before);
    await pg.query(
      "UPDATE sites SET settings=jsonb_set(settings,'{consultationLifecycle,revoked}','true') WHERE id='site'",
    );
    expect(await crm.reconcileBooking(link.id)).toMatchObject({ lifecycle: { revoked: true } });
  });
  it('synchronizes the existing paid booking pipeline before private fulfillment and preserves source authority', async () => {
    const organization = await crm.createOrganization(org('source-booking'));
    const opportunity = await crm.createOpportunity({
      organizationId: organization.id,
      title: 'Existing three-hour consultation',
      offer: 'consultation',
    });
    const input = { opportunityId: opportunity.id, bookingId: 'source-booking-1' };
    const evidence = {
      contract: 'studio-crm-booking-v1',
      bookingId: input.bookingId,
      status: 'paid_scheduled',
      start: '2026-10-20T14:00:00.000Z',
      end: '2026-10-20T17:00:00.000Z',
      hours: 3,
      name: 'Example Buyer',
      email: 'source-buyer@example.test',
      company: 'Example Co',
      stageB: true,
      stageBFee: 'paid_addon',
      stripeSessionId: 'cs_source',
      eventId: 'source_event',
      refund: null,
    };
    const link = await crm.syncSourceBooking(input, evidence, 'https://studio.example.test/book');
    expect(link.siteId).toBeNull();
    expect(link.sourceSnapshot).toMatchObject({ hours: 3, status: 'paid_scheduled' });
    expect(link.sourceSnapshot).not.toHaveProperty('email');
    expect(
      await crm.syncSourceBooking(input, evidence, 'https://studio.example.test/book'),
    ).toEqual(link);
    expect(await crm.list('contacts', {})).toContainEqual(
      expect.objectContaining({ businessEmail: evidence.email, consent: 'unknown' }),
    );
    expect(await crm.list('opportunities', {})).toContainEqual(
      expect.objectContaining({ id: opportunity.id, stage: 'research', realizedRevenueCents: 0 }),
    );
    await expect(
      crm.syncSourceBooking(
        input,
        { ...evidence, bookingId: 'forged' },
        'https://studio.example.test/book',
      ),
    ).rejects.toThrow('identity');
    await expect(
      crm.syncSourceBooking(
        input,
        { ...evidence, eventId: null },
        'https://studio.example.test/book',
      ),
    ).rejects.toThrow();
    expect(
      (
        await crm.syncSourceBooking(
          input,
          { contract: 'studio-crm-booking-v1', bookingId: input.bookingId, status: 'missing' },
          'https://studio.example.test/book',
        )
      ).sourceSnapshot,
    ).toMatchObject({ status: 'missing' });
  });
  it('rejects unbounded requests and payload privilege injection', async () => {
    await expect(crm.list('contacts', { limit: 1000 })).rejects.toThrow();
    await expect(crm.createOrganization({ ...org('injection'), accountId: 'b' })).rejects.toThrow();
  });
});
