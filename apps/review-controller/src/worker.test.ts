import { describe, expect, it, vi } from 'vitest';
import type { ClaimedWebhook, WebhookInbox } from './inbox.js';
import { processNextWebhook } from './worker.js';

const claimed: ClaimedWebhook = {
  deliveryId: '00000000-0000-4000-8000-000000000001',
  eventName: 'pull_request',
  installationId: 456,
  repositoryId: 123,
  receivedAt: new Date('2026-10-06T12:00:00.000Z'),
  payload: {},
  attempts: 2,
  leaseToken: '11111111-1111-4111-8111-111111111111',
};

function inboxFixture() {
  return {
    claimNext: vi.fn(async () => claimed),
    complete: vi.fn(async () => true),
    retry: vi.fn(async () => true),
  } satisfies Pick<WebhookInbox, 'claimNext' | 'complete' | 'retry'>;
}

describe('webhook inbox worker', () => {
  it('completes a delivery only after the handler succeeds', async () => {
    const inbox = inboxFixture();
    const process = vi.fn(async () => undefined);
    const result = await processNextWebhook({
      inbox,
      handler: { process },
      createLeaseToken: () => '22222222-2222-4222-8222-222222222222',
    });
    expect(result).toBe('completed');
    expect(inbox.complete).toHaveBeenCalledWith(
      claimed.deliveryId,
      '22222222-2222-4222-8222-222222222222',
    );
    expect(inbox.retry).not.toHaveBeenCalled();
  });

  it('stores a bounded retry time and a fixed error code without exposing exception details', async () => {
    const inbox = inboxFixture();
    const process = vi.fn(async () => {
      throw new Error('token=secret database detail');
    });
    const result = await processNextWebhook({
      inbox,
      handler: { process },
      createLeaseToken: () => '22222222-2222-4222-8222-222222222222',
      now: () => new Date('2026-10-06T12:00:00.000Z'),
    });
    expect(result).toBe('retry-scheduled');
    expect(inbox.retry).toHaveBeenCalledWith(
      claimed.deliveryId,
      '22222222-2222-4222-8222-222222222222',
      'handler_error',
      new Date('2026-10-06T12:00:10.000Z'),
    );
  });

  it('reports lease loss instead of acknowledging work claimed by another worker', async () => {
    const inbox = inboxFixture();
    inbox.complete.mockResolvedValueOnce(false);
    const result = await processNextWebhook({
      inbox,
      handler: { process: vi.fn(async () => undefined) },
      createLeaseToken: () => '22222222-2222-4222-8222-222222222222',
    });
    expect(result).toBe('lease-lost');
  });

  it('stops retrying at the terminal attempt', async () => {
    const inbox = inboxFixture();
    inbox.claimNext.mockResolvedValueOnce({ ...claimed, attempts: 12 });
    const result = await processNextWebhook({
      inbox,
      handler: {
        process: vi.fn(async () => {
          throw new Error('failure');
        }),
      },
      createLeaseToken: () => '22222222-2222-4222-8222-222222222222',
      now: () => new Date('2026-10-06T12:00:00.000Z'),
    });
    expect(result).toBe('terminal-failure');
    const retryTime = vi.mocked(inbox.retry).mock.calls[0]?.[3];
    expect(retryTime?.getTime()).toBeLessThanOrEqual(
      new Date('2026-10-06T13:00:00.000Z').getTime(),
    );
  });

  it('keeps receipt-expiration failures retrying beyond the webhook attempt limit', async () => {
    const inbox = inboxFixture();
    inbox.claimNext.mockResolvedValueOnce({
      ...claimed,
      eventName: 'receipt_expiration',
      attempts: 12,
    });
    const result = await processNextWebhook({
      inbox,
      handler: {
        process: vi.fn(async () => {
          throw new Error('temporary GitHub outage');
        }),
      },
      createLeaseToken: () => '22222222-2222-4222-8222-222222222222',
      now: () => new Date('2026-10-06T12:00:00.000Z'),
    });
    expect(result).toBe('retry-scheduled');
    expect(inbox.retry).toHaveBeenCalledWith(
      claimed.deliveryId,
      '22222222-2222-4222-8222-222222222222',
      'handler_error',
      new Date('2026-10-06T13:00:00.000Z'),
    );
  });
});
