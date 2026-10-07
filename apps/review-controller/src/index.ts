import { serve } from '@hono/node-server';
import { createReviewControllerDatabase } from '@revealui/db/review-controller';
import { createReviewControllerApp } from './app.js';
import { ShadowWebhookHandler } from './event-handler.js';
import { GitHubAppClient } from './github-app.js';
import { PostgresWebhookInbox } from './inbox.js';
import { PostgresShadowObservationStore } from './observations.js';
import { readReceiptPolicy } from './receipt-policy.js';
import { PostgresSignedReceiptStore } from './receipt-store.js';
import { runWebhookWorker } from './worker.js';

function required(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function boot(): Promise<void> {
  if (required('GITHUB_WEBHOOK_SECRET').length < 32)
    throw new Error('GITHUB_WEBHOOK_SECRET must contain at least 32 characters');
  const repositoryId = Number(required('GITHUB_REPOSITORY_ID'));
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0)
    throw new Error('GITHUB_REPOSITORY_ID must be a positive integer');
  const installationId = Number(required('GITHUB_INSTALLATION_ID'));
  if (!Number.isSafeInteger(installationId) || installationId <= 0)
    throw new Error('GITHUB_INSTALLATION_ID must be a positive integer');
  const appId = Number(required('GITHUB_APP_ID'));
  if (!Number.isSafeInteger(appId) || appId <= 0)
    throw new Error('GITHUB_APP_ID must be a positive integer');
  const repositoryFullName = required('GITHUB_REPOSITORY_FULL_NAME');
  const receiptPolicy = readReceiptPolicy(process.env);
  if (receiptPolicy && receiptPolicy.repositoryFullName !== repositoryFullName)
    throw new Error('receipt policy repository does not match controller repository');
  const privateKey = required('GITHUB_APP_PRIVATE_KEY');
  const database = createReviewControllerDatabase(required('DATABASE_URL'));
  const inbox = new PostgresWebhookInbox(database.db);
  await inbox.ready();
  const port = Number(process.env.PORT ?? '8080');
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535)
    throw new Error('PORT must be a valid TCP port');
  const app = createReviewControllerApp({ inbox });
  const github = new GitHubAppClient({
    appId,
    installationId,
    repositoryId,
    repositoryFullName,
    privateKey,
  });
  const observations = new PostgresShadowObservationStore(database.db);
  const receipts = new PostgresSignedReceiptStore(database.db);
  await receipts.ready();
  if (receiptPolicy?.mode === 'publish') {
    const latestReceipts = await receipts.listLatest(repositoryId);
    for (const receipt of latestReceipts) {
      await inbox.scheduleReceiptExpiration({
        ...receipt,
        installationId,
      });
    }
  }
  const abortController = new AbortController();
  const server = serve({ fetch: app.fetch, port }, (info) => {
    process.stdout.write(`review-controller listening on :${info.port}\n`);
  });
  const stop = () => {
    abortController.abort();
    server.close();
  };
  const closed = new Promise<void>((resolve) => server.once('close', resolve));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const worker = runWebhookWorker({
    inbox,
    handler: new ShadowWebhookHandler(github, observations, receiptPolicy, receipts, inbox),
    signal: abortController.signal,
  });
  try {
    await Promise.all([closed, worker]);
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    await database.close();
  }
}

boot().catch((error: unknown) => {
  process.stderr.write(
    `review-controller startup failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = 1;
});
