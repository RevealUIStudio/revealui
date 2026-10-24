import { createHash } from 'node:crypto';
import { types } from 'node:util';

/** Offline structure only. These hashes are not authenticated owner grants,
 * signer attestations or permission to merge. No execution mode exists here. */
export interface MergeIntent {
  schema: 'revealfleet-merge-intent/v1';
  purpose: 'validation-only';
  jobId: string;
  repositoryId: number;
  repository: string;
  pullRequest: number;
  baseRef: string;
  headRef: string;
  baseOid: string;
  headOid: string;
  mergeOid: string;
  treeOid: string;
  parents: readonly string[];
  receiptSha256: string;
  ownerGrantSha256: string;
  receiptExpiresAt: string;
  grantExpiresAt: string;
  authorizationGeneration: number;
  signerKeyId: string;
}

const fields = [
  'schema',
  'purpose',
  'jobId',
  'repositoryId',
  'repository',
  'pullRequest',
  'baseRef',
  'headRef',
  'baseOid',
  'headOid',
  'mergeOid',
  'treeOid',
  'parents',
  'receiptSha256',
  'ownerGrantSha256',
  'receiptExpiresAt',
  'grantExpiresAt',
  'authorizationGeneration',
  'signerKeyId',
].sort();

function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

export function validateMergeIntent(input: unknown, now = new Date()): Readonly<MergeIntent> {
  requireCondition(
    input !== null &&
      typeof input === 'object' &&
      !types.isProxy(input) &&
      Object.getPrototypeOf(input) === Object.prototype,
    'merge_intent_invalid',
  );
  const keys = Reflect.ownKeys(input);
  requireCondition(
    keys.length === fields.length &&
      keys.every((key) => typeof key === 'string' && fields.includes(key)),
    'merge_intent_fields_invalid',
  );
  // Snapshot data descriptors before reading values. Symbols, accessors and
  // proxies are rejected without invoking caller-defined property behavior.
  const record: Record<string, unknown> = Object.create(null);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    requireCondition(descriptor && 'value' in descriptor, 'merge_intent_accessors_invalid');
    record[field] = descriptor.value;
  }
  requireCondition(
    record.schema === 'revealfleet-merge-intent/v1' && record.purpose === 'validation-only',
    'merge_execution_mode_unsupported',
  );
  for (const field of ['jobId', 'receiptSha256', 'ownerGrantSha256'])
    requireCondition(
      typeof record[field] === 'string' && /^[a-f0-9]{64}$/.test(record[field]),
      'merge_digest_invalid',
    );
  for (const field of ['repositoryId', 'pullRequest', 'authorizationGeneration'])
    requireCondition(
      Number.isSafeInteger(record[field]) && Number(record[field]) > 0,
      'merge_scope_invalid',
    );
  requireCondition(
    typeof record.repository === 'string' &&
      record.repository.length <= 201 &&
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(record.repository),
    'merge_repository_invalid',
  );
  for (const field of ['baseRef', 'headRef']) {
    const ref = record[field];
    requireCondition(
      typeof ref === 'string' &&
        ref.length <= 255 &&
        /^refs\/heads\/[A-Za-z0-9_-][A-Za-z0-9_./-]*$/.test(ref) &&
        !ref.includes('..') &&
        !ref.includes('//') &&
        ref.split('/').every((part) => part && !part.endsWith('.') && !part.endsWith('.lock')),
      'merge_ref_invalid',
    );
  }
  requireCondition(record.baseRef !== record.headRef, 'merge_ref_invalid');
  for (const field of ['baseOid', 'headOid', 'mergeOid', 'treeOid'])
    requireCondition(
      typeof record[field] === 'string' && /^[a-f0-9]{40}$/.test(record[field]),
      'merge_oid_invalid',
    );
  const parents = record.parents;
  requireCondition(
    !types.isProxy(parents) &&
      Array.isArray(parents) &&
      Object.getPrototypeOf(parents) === Array.prototype,
    'merge_parents_invalid',
  );
  const parentKeys = Reflect.ownKeys(parents);
  requireCondition(
    parentKeys.length === 3 &&
      parentKeys.every((key) => key === '0' || key === '1' || key === 'length'),
    'merge_parents_invalid',
  );
  const length = Object.getOwnPropertyDescriptor(parents, 'length');
  const first = Object.getOwnPropertyDescriptor(parents, '0');
  const second = Object.getOwnPropertyDescriptor(parents, '1');
  requireCondition(
    length &&
      'value' in length &&
      length.value === 2 &&
      first &&
      'value' in first &&
      second &&
      'value' in second,
    'merge_parents_invalid',
  );
  const firstParent: unknown = first.value;
  const secondParent: unknown = second.value;
  requireCondition(
    firstParent === record.baseOid &&
      secondParent === record.headOid &&
      record.baseOid !== record.headOid &&
      record.mergeOid !== record.baseOid &&
      record.mergeOid !== record.headOid,
    'merge_parents_invalid',
  );
  requireCondition(
    typeof record.signerKeyId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(record.signerKeyId),
    'merge_signer_invalid',
  );
  requireCondition(Number.isFinite(now.getTime()), 'merge_clock_invalid');
  for (const [field, code] of [
    ['receiptExpiresAt', 'merge_receipt_expired'],
    ['grantExpiresAt', 'merge_grant_expired'],
  ] as const) {
    const value = record[field];
    requireCondition(
      typeof value === 'string' &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString() === value &&
        Date.parse(value) > now.getTime(),
      code,
    );
  }
  const validated = record as unknown as MergeIntent;
  return Object.freeze({
    schema: validated.schema,
    purpose: validated.purpose,
    jobId: validated.jobId,
    repositoryId: validated.repositoryId,
    repository: validated.repository,
    pullRequest: validated.pullRequest,
    baseRef: validated.baseRef,
    headRef: validated.headRef,
    baseOid: validated.baseOid,
    headOid: validated.headOid,
    mergeOid: validated.mergeOid,
    treeOid: validated.treeOid,
    parents: Object.freeze([validated.baseOid, validated.headOid]),
    receiptSha256: validated.receiptSha256,
    ownerGrantSha256: validated.ownerGrantSha256,
    receiptExpiresAt: validated.receiptExpiresAt,
    grantExpiresAt: validated.grantExpiresAt,
    authorizationGeneration: validated.authorizationGeneration,
    signerKeyId: validated.signerKeyId,
  });
}

export function canonicalMergeIntent(intent: Readonly<MergeIntent>): string {
  return JSON.stringify(
    Object.fromEntries(fields.map((field) => [field, intent[field as keyof MergeIntent]])),
  );
}

export function mergeIntentSha256(intent: Readonly<MergeIntent>): string {
  return createHash('sha256').update(canonicalMergeIntent(intent)).digest('hex');
}

export function evaluateMergeExecution(input: unknown, now = new Date()) {
  try {
    validateMergeIntent(input, now);
  } catch (error) {
    return {
      allowed: false as const,
      holds: [error instanceof Error ? error.message : 'merge_intent_invalid'],
    };
  }
  return {
    allowed: false as const,
    holds: [
      'merge_execution_disabled',
      'merge_owner_grant_contract_unsupported',
      'merge_signing_custody_unverified',
      'merge_protection_contract_unproven',
      'merge_mutable_pr_eligibility_unsupported',
      'merge_application_time_authority_unsupported',
      'merge_transport_unsupported',
    ],
  };
}
