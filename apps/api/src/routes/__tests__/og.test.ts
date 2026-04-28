import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must come before the route import. vi.hoisted lets the mock
// factories below close over these refs (vi.mock is hoisted above plain
// const declarations otherwise, causing TDZ errors).
// ---------------------------------------------------------------------------

const { mockSatori, mockRender, mockInitWasm } = vi.hoisted(() => ({
  mockSatori: vi.fn(),
  mockRender: vi.fn(),
  mockInitWasm: vi.fn(),
}));

vi.mock('satori', () => ({ default: mockSatori }));

vi.mock('@resvg/resvg-wasm', () => ({
  initWasm: mockInitWasm,
  // Resvg is `new`'d, so the mock must be a real constructor (arrow functions
  // can't be called with `new`).
  Resvg: class {
    render() {
      return mockRender();
    }
  },
}));

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({
  default: new Uint8Array([0x00, 0x61, 0x73, 0x6d]), // wasm magic bytes
}));

vi.mock('../../assets/fonts/Geist-Regular.ttf', () => ({
  default: new Uint8Array([0x00, 0x01, 0x00, 0x00]), // ttf magic bytes
}));

vi.mock('../../assets/fonts/Geist-Bold.ttf', () => ({
  default: new Uint8Array([0x00, 0x01, 0x00, 0x00]),
}));

import ogApp from '../og.js';

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function createApp() {
  const app = new Hono();
  app.route('/', ogApp);
  return app;
}

describe('GET /og', () => {
  beforeEach(() => {
    mockSatori.mockReset();
    mockRender.mockReset();
    mockInitWasm.mockReset();
    mockSatori.mockResolvedValue('<svg width="1200" height="630"></svg>');
    mockRender.mockReturnValue({ asPng: () => PNG_MAGIC });
    mockInitWasm.mockResolvedValue(undefined);
  });

  it('returns 200 image/png with default content when no query params given', async () => {
    const app = createApp();
    const res = await app.request('/');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');

    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(PNG_MAGIC);

    expect(mockSatori).toHaveBeenCalledOnce();
    const [node, options] = mockSatori.mock.calls[0]!;
    expect(options.width).toBe(1200);
    expect(options.height).toBe(630);
    expect(options.fonts).toHaveLength(2);

    // Default title + description should be embedded somewhere in the tree.
    const tree = JSON.stringify(node);
    expect(tree).toContain('RevealUI');
    expect(tree).toContain('Build a business');
  });

  it('uses query params for title + description when provided', async () => {
    const app = createApp();
    const res = await app.request('/?title=Custom%20Headline&description=A%20unique%20OG%20line');

    expect(res.status).toBe(200);
    const tree = JSON.stringify(mockSatori.mock.calls[0]?.[0]);
    expect(tree).toContain('Custom Headline');
    expect(tree).toContain('A unique OG line');
  });

  it('truncates absurdly long titles with an ellipsis to keep the layout sane', async () => {
    const longTitle = 'x'.repeat(500);
    const app = createApp();
    await app.request(`/?title=${longTitle}`);

    const tree = JSON.stringify(mockSatori.mock.calls[0]?.[0]);
    // Original 500-char string must not appear verbatim; truncation marker must.
    expect(tree).not.toContain('x'.repeat(500));
    expect(tree).toContain('…');
  });

  it('emits cache headers so social-media crawlers + CDNs can serve repeats', async () => {
    const app = createApp();
    const res = await app.request('/');
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).toContain('max-age=86400');
    expect(cc).toContain('s-maxage=86400');
    expect(cc).toContain('immutable');
  });

  it('returns 500 when satori throws (e.g. font corruption)', async () => {
    mockSatori.mockRejectedValueOnce(new Error('satori boom'));
    const app = createApp();
    const res = await app.request('/');
    // Hono's default error handler maps unhandled throws to 500.
    expect(res.status).toBe(500);
  });
});
