import { getStudioFulfillmentConfig } from '@revealui/config';
import { crmSourceBooking } from '@revealui/db/crm-contracts';

/** Existing Studio owner credential stays server-side; redirects and malformed evidence fail closed. */
export async function readCrmBookingSource(bookingId: string, fetchImpl: typeof fetch = fetch) {
  const config = getStudioFulfillmentConfig(process.env);
  if (!config) throw new Error('Studio booking source is not configured');
  const url = new URL('/api/consultation/crm', config.origin);
  url.searchParams.set('booking', bookingId);
  const response = await fetchImpl(url, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${config.ownerSession}` },
  });
  if (!response.ok) throw new Error('Studio booking source unavailable');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Studio booking evidence is empty');
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 32768) {
        await reader.cancel().catch(() => {});
        throw new Error('Studio booking evidence exceeds limit');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const snapshot = crmSourceBooking.parse(JSON.parse(text));
  if (snapshot.bookingId !== bookingId) throw new Error('Studio booking identity mismatch');
  return { snapshot, sourceUrl: url.toString() };
}

