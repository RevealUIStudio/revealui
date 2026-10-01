import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../../../server/src/lib/email.js';
import contact from '../../../../server/src/routes/contact.js';
import { submitContact } from '../api';

vi.mock('../../../../server/src/lib/email.js', () => ({ sendEmail: vi.fn() }));

const inquiry = {
  name: 'Jo',
  email: 'jo@example.com',
  topic: 'general',
  message: 'A question about setup.',
};
afterEach(() => vi.unstubAllGlobals());
describe('marketing inquiry response contract', () => {
  it('sends the supported source and requires endpoint acknowledgment without asserting delivery', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"success":true,"receipt":"received"}'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await submitContact(inquiry)).toBeNull();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body)).source).toBe('marketing');
    fetchMock.mockResolvedValueOnce(new Response('{"success":false}'));
    expect(await submitContact(inquiry)).toContain('could not confirm');
  });
  it('shows server validation text without rendering arbitrary error objects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"error":"Message must be at least 20 characters"}', { status: 400 }),
      )
      .mockResolvedValueOnce(new Response('{"error":{"issues":[]}}', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await submitContact(inquiry)).toBe('Message must be at least 20 characters');
    expect(await submitContact(inquiry)).toContain('Please check your inquiry');
  });
  it('acknowledges a filtered request without treating receipt as inbox delivery', async () => {
    vi.mocked(sendEmail).mockReset();
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) =>
      contact.request('/', init),
    );
    vi.stubGlobal('fetch', fetchMock);
    const payload = { ...inquiry, website: 'https://autofill.example' };
    expect(await submitContact(payload)).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
    const received = await contact.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, source: 'marketing' }),
    });
    expect(await received.json()).toEqual({ success: true, receipt: 'received' });
  });
});
