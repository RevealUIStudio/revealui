import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyLicenseOperation, type LicenseOperationInput } from '../license-operations.js';
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
    expect(await applyLicenseOperation(db.drizzle, input)).toBe(input.licenseKey);
    expect(await applyLicenseOperation(db.drizzle, { ...input, licenseKey: randomUUID() })).toBe(
      input.licenseKey,
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
