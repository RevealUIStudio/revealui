import { createPrivateKey } from 'node:crypto';

export interface ReceiptPolicy {
  repositoryFullName: string;
  keyId: string;
  privateKey: string;
  version: string;
  maxLifetimeMs: number;
  requiredChecks: Array<{ name: string; appId: number }>;
}

/** Missing mode keeps the receipt evaluator disabled; partial opt-in fails closed. */
export function readReceiptPolicy(env: NodeJS.ProcessEnv): ReceiptPolicy | undefined {
  const mode = env.REVIEW_RECEIPT_MODE?.trim();
  if (!mode) {
    if (Object.keys(env).some((name) => name.startsWith('REVIEW_RECEIPT_') && env[name]?.trim()))
      throw new Error('REVIEW_RECEIPT_MODE is required when receipt settings are present');
    return undefined;
  }
  if (mode !== 'shadow') throw new Error('REVIEW_RECEIPT_MODE must be shadow');

  const keyId = required(env, 'REVIEW_RECEIPT_KEY_ID');
  if (keyId.length > 128) throw new Error('REVIEW_RECEIPT_KEY_ID exceeds size limit');
  const repositoryFullName = required(env, 'GITHUB_REPOSITORY_FULL_NAME');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryFullName))
    throw new Error('GITHUB_REPOSITORY_FULL_NAME must be owner/repository');
  const privateKey = required(env, 'REVIEW_RECEIPT_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (Buffer.byteLength(privateKey, 'utf8') > 16 * 1024)
    throw new Error('REVIEW_RECEIPT_PRIVATE_KEY exceeds size limit');
  try {
    if (createPrivateKey(privateKey).asymmetricKeyType !== 'ed25519')
      throw new Error('wrong key type');
  } catch {
    throw new Error('REVIEW_RECEIPT_PRIVATE_KEY must be an Ed25519 private key');
  }
  const version = required(env, 'REVIEW_RECEIPT_POLICY_VERSION');
  if (version.length > 128) throw new Error('REVIEW_RECEIPT_POLICY_VERSION exceeds size limit');
  const maxLifetimeMs = Number(required(env, 'REVIEW_RECEIPT_MAX_LIFETIME_MS'));
  if (!Number.isSafeInteger(maxLifetimeMs) || maxLifetimeMs < 60_000 || maxLifetimeMs > 86_400_000)
    throw new Error('REVIEW_RECEIPT_MAX_LIFETIME_MS must be between 60000 and 86400000');

  const rawChecks = required(env, 'REVIEW_RECEIPT_REQUIRED_CHECKS');
  if (Buffer.byteLength(rawChecks, 'utf8') > 16 * 1024)
    throw new Error('REVIEW_RECEIPT_REQUIRED_CHECKS exceeds size limit');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawChecks);
  } catch {
    throw new Error('REVIEW_RECEIPT_REQUIRED_CHECKS must be valid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 64)
    throw new Error('REVIEW_RECEIPT_REQUIRED_CHECKS must contain 1 to 64 entries');
  const requiredChecks = parsed.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.name !== 'string' ||
      item.name.trim().length === 0 ||
      item.name.length > 200 ||
      item.name !== item.name.trim() ||
      !Number.isSafeInteger(item.appId) ||
      Number(item.appId) <= 0
    )
      throw new Error('REVIEW_RECEIPT_REQUIRED_CHECKS contains an invalid selector');
    return { name: item.name, appId: Number(item.appId) };
  });
  const selectorKeys = requiredChecks.map((check) => `${check.appId}:${check.name}`);
  if (new Set(selectorKeys).size !== selectorKeys.length)
    throw new Error('REVIEW_RECEIPT_REQUIRED_CHECKS contains duplicate selectors');

  return { repositoryFullName, keyId, privateKey, version, maxLifetimeMs, requiredChecks };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim() ?? '';
  if (!value) throw new Error(`${name} is required when REVIEW_RECEIPT_MODE=shadow`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
