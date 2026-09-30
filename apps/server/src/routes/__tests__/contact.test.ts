import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../lib/email.js';
import contact from '../contact.js';

vi.mock('../../lib/email.js', () => ({ sendEmail: vi.fn() }));
const inquiry = {
  source: 'marketing',
  topic: 'general',
  name: 'Jo',
  email: 'jo@example.com',
  message: 'A question about setup.',
};
function submit(extra: Record<string, unknown> = {}) {
  return contact.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...inquiry, ...extra }),
  });
}
beforeEach(() => vi.mocked(sendEmail).mockReset());
describe('public inquiry delivery', () => {
  it('rejects invalid trimmed inputs with useful text before sending', async () => {
    const shortName = await submit({ name: ' J ' });
    expect(shortName.status).toBe(400);
    expect(await shortName.json()).toMatchObject({
      success: false,
      error: expect.stringContaining('2 characters'),
    });
    expect((await submit({ message: 'x'.repeat(19) })).status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it('confirms only provider acceptance and preserves the source', async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce(undefined);
    const accepted = await submit();
    expect(await accepted.json()).toEqual({ success: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: '[marketing] general — Jo', replyTo: 'jo@example.com' }),
    );
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('delivery unavailable'));
    const failed = await submit({ source: 'agency' });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ success: false });
  });
  it('silently discards a filled honeypot', async () => {
    const discarded = await submit({ website: 'https://spam.example' });
    expect(discarded.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
