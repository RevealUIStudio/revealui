import { describe, expect, it, vi } from 'vitest';
import { uploadAgencyKitTarball } from '../kit-stamp-storage.js';

describe('uploadAgencyKitTarball', () => {
  it('puts under kits/{env}/{id}/slug-agency-founding-kit.tar.gz', async () => {
    const put = vi.fn().mockResolvedValue({
      key: 'kits/test/ful-1/buyer-co-agency-founding-kit.tar.gz',
      url: 'https://media.example/kits/test/ful-1/buyer-co-agency-founding-kit.tar.gz',
      size: 99,
      provider: 'mock',
    });
    const result = await uploadAgencyKitTarball({
      fulfillmentId: 'ful-1',
      slug: 'buyer-co',
      livemode: false,
      body: Buffer.from('gzip-bytes'),
      storage: { put, del: vi.fn(), list: vi.fn(), provider: 'mock' },
    });
    expect(put).toHaveBeenCalledWith(
      'kits/test/ful-1/buyer-co-agency-founding-kit.tar.gz',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/gzip' }),
    );
    expect(result.url).toContain('buyer-co-agency-founding-kit.tar.gz');
    expect(result.size).toBe(99);
  });

  it('uses live prefix when livemode', async () => {
    const put = vi.fn().mockResolvedValue({
      key: 'k',
      url: 'https://x/k',
      size: 1,
      provider: 'mock',
    });
    await uploadAgencyKitTarball({
      fulfillmentId: 'ful-2',
      slug: 'acme',
      livemode: true,
      body: Buffer.from('x'),
      storage: { put, del: vi.fn(), list: vi.fn(), provider: 'mock' },
    });
    expect(put.mock.calls[0]?.[0]).toMatch(/^kits\/live\//);
  });
});
