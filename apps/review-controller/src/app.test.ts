import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createReviewControllerApp } from './app.js';
import type { WebhookInbox } from './inbox.js';

const secret = 's'.repeat(40);
const eventBody = JSON.stringify({
  action: 'opened',
  repository: { id: 1234, full_name: 'RevealUIStudio/revealui' },
  installation: { id: 9876 },
  pull_request: { number: 3054 },
});
const headers = {
  'content-type': 'application/json',
  'x-github-event': 'pull_request',
  'x-github-delivery': '123e4567-e89b-12d3-a456-426614174000',
  'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(eventBody).digest('hex')}`,
};

function fixture(repositoryId = '1234') {
  const inbox: WebhookInbox = {
    enqueue: vi.fn(async () => ({ inserted: true })),
    ready: vi.fn(async () => undefined),
  };
  const app = createReviewControllerApp({
    inbox,
    env: {
      GITHUB_WEBHOOK_SECRET: secret,
      GITHUB_REPOSITORY_ID: repositoryId,
      GITHUB_INSTALLATION_ID: '9876',
      GITHUB_APP_ID: '5230487',
    },
    now: () => new Date('2026-10-06T12:00:00.000Z'),
  });
  return { app, inbox };
}

describe('review controller webhook intake', () => {
  it('acknowledges a signed irrelevant check action without queueing it', async () => {
    const { app, inbox } = fixture();
    const body = JSON.stringify({
      action: 'created',
      repository: { id: 1234, full_name: 'RevealUIStudio/revealui' },
      installation: { id: 9876 },
      check_run: { id: 1 },
    });
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers: {
        ...headers,
        'x-github-event': 'check_run',
        'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
      },
      body,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true, ignored: true });
    expect(inbox.enqueue).not.toHaveBeenCalled();
  });

  it('rejects an irrelevant check action from another repository', async () => {
    const { app, inbox } = fixture();
    const body = JSON.stringify({
      action: 'created',
      repository: { id: 9999, full_name: 'other/repo' },
      installation: { id: 9876 },
      check_run: { id: 1 },
    });
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers: {
        ...headers,
        'x-github-event': 'check_run',
        'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
      },
      body,
    });
    expect(response.status).toBe(403);
    expect(inbox.enqueue).not.toHaveBeenCalled();
  });

  it('acknowledges this App installation event without queueing it', async () => {
    const { app, inbox } = fixture();
    const body = JSON.stringify({
      action: 'new_permissions_accepted',
      installation: { id: 9876, app_id: 5230487 },
    });
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers: {
        ...headers,
        'x-github-event': 'installation',
        'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
      },
      body,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true, ignored: true });
    expect(inbox.enqueue).not.toHaveBeenCalled();
  });

  it('acknowledges a signed ping for this App without queueing it', async () => {
    const { app, inbox } = fixture();
    const body = JSON.stringify({ hook_id: 11, hook: { id: 11, type: 'App', app_id: 5230487 } });
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers: {
        ...headers,
        'x-github-event': 'ping',
        'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
      },
      body,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true });
    expect(inbox.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a signed ping for another App', async () => {
    const { app, inbox } = fixture();
    const body = JSON.stringify({ hook_id: 11, hook: { id: 11, type: 'App', app_id: 1 } });
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers: {
        ...headers,
        'x-github-event': 'ping',
        'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
      },
      body,
    });
    expect(response.status).toBe(403);
    expect(inbox.enqueue).not.toHaveBeenCalled();
  });

  it('durably enqueues only authenticated, allowlisted GitHub deliveries', async () => {
    const { app, inbox } = fixture();
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers,
      body: eventBody,
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, duplicate: false });
    expect(inbox.enqueue).toHaveBeenCalledOnce();
  });

  it('does not queue a delivery from another repository', async () => {
    const { app, inbox } = fixture('9876');
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers,
      body: eventBody,
    });
    expect(response.status).toBe(403);
    expect(inbox.enqueue).not.toHaveBeenCalled();
  });

  it('does not queue a delivery from another App installation', async () => {
    const { app, inbox } = fixture();
    const body = JSON.stringify({ ...JSON.parse(eventBody), installation: { id: 1122 } });
    const signedHeaders = {
      ...headers,
      'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
    };
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers: signedHeaders,
      body,
    });
    expect(response.status).toBe(403);
    expect(inbox.enqueue).not.toHaveBeenCalled();
  });

  it('returns 503 when durable inbox insertion fails so GitHub retries', async () => {
    const { app, inbox } = fixture();
    vi.mocked(inbox.enqueue).mockRejectedValueOnce(new Error('database unavailable'));
    const response = await app.request('/github/webhook', {
      method: 'POST',
      headers,
      body: eventBody,
    });
    expect(response.status).toBe(503);
    expect(inbox.enqueue).toHaveBeenCalledOnce();
  });
});
