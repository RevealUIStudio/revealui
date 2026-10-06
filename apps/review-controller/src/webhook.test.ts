import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyGitHubWebhook } from './webhook.js';

const secret = 'a'.repeat(40);
const payload = JSON.stringify({
  action: 'synchronize',
  repository: { id: 1234, full_name: 'RevealUIStudio/revealui' },
  installation: { id: 9876 },
  pull_request: { number: 3054 },
});

function input(overrides: Partial<Parameters<typeof verifyGitHubWebhook>[0]> = {}) {
  return {
    secret,
    rawBody: payload,
    signature: `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`,
    deliveryId: '123e4567-e89b-12d3-a456-426614174000',
    event: 'pull_request',
    now: new Date('2026-10-06T12:00:00.000Z'),
    ...overrides,
  };
}

describe('verifyGitHubWebhook', () => {
  it('authenticates raw bytes and returns a bounded PR delivery', () => {
    expect(verifyGitHubWebhook(input())).toMatchObject({
      ok: true,
      webhook: {
        event: 'pull_request',
        deliveryId: '123e4567-e89b-12d3-a456-426614174000',
        receivedAt: '2026-10-06T12:00:00.000Z',
      },
    });
  });

  it.each([
    ['wrong signature', { signature: `sha256=${'0'.repeat(64)}` }, 'bad_signature'],
    ['missing secret', { secret: '' }, 'missing_secret'],
    ['malformed delivery', { deliveryId: 'not a delivery id' }, 'invalid_delivery'],
    ['unsupported event', { event: 'issues' }, 'unsupported_event'],
    [
      'invalid JSON',
      {
        rawBody: '{',
        signature: `sha256=${createHmac('sha256', secret).update('{').digest('hex')}`,
      },
      'invalid_json',
    ],
    [
      'invalid PR reference',
      {
        rawBody: JSON.stringify({
          repository: { id: 1, full_name: 'org/repo' },
          pull_request: { number: 0 },
          action: 'opened',
        }),
        signature: `sha256=${createHmac('sha256', secret)
          .update(
            JSON.stringify({
              repository: { id: 1, full_name: 'org/repo' },
              pull_request: { number: 0 },
              action: 'opened',
            }),
          )
          .digest('hex')}`,
      },
      'invalid_payload',
    ],
  ] as const)('rejects %s before queueing', (_case, overrides, reason) => {
    expect(verifyGitHubWebhook(input(overrides))).toMatchObject({ ok: false, reason });
  });
});
