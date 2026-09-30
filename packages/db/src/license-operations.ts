import { type SQL, sql } from 'drizzle-orm';

interface LicenseOperationDb {
  select(fields: { license_key: SQL<string | null> }): {
    from(source: SQL): PromiseLike<unknown[]>;
  };
}

export interface LicenseOperationInput {
  operationId: string;
  requestFingerprint: string;
  customerId: string;
  expectedCurrentLicenseKey: string | null;
  priorJti: string | null;
  priorExpiresAt: Date | null;
  licenseId: string;
  licenseKey: string;
  jti: string;
  tier: 'pro' | 'max' | 'enterprise';
  expiresAt: Date | null;
  perpetual: boolean;
  mode: 'live' | 'test';
}

/** Database acknowledgment follows the committed single-statement transaction. */
export async function applyLicenseOperation(
  db: LicenseOperationDb,
  input: LicenseOperationInput,
): Promise<string> {
  const result = await db
    .select({ license_key: sql<string | null>`result.license_key` })
    .from(sql`license_apply_operation(
    ${input.operationId}, ${input.requestFingerprint}, ${input.customerId},
    ${input.expectedCurrentLicenseKey}, ${input.priorJti}, ${input.priorExpiresAt?.toISOString() ?? null},
    ${input.licenseId}, ${input.licenseKey}, ${input.tier},
    ${input.expiresAt?.toISOString() ?? null}, ${input.perpetual}, ${input.mode}, ${input.jti}
  ) AS result(license_key)`);
  const row = result[0];
  if (typeof row !== 'object' || row === null || !('license_key' in row)) {
    throw new Error('License operation unavailable');
  }
  const value = row.license_key;
  if (typeof value !== 'string' || !value) throw new Error('License operation unavailable');
  return value;
}

/** Authenticated callers can recover committed results without contacting the signer. */
export async function findLicenseOperation(
  db: LicenseOperationDb,
  input: Pick<LicenseOperationInput, 'operationId' | 'requestFingerprint' | 'customerId' | 'mode'>,
): Promise<string | null> {
  const result = await db
    .select({ license_key: sql<string | null>`result.license_key` })
    .from(sql`license_apply_operation(
    ${input.operationId}, ${input.requestFingerprint}, ${input.customerId},
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${input.mode}
  ) AS result(license_key)`);
  const row = result[0];
  if (typeof row !== 'object' || row === null || !('license_key' in row)) {
    throw new Error('License operation unavailable');
  }
  const value = row.license_key;
  if (value === null) return null;
  if (typeof value !== 'string' || !value) throw new Error('License operation unavailable');
  return value;
}
