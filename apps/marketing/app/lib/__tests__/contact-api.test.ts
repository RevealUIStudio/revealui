import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitContact } from '../api';

const inquiry = {
  name: 'Jo',
  email: 'jo@example.com',
  topic: 'general',
  message: 'A question about setup.',
};
afterEach(() => vi.unstubAllGlobals());
describe('marketing inquiry response contract', () => {
  it('sends the supported source and requires explicit acceptance', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}'));
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
});
