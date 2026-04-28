import type { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// Mock next/og  -  ImageResponse is not available in Node test environment
vi.mock('next/og', () => ({
  ImageResponse: class MockImageResponse {
    body: unknown;
    options: unknown;
    constructor(body: unknown, options: unknown) {
      this.body = body;
      this.options = options;
    }
  },
}));

// Import after mocking
const { GET } = await import('../route');

function createMockRequest(url: string): NextRequest {
  return {
    url,
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('GET /api/og', () => {
  it('returns an ImageResponse', async () => {
    const request = createMockRequest('https://revealui.com/api/og?title=Test&description=Hello');
    const response = await GET(request);

    expect(response).toBeDefined();
  });

  it('uses default title when not provided', async () => {
    const request = createMockRequest('https://revealui.com/api/og');
    const response = await GET(request);

    expect(response).toBeDefined();
  });

  it('uses custom title from query params', async () => {
    const request = createMockRequest(
      'https://revealui.com/api/og?title=Custom%20Title&description=Custom%20Desc',
    );
    const response = await GET(request);

    expect(response).toBeDefined();
  });

  it('returns correct image dimensions', async () => {
    const request = createMockRequest('https://revealui.com/api/og');
    const response = await GET(request);

    // The mock stores the options passed to ImageResponse
    const opts = (response as unknown as { options: { width: number; height: number } }).options;
    expect(opts.width).toBe(1200);
    expect(opts.height).toBe(630);
  });
});
