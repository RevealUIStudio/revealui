import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  pages: vi.fn(),
  actor: vi.fn(),
  site: vi.fn(),
  list: vi.fn(),
  count: vi.fn(),
  headers: vi.fn(),
}));
vi.mock('@/lib/cms/page-reader', () => ({
  getPageReadContext: mocks.context,
  readPageCollection: mocks.pages,
}));
vi.mock('@revealui/db/client', () => ({ getRestClient: () => ({}) }));
vi.mock('@revealui/db/queries/sites', () => ({
  getSiteContentActor: mocks.actor,
  getSiteById: mocks.site,
  getAllSites: mocks.list,
  countSites: mocks.count,
}));
vi.mock('@revealui/core/deployment-mode', () => ({ getExplicitDeploymentMode: () => 'hosted' }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (location: string) => {
    throw new Error(`NEXT_REDIRECT:${location}`);
  },
}));
vi.mock('@/lib/blocks/RenderBlocks', () => ({
  RenderBlocks: ({ blocks }: { blocks: Array<{ data: { content: string } }> }) => (
    <>
      {blocks.map((block) => (
        <p key={block.data.content}>{block.data.content}</p>
      ))}
    </>
  ),
}));

import ClientSharePage from '../app/(frontend)/client-shares/[siteId]/page';
import ClientShareLayout from '../app/(frontend)/client-shares/layout';
import ClientSharesPage from '../app/(frontend)/client-shares/page';

const params = {
  params: Promise.resolve({ siteId: 'delivery' }),
  searchParams: Promise.resolve({}),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    session: { user: { id: 'buyer', role: 'viewer' }, session: { metadata: {} } },
    req: { user: { id: 'buyer' } },
  });
  mocks.actor.mockResolvedValue({ id: 'buyer', role: 'viewer' });
  mocks.headers.mockResolvedValue(
    new Headers({ 'x-revealui-pathname': '/client-shares/delivery' }),
  );
  mocks.site.mockResolvedValue({ id: 'delivery', name: 'Your consultation' });
  mocks.list.mockResolvedValue([{ id: 'delivery', name: 'Your consultation' }]);
  mocks.count.mockResolvedValue(1);
  mocks.pages.mockResolvedValue({
    docs: [
      {
        id: 'page',
        title: 'Completed notes',
        blocks: [
          { id: 'copy', type: 'text', data: { content: 'Delivered content', format: 'plain' } },
        ],
      },
    ],
    hasPrevPage: false,
    hasNextPage: false,
  });
});

describe('authenticated client delivery reader', () => {
  it('uses the maintained sign-in redirect when the server session is absent', async () => {
    mocks.context.mockResolvedValue({ session: null });
    await expect(ClientShareLayout({ children: 'private content' })).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Fclient-shares%2Fdelivery',
    );
    await expect(ClientSharePage(params)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.actor).not.toHaveBeenCalled();
    expect(mocks.site).not.toHaveBeenCalled();
    expect(mocks.pages).not.toHaveBeenCalled();
  });

  it('routes restricted sessions to password rotation before rendering a delivery', async () => {
    mocks.context.mockResolvedValue({
      session: { user: { id: 'buyer', mustRotatePassword: true }, session: { metadata: {} } },
    });
    await expect(ClientShareLayout({ children: 'private content' })).rejects.toThrow(
      'NEXT_REDIRECT:/rotate-password?redirect=%2Fclient-shares%2Fdelivery',
    );
    mocks.context.mockResolvedValue({
      session: { user: { id: 'buyer' }, session: { metadata: { recovery: true } } },
    });
    await expect(ClientShareLayout({ children: 'private content' })).rejects.toThrow(
      'NEXT_REDIRECT:/rotate-password?redirect=%2Fclient-shares%2Fdelivery',
    );
  });

  it('lists only the current canonical buyer scope and renders delivery links', async () => {
    render(await ClientSharesPage({ searchParams: Promise.resolve({ page: 'invalid' }) }));
    expect(screen.getByRole('link', { name: 'Your consultation' })).toHaveAttribute(
      'href',
      '/client-shares/delivery',
    );
    expect(mocks.list).toHaveBeenCalledWith(
      {},
      {
        access: { actor: { id: 'buyer', role: 'viewer' }, mode: 'hosted' },
        clientShareBuyerUserId: 'buyer',
        limit: 20,
        offset: 0,
      },
    );
    expect(mocks.count).toHaveBeenCalledWith(
      {},
      {
        access: { actor: { id: 'buyer', role: 'viewer' }, mode: 'hosted' },
        clientShareBuyerUserId: 'buyer',
      },
    );
  });

  it('does not query page content when the delivery binding or buyer membership is denied', async () => {
    mocks.site.mockResolvedValue(null);
    await expect(ClientSharePage(params)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.pages).not.toHaveBeenCalled();
    expect(mocks.site).toHaveBeenCalledWith({}, 'delivery', {
      access: { actor: { id: 'buyer', role: 'viewer' }, mode: 'hosted' },
      clientShareBuyerUserId: 'buyer',
    });
  });

  it('renders published content using the owning reader and block renderer', async () => {
    render(await ClientSharePage(params));
    expect(
      screen.getByRole('heading', { name: 'Your consultation', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completed notes', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Delivered content')).toBeInTheDocument();
    expect(mocks.pages).toHaveBeenCalledWith({
      siteId: 'delivery',
      publishedOnly: true,
      page: 1,
      limit: 20,
    });
  });

  it('does not use a stale session identity after the canonical buyer is disabled', async () => {
    mocks.actor.mockResolvedValue(null);
    await expect(ClientSharesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    await expect(ClientSharePage(params)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.site).not.toHaveBeenCalled();
    expect(mocks.pages).not.toHaveBeenCalled();
  });
});
