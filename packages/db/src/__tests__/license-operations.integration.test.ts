import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyLicenseOperation,
  findLicenseOperation,
  type LicenseOperationInput,
} from '../license-operations.js';
import { licenseJtiRevocations } from '../schema/license-jti-revocations.js';
import { licenseOperations } from '../schema/license-operations.js';
import { licenses } from '../schema/licenses.js';
import { createTestDb, type TestDb } from '../testing/drizzle-test-db.js';

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});

function initial(): LicenseOperationInput {
  return {
    operationId: randomUUID(),
    requestFingerprint: randomUUID(),
    customerId: randomUUID(),
    expectedCurrentLicenseKey: null,
    priorJti: null,
    priorExpiresAt: null,
    jti: randomUUID(),
    licenseId: randomUUID(),
    licenseKey: randomUUID(),
    tier: 'enterprise',
    expiresAt: null,
    perpetual: true,
    mode: 'live',
  };
}
function replacement(prior: LicenseOperationInput): LicenseOperationInput {
  return {
    ...prior,
    operationId: randomUUID(),
    requestFingerprint: randomUUID(),
    expectedCurrentLicenseKey: prior.licenseKey,
    priorJti: randomUUID(),
    jti: randomUUID(),
    licenseId: randomUUID(),
    licenseKey: randomUUID(),
  };
}

