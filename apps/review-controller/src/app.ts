import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { WebhookInbox } from './inbox.js';
import { MAX_WEBHOOK_BYTES, verifyGitHubWebhook } from './webhook.js';

export function createReviewControllerApp(input: {
  inbox: Pick<WebhookInbox, 'enqueue' | 'ready'>;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
}): Hono {
  const env = input.env ?? process.env;
  const app = new Hono();
  app.get('/health/live', (c) => c.json({ ok: true, service: 'review-controller' }));
  app.get('/health/ready', async (c) => {
    try {
      await input.inbox.ready();
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });
  app.post('/github/webhook', bodyLimit({ maxSize: MAX_WEBHOOK_BYTES }), async (c) => {
    const secret = env.GITHUB_WEBHOOK_SECRET?.trim() ?? '';
    if (secret.length < 32) return c.json({ error: 'controller_misconfigured' }, 503);
    const rawBody = await c.req.text();
    const verified = verifyGitHubWebhook({
      secret,
      rawBody,
      signature: c.req.header('x-hub-signature-256'),
      deliveryId: c.req.header('x-github-delivery'),
      event: c.req.header('x-github-event'),
      ...(input.now ? { now: input.now() } : {}),
    });
    if (!verified.ok) return c.json({ error: 'invalid_webhook', reason: verified.reason }, 401);
    const allowedRepositoryId = Number(env.GITHUB_REPOSITORY_ID);
    const allowedInstallationId = Number(env.GITHUB_INSTALLATION_ID);
    const actualRepositoryId = verified.webhook.repositoryId;
    if (
      !Number.isSafeInteger(allowedRepositoryId) ||
      allowedRepositoryId <= 0 ||
      actualRepositoryId !== allowedRepositoryId ||
      !Number.isSafeInteger(allowedInstallationId) ||
      allowedInstallationId <= 0 ||
      verified.webhook.installationId !== allowedInstallationId
    )
      return c.json({ error: 'repository_not_allowed' }, 403);
    try {
      const queued = await input.inbox.enqueue(verified.webhook);
      return c.json({ accepted: true, duplicate: !queued.inserted }, 202);
    } catch {
      // Do not acknowledge before durable insertion: GitHub retries 5xx deliveries.
      return c.json({ error: 'inbox_unavailable' }, 503);
    }
  });
  return app;
}
