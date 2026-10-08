/** Provision a dedicated shadow receipt signer without writing its private key to disk. */
import { execFileSync, spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReceiptPolicy } from '../src/receipt-policy.js';

interface ShadowConfig {
  flyApp: string;
  repositoryFullName: string;
  repositoryId: number;
  policyVersion: string;
  maxLifetimeMs: number;
  requiredChecks: unknown[];
}

const configDir = join(dirname(fileURLToPath(import.meta.url)), '../config');

export function makeProvisionPlan(config: ShadowConfig, keyId: string) {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(keyId)) throw new Error('invalid receipt key ID');
  if (!/^[A-Za-z0-9-]+$/.test(config.flyApp)) throw new Error('invalid Fly app name');
  if (!Number.isSafeInteger(config.repositoryId) || config.repositoryId <= 0)
    throw new Error('invalid repository ID');
  const publicPath = join(configDir, 'trusted-keys', `${keyId}.pem`);
  if (existsSync(publicPath)) throw new Error('receipt public key ID already exists');
  const pair = generateKeyPairSync('ed25519');
  const privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const secrets = {
    REVIEW_RECEIPT_MODE: 'shadow',
    REVIEW_RECEIPT_KEY_ID: keyId,
    REVIEW_RECEIPT_PRIVATE_KEY: privatePem,
    REVIEW_RECEIPT_POLICY_VERSION: config.policyVersion,
    REVIEW_RECEIPT_MAX_LIFETIME_MS: String(config.maxLifetimeMs),
    REVIEW_RECEIPT_REQUIRED_CHECKS: JSON.stringify(config.requiredChecks),
  };
  readReceiptPolicy({ ...secrets, GITHUB_REPOSITORY_FULL_NAME: config.repositoryFullName });
  return { app: config.flyApp, publicPath, publicPem, secrets };
}

export function validateLiveWorkflowConfig(config: ShadowConfig, runGitHub = execFileSync): void {
  const fetchApi = (path: string) =>
    JSON.parse(
      runGitHub('gh', ['api', path], {
        encoding: 'utf8',
        timeout: 15_000,
      }) as string,
    ) as Record<string, unknown>;
  const repository = fetchApi(`repos/${config.repositoryFullName}`);
  if (repository.id !== config.repositoryId || repository.full_name !== config.repositoryFullName)
    throw new Error('configured repository identity changed');
  const workflows = new Map<number, string>();
  for (const selector of config.requiredChecks) {
    if (!selector || typeof selector !== 'object' || !('workflowId' in selector)) continue;
    const value = selector as { workflowId: number; workflowPath: string };
    const previous = workflows.get(value.workflowId);
    if (previous && previous !== value.workflowPath)
      throw new Error('workflow ID maps to multiple configured paths');
    workflows.set(value.workflowId, value.workflowPath);
  }
  for (const [id, path] of workflows) {
    const workflow = fetchApi(`repos/${config.repositoryFullName}/actions/workflows/${id}`);
    if (workflow.id !== id || workflow.path !== path || workflow.state !== 'active')
      throw new Error(`configured workflow identity changed: ${id}`);
  }
}

export async function importSecrets(
  app: string,
  secrets: Record<string, string>,
  run = spawn,
): Promise<void> {
  const child = run('fly', ['secrets', 'import', '--app', app], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdout?.resume();
  child.stderr?.resume();
  const outcome = new Promise<void>((resolve, reject) => {
    child.once('error', () => reject(new Error('Fly secret import could not start')));
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Fly secret import failed (exit ${code ?? 'unknown'})`));
    });
  });
  const payload = Object.entries(secrets)
    .map(([name, value]) => `${name}=${value.replace(/\n/g, '\\n')}`)
    .join('\n');
  child.stdin?.end(`${payload}\n`);
  await outcome;
  // Do not relay CLI output: future CLI versions may echo secret values.
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--key-id')
    throw new Error('usage: pnpm provision:shadow --key-id <unique-key-id>');
  const config = JSON.parse(
    readFileSync(join(configDir, 'shadow-policy.json'), 'utf8'),
  ) as ShadowConfig;
  const plan = makeProvisionPlan(config, args[1] ?? '');
  validateLiveWorkflowConfig(config);
  await importSecrets(plan.app, plan.secrets);
  mkdirSync(dirname(plan.publicPath), { recursive: true });
  writeFileSync(plan.publicPath, plan.publicPem, { flag: 'wx', mode: 0o644 });
  process.stdout.write(`Shadow signer configured in ${plan.app}; public key: ${plan.publicPath}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'provisioning failed'}\n`);
    process.exitCode = 1;
  });
}