describe('committed license operation contract', () => {
  it('rolls back the descriptor column and signature transition if the final function creation fails', async () => {
    const previous = await readFile(
      new URL('../../migrations/0046_license_operations.sql', import.meta.url),
      'utf8',
    );
    const transition = await readFile(
      new URL('../../migrations/0047_license_operation_descriptors.sql', import.meta.url),
      'utf8',
    );
    await db.pglite.exec(
      'DROP FUNCTION license_apply_operation(text,text,text,text,text,timestamptz,text,text,text,timestamptz,boolean,text,text,jsonb); ALTER TABLE license_operations DROP COLUMN request_descriptor;',
    );
    await db.pglite.exec(previous.split('--> statement-breakpoint')[1]);
    // Force a syntax error in the dynamic CREATE, after ALTER and DROP have executed.
    await expect(
      db.pglite.exec(transition.replace('RETURNS jsonb', 'RETURNS synthetic_missing_type')),
    ).rejects.toThrow();
    const functions = await db.pglite.query<{ pronargs: number }>(
      "SELECT pronargs FROM pg_proc WHERE proname = 'license_apply_operation'",
    );
    expect(functions.rows).toEqual([{ pronargs: 13 }]);
    const columns = await db.pglite.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'license_operations' AND column_name = 'request_descriptor'",
    );
    expect(columns.rows).toEqual([]);
    await db.pglite.exec(transition);
    const migrated = await db.pglite.query<{ pronargs: number }>(
      "SELECT pronargs FROM pg_proc WHERE proname = 'license_apply_operation'",
    );
    expect(migrated.rows).toEqual([{ pronargs: 14 }]);
  });
  it('recovers immutable promotion evidence without minting and binds declared grant, customer, mode and path', async () => {
    const input = initial();
    const grant = {
      tier: input.tier,
      domains: null,
      maxSites: null,
      maxUsers: null,
      perpetual: true,
      expiresInSeconds: null,
    };
    const promotion = {
      kind: 'initial' as const,
      path: `forge/customers/${input.customerId}/license-key`,
    };
    const descriptor = {
      version: 1 as const,
      operationId: input.operationId,
      customerId: input.customerId,
      mode: input.mode,
      grant,
      effectiveGrant: grant,
      action: 'initial' as const,
      expectedCurrentLicenseKeySha256: null,
      promotion: { ...promotion, expected: { kind: 'absent' as const } },
    };
    const selector = { grant, action: descriptor.action, promotion };
    const lookup = { ...input, requestFingerprint: '' };
    expect(await findLicenseOperation(db.drizzle, lookup, selector)).toBeNull();
    expect(await applyLicenseOperation(db.drizzle, { ...input, descriptor })).toEqual({
      licenseKey: input.licenseKey,
      operation: descriptor,
    });
    expect(await findLicenseOperation(db.drizzle, lookup, selector)).toEqual({
      licenseKey: input.licenseKey,
      operation: descriptor,
    });
    await expect(
      findLicenseOperation(db.drizzle, { ...lookup, mode: 'test' }, selector),
    ).rejects.toThrow();
    await expect(
      findLicenseOperation(db.drizzle, { ...lookup, customerId: randomUUID() }, selector),
    ).rejects.toThrow();
    await expect(
      findLicenseOperation(db.drizzle, lookup, { ...selector, grant: { ...grant, tier: 'pro' } }),
    ).rejects.toThrow();
    await expect(
      findLicenseOperation(db.drizzle, lookup, {
        ...selector,
        promotion: { ...promotion, path: 'revealui/dev/founder-license-key' },
      }),
    ).rejects.toThrow();
    const legacy = initial();
    await applyLicenseOperation(db.drizzle, legacy);
    await expect(
      findLicenseOperation(db.drizzle, { ...legacy, requestFingerprint: '' }, selector),
    ).rejects.toThrow();
    await db.drizzle
      .update(licenses)
      .set({ deletedAt: new Date() })
      .where(eq(licenses.id, input.licenseId));
    await expect(findLicenseOperation(db.drizzle, lookup, selector)).rejects.toThrow();
  });
  it('cannot issue duplicate or previously revoked token identity', async () => {
    const input = initial();
    await applyLicenseOperation(db.drizzle, input);
    const duplicate = { ...initial(), jti: input.jti };
    await expect(applyLicenseOperation(db.drizzle, duplicate)).rejects.toThrow();
    const revoked = initial();
    await db.drizzle.insert(licenseJtiRevocations).values({ jti: revoked.jti });
    await expect(applyLicenseOperation(db.drizzle, revoked)).rejects.toThrow();
    expect(
      await db.drizzle.select().from(licenses).where(eq(licenses.id, duplicate.licenseId)),
    ).toHaveLength(0);
  });
  it('registers explicit perpetual issuance and returns the same receipt on retry', async () => {
    const input = initial();
    expect(await applyLicenseOperation(db.drizzle, input)).toEqual({
      licenseKey: input.licenseKey,
      operation: null,
    });
    expect(await applyLicenseOperation(db.drizzle, { ...input, licenseKey: randomUUID() })).toEqual(
      { licenseKey: input.licenseKey, operation: null },
    );
    const [row] = await db.drizzle.select().from(licenses).where(eq(licenses.id, input.licenseId));
    expect(row).toMatchObject({ licenseKey: input.licenseKey, perpetual: true, expiresAt: null });
    await expect(
      applyLicenseOperation(db.drizzle, { ...input, requestFingerprint: 'changed' }),
    ).rejects.toThrow();
  });
  it('contains the prior identity atomically and denies stale-current replacement', async () => {
    const input = initial();
    await applyLicenseOperation(db.drizzle, input);
    const next = replacement(input);
    await applyLicenseOperation(db.drizzle, next);
    const [revoked] = await db.drizzle
      .select()
      .from(licenseJtiRevocations)
      .where(eq(licenseJtiRevocations.jti, next.priorJti as string));
    expect(revoked.customerId).toBe(input.customerId);
    const stale = replacement(input);
    await expect(applyLicenseOperation(db.drizzle, stale)).rejects.toThrow();
    expect(
      await db.drizzle
        .select()
        .from(licenseOperations)
        .where(eq(licenseOperations.operationId, stale.operationId)),
    ).toHaveLength(0);
    expect(
      await db.drizzle
        .select()
        .from(licenseJtiRevocations)
        .where(eq(licenseJtiRevocations.jti, stale.priorJti as string)),
    ).toHaveLength(0);
    await expect(applyLicenseOperation(db.drizzle, input)).rejects.toThrow();
  });
  it('cannot resurrect revoked/deleted customer lineage or cross customer binding', async () => {
    const input = initial();
    await applyLicenseOperation(db.drizzle, input);
    await db.drizzle
      .update(licenses)
      .set({ status: 'revoked' })
      .where(eq(licenses.id, input.licenseId));
    await expect(applyLicenseOperation(db.drizzle, replacement(input))).rejects.toThrow();
    await expect(
      applyLicenseOperation(db.drizzle, { ...initial(), customerId: input.customerId }),
    ).rejects.toThrow();
    await expect(
      applyLicenseOperation(db.drizzle, { ...replacement(input), customerId: randomUUID() }),
    ).rejects.toThrow();
    await db.drizzle
      .update(licenses)
      .set({ status: 'active', deletedAt: new Date() })
      .where(eq(licenses.id, input.licenseId));
    await expect(applyLicenseOperation(db.drizzle, replacement(input))).rejects.toThrow();
  });
  it('separates test/live issuance and rejects operation reuse across modes', async () => {
    const input = initial();
    await applyLicenseOperation(db.drizzle, input);
    const test = { ...initial(), customerId: input.customerId, mode: 'test' as const };
    await applyLicenseOperation(db.drizzle, test);
    const [row] = await db.drizzle.select().from(licenses).where(eq(licenses.id, test.licenseId));
    expect(row.mode).toBe('test');
    await expect(applyLicenseOperation(db.drizzle, { ...input, mode: 'test' })).rejects.toThrow();
  });
  it('rolls back containment when replacement persistence fails', async () => {
    const input = initial();
    await applyLicenseOperation(db.drizzle, input);
    const next = replacement(input);
    // A synthetic DB trigger fails after the prior JTI insert inside the function.
    await db.pglite.exec(
      `CREATE FUNCTION deny_license_update_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_update_failure'; END; $$; CREATE TRIGGER deny_license_update_test BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE FUNCTION deny_license_update_test();`,
    );
    try {
      await expect(applyLicenseOperation(db.drizzle, next)).rejects.toThrow();
    } finally {
      await db.pglite.exec(
        'DROP TRIGGER deny_license_update_test ON licenses; DROP FUNCTION deny_license_update_test();',
      );
    }
    expect(
      await db.drizzle
        .select()
        .from(licenseJtiRevocations)
        .where(eq(licenseJtiRevocations.jti, next.priorJti as string)),
    ).toHaveLength(0);
    const [row] = await db.drizzle.select().from(licenses).where(eq(licenses.id, input.licenseId));
    expect(row.licenseKey).toBe(input.licenseKey);
  });
});
