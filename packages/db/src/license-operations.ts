import { type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';

const HashSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const LicenseOperationGrantSchema = z.strictObject({
  tier: z.enum(['pro', 'max', 'enterprise']),
  domains: z.array(z.string()).nullable(),
  maxSites: z.number().int().positive().nullable(),
  maxUsers: z.number().int().positive().nullable(),
  perpetual: z.boolean(),
  expiresInSeconds: z.number().int().positive().nullable(),
});
export const LicensePromotionIdentitySchema = z.strictObject({
  kind: z.enum(['initial', 'rotation']),
  path: z
    .string()
    .regex(
      /^(?:revealui\/dev\/founder-license-key|forge\/customers\/[a-zA-Z0-9][a-zA-Z0-9._-]*\/license-key)$/,
    ),
});
export const LicensePromotionSchema = LicensePromotionIdentitySchema.extend({
  expected: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('absent') }),
    z.strictObject({ kind: z.literal('sha256'), sha256: HashSchema }),
  ]),
});
export const LicenseOperationDescriptorSchema = z
  .strictObject({
    version: z.literal(1),
    operationId: z.string().uuid(),
    customerId: z.string().min(1),
    mode: z.enum(['live', 'test']),
    grant: LicenseOperationGrantSchema,
    effectiveGrant: LicenseOperationGrantSchema,
    action: z.enum(['initial', 'rotation']),
    expectedCurrentLicenseKeySha256: HashSchema.nullable(),
    promotion: LicensePromotionSchema,
  })
  .superRefine((descriptor, ctx) => {
    if (
      descriptor.action !== descriptor.promotion.kind ||
      (descriptor.action === 'initial'
        ? descriptor.expectedCurrentLicenseKeySha256 !== null ||
          descriptor.promotion.expected.kind !== 'absent'
        : descriptor.expectedCurrentLicenseKeySha256 === null ||
          descriptor.promotion.expected.kind !== 'sha256') ||
      (descriptor.grant.perpetual
        ? descriptor.grant.expiresInSeconds !== null
        : descriptor.grant.expiresInSeconds === null) ||
      descriptor.effectiveGrant.tier !== descriptor.grant.tier ||
      descriptor.effectiveGrant.perpetual !== descriptor.grant.perpetual ||
      descriptor.effectiveGrant.expiresInSeconds !== descriptor.grant.expiresInSeconds ||
      JSON.stringify(descriptor.effectiveGrant.domains) !==
        JSON.stringify(descriptor.grant.domains) ||
      descriptor.effectiveGrant.maxUsers !== descriptor.grant.maxUsers ||
      (descriptor.grant.maxSites !== null
        ? descriptor.effectiveGrant.maxSites !== descriptor.grant.maxSites
        : !descriptor.grant.perpetual || descriptor.grant.tier === 'enterprise'
          ? descriptor.effectiveGrant.maxSites !== null
          : descriptor.effectiveGrant.maxSites === null)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Incoherent license operation descriptor' });
    }
  });
export type LicenseOperationDescriptor = z.infer<typeof LicenseOperationDescriptorSchema>;
export interface LicenseOperationResult {
  licenseKey: string;
  operation: LicenseOperationDescriptor | null;
}

interface LicenseOperationDb {
  select(fields: { license_key: SQL<unknown> }): {
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
  descriptor?: LicenseOperationDescriptor | null;
}

/** Database acknowledgment follows the committed single-statement transaction. */
export async function applyLicenseOperation(
  db: LicenseOperationDb,
  input: LicenseOperationInput,
): Promise<LicenseOperationResult> {
  const result = await db
    .select({ license_key: sql<unknown>`result.license_key` })
    .from(sql`license_apply_operation(
    ${input.operationId}, ${input.requestFingerprint}, ${input.customerId},
    ${input.expectedCurrentLicenseKey}, ${input.priorJti}, ${input.priorExpiresAt?.toISOString() ?? null},
    ${input.licenseId}, ${input.licenseKey}, ${input.tier},
    ${input.expiresAt?.toISOString() ?? null}, ${input.perpetual}, ${input.mode}, ${input.jti},
    ${input.descriptor ? JSON.stringify(input.descriptor) : null}::jsonb
  ) AS result(license_key)`);
  const row = result[0];
  if (typeof row !== 'object' || row === null || !('license_key' in row)) {
    throw new Error('License operation unavailable');
  }
  return parseOperationResult(row.license_key);
}

/** Authenticated callers can recover committed results without contacting the signer. */
export async function findLicenseOperation(
  db: LicenseOperationDb,
  input: Pick<LicenseOperationInput, 'operationId' | 'requestFingerprint' | 'customerId' | 'mode'>,
  selector?: Pick<LicenseOperationDescriptor, 'grant' | 'action'> & {
    promotion: z.infer<typeof LicensePromotionIdentitySchema>;
  },
  descriptor: LicenseOperationDescriptor | null = null,
): Promise<LicenseOperationResult | null> {
  const result = await db
    .select({ license_key: sql<unknown>`result.license_key` })
    .from(sql`license_apply_operation(
    ${input.operationId}, ${input.requestFingerprint}, ${input.customerId},
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${input.mode}, NULL,
    ${selector ? JSON.stringify({ version: 1, recoverOnly: true, ...selector }) : descriptor ? JSON.stringify(descriptor) : null}::jsonb
  ) AS result(license_key)`);
  const row = result[0];
  if (typeof row !== 'object' || row === null || !('license_key' in row)) {
    throw new Error('License operation unavailable');
  }
  const value = row.license_key;
  if (value === null) return null;
  return parseOperationResult(value);
}

function parseOperationResult(value: unknown): LicenseOperationResult {
  const parsed = z
    .strictObject({
      licenseKey: z.string().min(1),
      operation: LicenseOperationDescriptorSchema.nullable(),
    })
    .safeParse(value);
  if (!parsed.success) throw new Error('License operation unavailable');
  return parsed.data;
}
