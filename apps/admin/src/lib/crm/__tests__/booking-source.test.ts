import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCrmBookingSource } from '../booking-source';

vi.mock('@revealui/config', () => ({
  getStudioFulfillmentConfig: () => ({
    origin: 'https://studio.example.test',
    ownerSession: 'synthetic-owner-token',
  }),
}));
const snapshot = {
  contract: 'studio-crm-booking-v1',
  bookingId: 'existing-booking',
  status: 'paid_scheduled',
  start: '2026-10-20T14:00:00.000Z',
  end: '2026-10-20T17:00:00.000Z',
  hours: 3,
  name: 'Example Buyer',
  email: 'buyer@example.test',
  company: null,
  stageB: false,
  stageBFee: 'none',
  stripeSessionId: 'cs_example',
  eventId: 'event',
  refund: null,
};
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockResolvedValue(new Response(JSON.stringify(snapshot), { status: 200 }));
});
describe('authoritative booking adapter', () => {
  it('uses the existing server credential and bounded redirect-rejecting transport', async () => {
    expect(await readCrmBookingSource('existing-booking', fetcher)).toMatchObject({ snapshot });
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        headers: { Authorization: 'Bearer synthetic-owner-token' },
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it('rejects swapped identity, malformed paid evidence and provider failure', async () => {
    for (const body of [
      { ...snapshot, bookingId: 'wrong' },
      { ...snapshot, eventId: null },
      { ...snapshot, hours: 1 },
    ]) {
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body)));
      await expect(readCrmBookingSource('existing-booking', fetcher)).rejects.toThrow();
    }
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 502 }));
    await expect(readCrmBookingSource('existing-booking', fetcher)).rejects.toThrow('unavailable');
  });
  it('cancels oversized streamed evidence before reading the remaining body', async () => {
    const cancel = vi.fn();
    let chunks = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunks += 1;
        if (chunks <= 3) controller.enqueue(new Uint8Array(20000).fill(32));
        else controller.close();
      },
      cancel,
    });
    fetcher.mockResolvedValueOnce(new Response(stream));
    await expect(readCrmBookingSource('existing-booking', fetcher)).rejects.toThrow(
      'exceeds limit',
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });
  it('limits UTF-8 bytes rather than JavaScript characters', async () => {
    const body = JSON.stringify({ ...snapshot, name: 'é'.repeat(17000) });
    expect(body.length).toBeLessThan(32768);
    fetcher.mockResolvedValueOnce(new Response(body));
    await expect(readCrmBookingSource('existing-booking', fetcher)).rejects.toThrow(
      'exceeds limit',
    );
  });
  it('accepts evidence at the exact byte limit', async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(snapshot).padEnd(32768, ' ')));
    expect(await readCrmBookingSource('existing-booking', fetcher)).toMatchObject({ snapshot });
  });
  it('decodes UTF-8 characters split between streamed chunks', async () => {
    const body = new TextEncoder().encode(JSON.stringify({ ...snapshot, name: 'José' }));
    const split = body.indexOf(0xc3) + 1;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(body.slice(0, split));
        controller.enqueue(body.slice(split));
        controller.close();
      },
    });
    fetcher.mockResolvedValueOnce(new Response(stream));
    expect(await readCrmBookingSource('existing-booking', fetcher)).toMatchObject({
      snapshot: { name: 'José' },
    });
  });
  it('enforces the actual byte count despite a smaller Content-Length', async () => {
    fetcher.mockResolvedValueOnce(
      new Response(' '.repeat(32769), { headers: { 'Content-Length': '1' } }),
    );
    await expect(readCrmBookingSource('existing-booking', fetcher)).rejects.toThrow(
      'exceeds limit',
    );
  });
  it('releases the reader when the source stream fails', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('source read failed'));
      },
    });
    fetcher.mockResolvedValueOnce(new Response(stream));
    await expect(readCrmBookingSource('existing-booking', fetcher)).rejects.toThrow(
      'source read failed',
    );
    expect(stream.locked).toBe(false);
  });
  it('preserves cancellation failure without masking the size-limit error', async () => {
    const cause = new Error('cancellation failed');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32769));
      },
      cancel() {
        throw cause;
      },
    });
    fetcher.mockResolvedValueOnce(new Response(stream));
    await expect(readCrmBookingSource('existing-booking', fetcher)).rejects.toMatchObject({
      message: 'Studio booking evidence exceeds limit',
      cause,
    });
    expect(stream.locked).toBe(false);
  });
  it('accepts only explicit authenticated source absence as missing, never a 404 error', async () => {
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          contract: 'studio-crm-booking-v1',
          bookingId: 'existing-booking',
          status: 'missing',
        }),
      ),
    );
    expect(await readCrmBookingSource('existing-booking', fetcher)).toMatchObject({
      snapshot: { status: 'missing' },
    });
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    await expect(readCrmBookingSource('existing-booking', fetcher)).rejects.toThrow();
  });
});
