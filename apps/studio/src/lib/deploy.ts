import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { VercelDeployment, VercelProject } from '../types';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ── Vercel ─────────────────────────────────────────────────────────────────

export async function vercelValidateToken(token: string): Promise<VercelProject[]> {
  if (!isTauri()) return [];
  return tauriInvoke<VercelProject[]>('vercel_validate_token', { token });
}

export async function vercelValidateBlobToken(token: string): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('vercel_validate_blob_token', { token });
}

export async function vercelCreateProject(
  token: string,
  name: string,
  framework: string,
  rootDirectory?: string,
): Promise<VercelProject> {
  if (!isTauri()) return { id: `mock-${name}`, name, framework, accountId: 'mock-team' };
  return tauriInvoke<VercelProject>('vercel_create_project', {
    token,
    name,
    framework,
    rootDirectory: rootDirectory ?? null,
  });
}

export async function vercelSetEnv(
  token: string,
  projectId: string,
  key: string,
  value: string,
  target: string[] = ['production', 'preview', 'development'],
): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke<void>('vercel_set_env', { token, projectId, key, value, target });
}

export async function vercelDeploy(token: string, projectId: string): Promise<string> {
  if (!isTauri()) return 'mock-deploy-id';
  return tauriInvoke<string>('vercel_deploy', { token, projectId });
}

export async function vercelGetDeployment(
  token: string,
  deploymentId: string,
): Promise<VercelDeployment> {
  if (!isTauri()) {
    return { uid: deploymentId, url: 'mock.vercel.app', state: 'READY', created: Date.now() };
  }
  return tauriInvoke<VercelDeployment>('vercel_get_deployment', { token, deploymentId });
}

// ── Database ───────────────────────────────────────────────────────────────

export async function neonTestConnection(connectionString: string): Promise<string> {
  if (!isTauri()) return 'NOW() = 2026-03-15 (mock)';
  return tauriInvoke<string>('neon_test_connection', { connectionString });
}

export async function runDbMigrate(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Migrations complete (mock)';
  return tauriInvoke<string>('run_db_migrate', { repoPath });
}

export async function runDbSeed(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Seed complete (mock)';
  return tauriInvoke<string>('run_db_seed', { repoPath });
}

// ── Stripe ─────────────────────────────────────────────────────────────────

export async function stripeValidateKeys(secretKey: string): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('stripe_validate_keys', { secretKey });
}

export async function stripeRunSeed(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Stripe seed complete (mock)';
  return tauriInvoke<string>('stripe_run_seed', { repoPath });
}

export async function stripeRunKeys(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Keys generated (mock)';
  return tauriInvoke<string>('stripe_run_keys', { repoPath });
}

export async function stripeCatalogSync(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Catalog synced (mock)';
  return tauriInvoke<string>('stripe_catalog_sync', { repoPath });
}

// ── Email ──────────────────────────────────────────────────────────────────

export async function gmailSendTest(
  serviceAccountEmail: string,
  privateKey: string,
  fromEmail: string,
  toEmail: string,
): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('gmail_send_test', {
    serviceAccountEmail,
    privateKey,
    fromEmail,
    toEmail,
  });
}

export async function resendSendTest(apiKey: string, toEmail: string): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('resend_send_test', { apiKey, toEmail });
}

export async function smtpSendTest(
  host: string,
  port: number,
  user: string,
  pass: string,
  toEmail: string,
): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('smtp_send_test', { host, port, user, pass, toEmail });
}

// ── Secrets ────────────────────────────────────────────────────────────────

export async function generateSecret(length: number): Promise<string> {
  if (!isTauri()) return 'x'.repeat(length);
  return tauriInvoke<string>('generate_secret', { length });
}

export async function generateKek(): Promise<string> {
  if (!isTauri()) return 'a'.repeat(64);
  return tauriInvoke<string>('generate_kek');
}

export async function generateRsaKeypair(): Promise<[string, string]> {
  if (!isTauri()) return ['MOCK_PRIVATE_KEY_PEM', 'MOCK_PUBLIC_KEY_PEM'];
  return tauriInvoke<[string, string]>('generate_rsa_keypair');
}

// ── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck(url: string): Promise<number> {
  if (!isTauri()) return 200;
  return tauriInvoke<number>('health_check', { url });
}
