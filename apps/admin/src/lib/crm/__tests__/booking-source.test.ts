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
