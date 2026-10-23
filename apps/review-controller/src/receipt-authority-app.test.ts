import { describe, expect, it, vi } from 'vitest';
import { createReviewControllerApp } from './app.js';

const request = {
  schema: 'revealfleet-receipt-authorization-request/v1',
  challenge: 'a'.repeat(64),
  repositoryId: 300,
  pullRequest: 7,
  envelopeSha256: 'b'.repeat(64),
};
const inbox = { ready: async () => undefined, enqueue: async () => ({ inserted: true }) };

describe('read-only receipt authority endpoint', () => {
  it('fails closed when authority is not configured or its database is unavailable', async () => {
    const unavailable = createReviewControllerApp({ inbox });
    expect(
      (
        await unavailable.request('/receipt/authorization', {
          method: 'POST',
          body: JSON.stringify(request),
        })
      ).status,
    ).toBe(503);
    const app = createReviewControllerApp({
      inbox,
      receiptAuthority: {
        repositoryId: 300,
        keyId: 'fixture',
        privateKey: 'unused fixture value',
        store: {
          attest: vi.fn(async () => {
            throw new Error('database unavailable');
          }),
        },
      },
    });
    const response = await app.request('/receipt/authorization', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain('database unavailable');
  });

  it('refuses cross-repository and oversized requests before querying the store', async () => {
    const attest = vi.fn();
    const app = createReviewControllerApp({
      inbox,
      receiptAuthority: {
        repositoryId: 300,
        keyId: 'fixture',
        privateKey: 'unused fixture value',
        store: { attest },
      },
    });
    expect(
      (
        await app.request('/receipt/authorization', {
          method: 'POST',
          body: JSON.stringify({ ...request, repositoryId: 301 }),
        })
      ).status,
    ).toBe(400);
    expect(
      (await app.request('/receipt/authorization', { method: 'POST', body: 'x'.repeat(5000) }))
        .status,
    ).toBe(413);
    expect(attest).not.toHaveBeenCalled();
  });
});
