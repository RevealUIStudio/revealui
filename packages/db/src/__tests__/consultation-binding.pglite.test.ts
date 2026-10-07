import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let db: PGlite;
const binding = (bookingId: string, buyerUserId = 'buyer') => ({
  version: 1,
  kind: 'studio-consultation',
  bookingId,
  buyerUserId,
});

async function insert(
  id: string,
  owner = 'operator',
  visibility = 'private',
  marker: unknown = binding(id),
) {
  return db.query(
    'INSERT INTO sites(id,owner_id,visibility,settings) VALUES ($1,$2,$3,$4::jsonb)',
    [id, owner, visibility, JSON.stringify({ consultation: marker })],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE users(id text PRIMARY KEY, status text NOT NULL DEFAULT 'active',
      deleted_at timestamptz, email_verified boolean NOT NULL DEFAULT true, _json jsonb,
      email text, email_verified_at timestamptz, email_verification_token text,
      email_verification_token_expires_at timestamptz);
    CREATE TABLE sites(id text PRIMARY KEY, owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      visibility text NOT NULL DEFAULT 'public', settings jsonb, status text DEFAULT 'draft', deleted_at timestamptz);
    INSERT INTO users(id,_json) VALUES
      ('operator','{"roles":["super-admin"]}'), ('buyer','{}'), ('other-buyer','{}'),
      ('shell-admin','{}'), ('string-roles','"{\\"roles\\":[\\"super-admin\\"]}"');
    INSERT INTO users(id,email_verified,_json) VALUES ('unverified',false,'{"roles":["super-admin"]}');
    INSERT INTO users(id,status,_json) VALUES ('disabled','disabled','{"roles":["super-admin"]}');
  `);
  await db.exec(
    await readFile(
      new URL('../../migrations/0051_consultation_binding.sql', import.meta.url),
      'utf8',
    ),
  );
});
afterAll(async () => {
  await db.close();
});

describe('persisted consultation provenance', () => {
  it('creates a verified private binding and allows unrelated settings edits and unpublication', async () => {
    await insert('valid');
    await db.query(
      "UPDATE sites SET settings=settings || '{\"theme\":\"dark\"}'::jsonb,status='archived' WHERE id='valid'",
    );
    expect(
      (
        await db.query<{ settings: { consultation: unknown } }>(
          "SELECT settings FROM sites WHERE id='valid'",
        )
      ).rows[0]?.settings.consultation,
    ).toEqual(binding('valid'));
  });

  it.each(['shell-admin', 'string-roles', 'unverified', 'disabled'])(
    'rejects marker creation by noncanonical operator owner %s',
    async (owner) => {
      await expect(insert(`owner-${owner}`, owner)).rejects.toThrow('verified platform operator');
    },
  );

  it.each(['missing', 'unverified', 'disabled'])(
    'rejects unverified or unavailable buyer %s',
    async (buyer) => {
      await expect(
        insert(`buyer-${buyer}`, 'operator', 'private', binding(`buyer-${buyer}`, buyer)),
      ).rejects.toThrow('verified active buyer');
    },
  );

  it('rejects public shares and malformed bindings', async () => {
    await expect(insert('public', 'operator', 'public')).rejects.toThrow('remain private');
    await expect(insert('null', 'operator', 'private', null)).rejects.toThrow(
      'Invalid consultation',
    );
    await expect(
      insert('extra', 'operator', 'private', { ...binding('extra'), verified: true }),
    ).rejects.toThrow('Invalid consultation');
    await expect(insert('whitespace', 'operator', 'private', binding(' padded '))).rejects.toThrow(
      'Invalid consultation',
    );
  });

  it('checks authority when adding a binding to a site with null settings', async () => {
    await db.exec(
      "INSERT INTO sites(id,owner_id,visibility) VALUES ('legacy-shell','shell-admin','private'),('legacy-operator','operator','private')",
    );
    await expect(
      db.query('UPDATE sites SET settings=$1::jsonb WHERE id=$2', [
        JSON.stringify({ consultation: binding('legacy-shell') }),
        'legacy-shell',
      ]),
    ).rejects.toThrow('verified platform operator');
    await db.query('UPDATE sites SET settings=$1::jsonb WHERE id=$2', [
      JSON.stringify({ consultation: binding('legacy-operator') }),
      'legacy-operator',
    ]);
  });

  it('keeps the owner, booking and buyer immutable and blocks removing the binding', async () => {
    await insert('immutable');
    await expect(
      db.query("UPDATE sites SET owner_id='shell-admin' WHERE id='immutable'"),
    ).rejects.toThrow('immutable');
    for (const marker of [binding('replacement'), binding('immutable', 'other-buyer')]) {
      await expect(
        db.query("UPDATE sites SET settings=$1::jsonb WHERE id='immutable'", [
          JSON.stringify({ consultation: marker }),
        ]),
      ).rejects.toThrow('immutable');
    }
    await expect(db.query("UPDATE sites SET settings='{}' WHERE id='immutable'")).rejects.toThrow(
      'immutable',
    );
    await expect(
      db.query("UPDATE sites SET visibility='public' WHERE id='immutable'"),
    ).rejects.toThrow('remain private');
  });

  it('prevents duplicate delivery even after soft deletion', async () => {
    await insert('unique');
    await db.query("UPDATE sites SET deleted_at=now() WHERE id='unique'");
    await expect(insert('duplicate', 'operator', 'private', binding('unique'))).rejects.toThrow(
      'sites_consultation_booking_unique',
    );
  });

  it('rejects malformed or removed persisted lifecycle authority', async () => {
    await insert('lifecycle-shape');
    const state = {
      version: 1,
      revoked: false,
      domainPackPurchased: true,
      domainPack: 'entitled',
      amountRefunded: 0,
    };
    const write = (value: unknown) =>
      db.query(
        "UPDATE sites SET settings=jsonb_set(settings,'{consultationLifecycle}',$1::jsonb) WHERE id='lifecycle-shape'",
        [JSON.stringify(value)],
      );
    await expect(write({ ...state, injected: true })).rejects.toThrow('Invalid consultation');
    await expect(write({ ...state, amountRefunded: 1 })).rejects.toThrow('refund authority');
    await expect(write({ ...state, revoked: true })).rejects.toThrow('refund authority');
    await write(state);
    await expect(
      db.query(
        "UPDATE sites SET settings=settings-'consultationLifecycle' WHERE id='lifecycle-shape'",
      ),
    ).rejects.toThrow('cannot be removed');
  });

  it('makes full revocation and cumulative refund identity monotonic across generic updates', async () => {
    await insert('lifecycle-monotonic');
    const state = {
      version: 1,
      revoked: true,
      domainPackPurchased: true,
      domainPack: 'revoked',
      amountRefunded: 5000,
      chargeId: 'ch_monotonic',
    };
    const write = (value: unknown) =>
      db.query(
        "UPDATE sites SET settings=jsonb_set(settings,'{consultationLifecycle}',$1::jsonb) WHERE id='lifecycle-monotonic'",
        [JSON.stringify(value)],
      );
    await write(state);
    for (const value of [
      { ...state, revoked: false },
      { ...state, amountRefunded: 1000 },
      { ...state, chargeId: 'ch_other' },
    ]) {
      await expect(write(value)).rejects.toThrow('cannot regress');
    }
    await db.query("UPDATE sites SET status='published' WHERE id='lifecycle-monotonic'");
    expect(
      (
        await db.query<{ state: unknown }>(
          "SELECT settings->'consultationLifecycle' AS state FROM sites WHERE id='lifecycle-monotonic'",
        )
      ).rows[0]?.state,
    ).toEqual(state);
  });

  it('does not let stale scope decisions restore optional material access', async () => {
    await insert('lifecycle-pack');
    const state = {
      version: 1,
      revoked: false,
      domainPackPurchased: false,
      domainPack: 'revoked',
      amountRefunded: 1000,
      chargeId: 'ch_pack',
    };
    const write = (value: unknown) =>
      db.query(
        "UPDATE sites SET settings=jsonb_set(settings,'{consultationLifecycle}',$1::jsonb) WHERE id='lifecycle-pack'",
        [JSON.stringify(value)],
      );
    await write(state);
    await expect(write({ ...state, domainPackPurchased: true })).rejects.toThrow('cannot regress');
    await expect(write({ ...state, domainPack: 'retained' })).rejects.toThrow('cannot regress');
    await write({ ...state, amountRefunded: 2000, domainPack: 'review_required' });
  });

  it('allows revocation after buyer disablement and preserves owner deletion cascade', async () => {
    await insert('revocable', 'operator', 'private', binding('revocable', 'other-buyer'));
    await db.query("UPDATE users SET status='disabled' WHERE id='other-buyer'");
    await db.query("UPDATE sites SET status='archived',deleted_at=now() WHERE id='revocable'");
    await db.query("DELETE FROM users WHERE id='operator'");
    expect((await db.query('SELECT id FROM sites WHERE owner_id=$1', ['operator'])).rows).toEqual(
      [],
    );
  });
});
