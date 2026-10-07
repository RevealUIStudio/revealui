import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn() }));
vi.mock('@revealui/auth/server', () => ({
  getSession: mocks.session,
  isRecoverySession: (value: { session?: { metadata?: { recovery?: boolean } } }) =>
    value.session?.metadata?.recovery === true,
}));
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: 'reader-test' }),
}));
vi.mock('@/lib/utils/revealui-singleton', () => ({
  getRevealUIInstance: () => Promise.resolve({ find: mocks.find }),
}));

import { readPageCollection } from '../page-reader';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    user: { id: 'buyer-editor', email: 'buyer@example.test', role: 'editor' },
  });
  mocks.find.mockResolvedValue({ docs: [], totalDocs: 0 });
});
it('pins a client delivery read to published pages even for an editor with draft intent', async () => {
  await readPageCollection({
    siteId: 'delivery',
    publishedOnly: true,
    draft: true,
    page: 2,
    limit: 10,
  });
  expect(mocks.find).toHaveBeenCalledWith({
    collection: 'pages',
    req: { user: { id: 'buyer-editor', email: 'buyer@example.test', roles: ['editor'] } },
    draft: false,
    page: 2,
    limit: 10,
    where: { siteId: { equals: 'delivery' }, _status: { equals: 'published' } },
  });
});
it('keeps public pages on the same authenticated collection path', async () => {
  mocks.session.mockResolvedValue(null);
  await readPageCollection({ slug: 'about', limit: 1 });
  expect(mocks.find).toHaveBeenCalledWith({
    collection: 'pages',
    req: {},
    draft: false,
    page: 1,
    limit: 1,
    where: { slug: { equals: 'about' } },
  });
});

it('keeps recovery and password rotation sessions out of authenticated content reads', async () => {
  for (const restricted of [
    { user: { id: 'buyer', role: 'viewer', mustRotatePassword: true }, session: { metadata: {} } },
    { user: { id: 'buyer', role: 'viewer' }, session: { metadata: { recovery: true } } },
  ]) {
    mocks.session.mockResolvedValue(restricted);
    await readPageCollection({ slug: 'private', draft: true });
    expect(mocks.find).toHaveBeenLastCalledWith(expect.objectContaining({ req: {}, draft: false }));
  }
});
