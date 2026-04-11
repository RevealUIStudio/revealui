import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPasswordBreach } from '../password-validation.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkPasswordBreach', () => {
  it('returns breach count when password is found in HIBP database', async () => {
    // The HIBP API returns hash suffixes matching the 5-char prefix.
    // We include the known suffix for "password" in the mock response.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          '1D2DA4053E34E76F6576ED1DA63134B5E2A:2\r\n' +
            '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n' +
            '1F2B668E8AABEF1C59E9EC6F82E3F3CD786:1\r\n',
        ),
    });

    const count = await checkPasswordBreach('password');
    expect(count).toBe(9545824);
    expect(mockFetch).toHaveBeenCalledOnce();

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('api.pwnedpasswords.com/range/5BAA6');
  });

  it('returns 0 when password is not found in breach database', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          '0000000000000000000000000000000000A:1\r\n' + '0000000000000000000000000000000000B:2\r\n',
        ),
    });

    const count = await checkPasswordBreach('my-super-unique-passphrase-2026!');
    expect(count).toBe(0);
  });

  it('returns -1 on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const count = await checkPasswordBreach('testpassword');
    expect(count).toBe(-1);
  });

  it('returns -1 on non-200 API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const count = await checkPasswordBreach('testpassword');
    expect(count).toBe(-1);
  });

  it('sends Add-Padding header for enhanced privacy', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
    });

    await checkPasswordBreach('testpassword');

    const options = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect((options.headers as Record<string, string>)['Add-Padding']).toBe('true');
  });
});
