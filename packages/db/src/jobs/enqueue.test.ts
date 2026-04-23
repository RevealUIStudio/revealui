import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ../client/index.js so enqueue()'s internal getClient() returns a
// controlled chainable stub. Must be declared before the dynamic import.
vi.mock('../client/index.js', () => {
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };
  const db = { insert: vi.fn(() => insertChain) };
  return {
    getClient: vi.fn(() => db),
    __db: db,
    __chain: insertChain,
  };
});

// Grab the exposed mocks via a dynamic import so the vi.mock hoisting above
// still applies to enqueue.js.
const clientMod = await import('../client/index.js');
const insertChain = (clientMod as unknown as { __chain: { returning: ReturnType<typeof vi.fn> } })
  .__chain;

const { enqueue, JobPayloadTooLargeError, wakeWorker } = await import('./enqueue.js');

describe('enqueue', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    delete process.env.REVEALUI_JOBS_WAKE_SECRET;
    delete process.env.REVEALUI_INTERNAL_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inserts a new job when idempotency key is fresh', async () => {
    insertChain.returning.mockResolvedValueOnce([{ id: 'my-key' }]);

    const result = await enqueue(
      'test.job',
      { foo: 'bar' },
      { idempotencyKey: 'my-key', skipWake: true },
    );

    expect(result).toEqual({ jobId: 'my-key', deduplicated: false });
  });

  it('returns deduplicated: true when ON CONFLICT swallows the insert', async () => {
    insertChain.returning.mockResolvedValueOnce([]);

    const result = await enqueue(
      'test.job',
      { foo: 'bar' },
      { idempotencyKey: 'duplicate-key', skipWake: true },
    );

    expect(result).toEqual({ jobId: 'duplicate-key', deduplicated: true });
  });

  it('skips wake when a duplicate is detected', async () => {
    insertChain.returning.mockResolvedValueOnce([]);
    process.env.REVEALUI_JOBS_WAKE_SECRET = 'shh';

    await enqueue('test.job', { foo: 'bar' }, { idempotencyKey: 'dupe-no-wake' });

    // A tick for the fire-and-forget .catch() to settle.
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fires wake when a new row is inserted and secret is configured', async () => {
    insertChain.returning.mockResolvedValueOnce([{ id: 'fresh-key' }]);
    process.env.REVEALUI_JOBS_WAKE_SECRET = 'shh';
    process.env.REVEALUI_INTERNAL_BASE_URL = 'http://test-host:9999';

    await enqueue('test.job', { foo: 'bar' }, { idempotencyKey: 'fresh-key' });

    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://test-host:9999/api/jobs/run');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Jobs-Wake-Secret']).toBe('shh');
    expect(init.body).toBe(JSON.stringify({ preferredJobId: 'fresh-key' }));
  });

  it('swallows wake fetch failures so enqueue still resolves', async () => {
    insertChain.returning.mockResolvedValueOnce([{ id: 'ok-despite-wake-error' }]);
    process.env.REVEALUI_JOBS_WAKE_SECRET = 'shh';
    fetchSpy.mockRejectedValueOnce(new Error('network down'));

    await expect(
      enqueue('test.job', { foo: 'bar' }, { idempotencyKey: 'ok-despite-wake-error' }),
    ).resolves.toEqual({ jobId: 'ok-despite-wake-error', deduplicated: false });

    // Give the .catch() a chance to settle before we assert it fired.
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('skips wake entirely when REVEALUI_JOBS_WAKE_SECRET is unset', async () => {
    insertChain.returning.mockResolvedValueOnce([{ id: 'no-secret' }]);

    await enqueue('test.job', { foo: 'bar' }, { idempotencyKey: 'no-secret' });

    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects payloads larger than 1 MB', async () => {
    // Build a payload whose JSON.stringify length exceeds 1 MB.
    const big = 'x'.repeat(1_048_600);
    await expect(
      enqueue('test.job', { big }, { idempotencyKey: 'too-big', skipWake: true }),
    ).rejects.toBeInstanceOf(JobPayloadTooLargeError);
  });
});

describe('wakeWorker', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    delete process.env.REVEALUI_JOBS_WAKE_SECRET;
    delete process.env.REVEALUI_INTERNAL_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a no-op when REVEALUI_JOBS_WAKE_SECRET is unset', async () => {
    await wakeWorker('any-id');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends null preferredJobId when called without an id', async () => {
    process.env.REVEALUI_JOBS_WAKE_SECRET = 'shh';
    fetchSpy.mockResolvedValueOnce({ ok: true });

    await wakeWorker(null);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ preferredJobId: null }));
  });
});
