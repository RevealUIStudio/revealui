// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RevealCollectionConfig } from '../../../../types/index.js';
import { serializeConfig } from '../../utils/serializeConfig.js';
import { AdminDashboard } from '../AdminDashboard.js';

const pages: RevealCollectionConfig = {
  slug: 'pages',
  admin: {
    scope: {
      field: 'siteId',
      resource: 'sites',
      label: 'Site',
      titleField: 'name',
      createFields: [
        { name: 'name', type: 'text', label: 'Site name', required: true },
        { name: 'slug', type: 'text', label: 'Site address', required: true },
      ],
    },
  },
  fields: [{ name: 'title', type: 'text', required: true }],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderDashboard(collections = [pages]) {
  return render(<AdminDashboard config={serializeConfig({ collections })} />);
}

describe('owned site selection through the existing dashboard', () => {
  it('lets a fresh owner create a site, save its first page and read the selected site', async () => {
    const user = userEvent.setup();
    let siteCreated = false;
    let savedPage: Record<string, unknown> | undefined;
    const fetch = vi.fn(async (target: string, init?: RequestInit) => {
      const url = new URL(target, 'https://admin.example');
      if (url.pathname === '/api/collections/sites') {
        if (init?.method === 'POST') {
          expect(JSON.parse(String(init.body))).toEqual({ name: 'My site', slug: 'my-site' });
          siteCreated = true;
          return json({ doc: { id: 'owned', name: 'My site' } });
        }
        return json({
          docs: siteCreated ? [{ id: 'owned', name: 'My site' }] : [],
          totalDocs: siteCreated ? 1 : 0,
          totalPages: 1,
        });
      }
      if (url.pathname === '/api/collections/pages') {
        if (init?.method === 'POST') {
          savedPage = JSON.parse(String(init.body));
          return json({ doc: { id: 'page', ...savedPage } });
        }
        expect(url.searchParams.get('siteId')).toBe('owned');
        return json({
          docs: savedPage ? [{ id: 'page', ...savedPage }] : [],
          totalDocs: savedPage ? 1 : 0,
        });
      }
      throw new Error(`Unexpected fixture request ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetch);
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /pages/i }));
    await user.click(await screen.findByRole('button', { name: 'Create site' }));
    await user.type(screen.getByRole('textbox', { name: /site name/i }), 'My site');
    await user.type(screen.getByRole('textbox', { name: /site address/i }), 'my-site');
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Site' }) as HTMLSelectElement).value).toBe(
        'owned',
      ),
    );
    await user.click(screen.getByRole('button', { name: /Create New/i }));
    await user.type(screen.getByRole('textbox', { name: /title/i }), 'First page');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('First page');
    expect(savedPage).toEqual({ title: 'First page', siteId: 'owned' });
  });

  it('keeps navigation current when site creation finishes after leaving its form', async () => {
    const user = userEvent.setup();
    let finishCreate!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finishCreate = resolve;
    });
    const fetch = vi.fn(async (target: string, init?: RequestInit) => {
      const url = new URL(target, 'https://admin.example');
      if (url.pathname === '/api/collections/sites') {
        if (init?.method === 'POST') return pending;
        return json({ docs: [], totalDocs: 0, totalPages: 1 });
      }
      if (url.pathname === '/api/collections/posts')
        return json({ docs: [{ id: 'post', title: 'Current collection' }], totalDocs: 1 });
      throw new Error(`Unexpected fixture request ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetch);
    renderDashboard([pages, { slug: 'posts', fields: [{ name: 'title', type: 'text' }] }]);
    await user.click(screen.getByRole('button', { name: /pages/i }));
    await user.click(await screen.findByRole('button', { name: 'Create site' }));
    await user.type(screen.getByRole('textbox', { name: /site name/i }), 'Created later');
    await user.type(screen.getByRole('textbox', { name: /site address/i }), 'created-later');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    await user.click(screen.getByRole('button', { name: /posts/i }));
    await screen.findByText('Current collection');
    await act(async () => {
      finishCreate(json({ doc: { id: 'late-site', name: 'Created later' } }));
      await pending;
    });
    await waitFor(() => expect(screen.getByText('Current collection')).toBeDefined());
    expect(screen.queryByRole('combobox', { name: 'Site' })).toBeNull();
    expect(fetch.mock.calls.filter(([target]) => String(target).includes('/sites'))).toHaveLength(
      2,
    );
  });

  it('shows an unavailable inventory with retry instead of claiming there are no sites', async () => {
    const user = userEvent.setup();
    let failed = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (failed) return json({ error: 'Sites unavailable' }, 503);
        return json({ docs: [], totalDocs: 0, totalPages: 0 });
      }),
    );
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /pages/i }));
    await screen.findByRole('alert');
    expect(screen.queryByText(/No sites yet/i)).toBeNull();
    failed = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText(/No sites yet/i);
    expect(screen.queryByRole('button', { name: 'More sites' })).toBeNull();
  });

  it('requires keyboard selection when one returned site is only a partial inventory', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (target: string) => {
      const url = new URL(target, 'https://admin.example');
      if (url.pathname === '/api/collections/sites') {
        const second = url.searchParams.get('offset') === '1';
        return json({
          docs: [
            { id: second ? 'second-owned' : 'owned', name: second ? 'Second site' : 'Owned site' },
          ],
          totalDocs: 2,
          totalPages: 2,
          page: second ? 2 : 1,
          limit: 1,
        });
      }
      expect(url.searchParams.get('siteId')).toBe('owned');
      return json({ docs: [], totalDocs: 0 });
    });
    vi.stubGlobal('fetch', fetch);
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /pages/i }));
    const picker = await screen.findByRole('combobox', { name: 'Site' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Owned site' })).toBeDefined());
    expect((picker as HTMLSelectElement).value).toBe('');
    expect(fetch.mock.calls.filter(([target]) => String(target).includes('/pages'))).toHaveLength(
      0,
    );
    await user.click(screen.getByRole('button', { name: 'More sites' }));
    await screen.findByRole('option', { name: 'Second site' });
    for (let step = 0; step < 8 && document.activeElement !== picker; step++) await user.tab();
    expect(document.activeElement).toBe(picker);
    await user.selectOptions(picker, 'owned');
    await waitFor(() =>
      expect(fetch.mock.calls.some(([target]) => String(target).includes('siteId=owned'))).toBe(
        true,
      ),
    );
  });

  it('keeps a duplicate address actionable and lets the owner correct it', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_target: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          attempts++;
          if (attempts === 1) return json({ message: 'Choose another address.' }, 409);
          return json({ doc: { id: 'owned', name: 'My site' } });
        }
        return json({ docs: [], totalDocs: 0 });
      }),
    );
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /pages/i }));
    await user.click(await screen.findByRole('button', { name: 'Create site' }));
    await user.type(screen.getByRole('textbox', { name: /site name/i }), 'My site');
    await user.type(screen.getByRole('textbox', { name: /site address/i }), 'taken');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Choose another address.');
    await user.clear(screen.getByRole('textbox', { name: /site address/i }));
    await user.type(screen.getByRole('textbox', { name: /site address/i }), 'available');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(attempts).toBe(2));
  });

  it('locks an existing document to its actual site while preserving normal edits', async () => {
    const user = userEvent.setup();
    let updated: Record<string, unknown> | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (target: string, init?: RequestInit) => {
        const url = new URL(target, 'https://admin.example');
        if (url.pathname === '/api/collections/sites')
          return json({
            docs: [
              { id: 'actual', name: 'Actual site' },
              { id: 'other-owned', name: 'Other site' },
            ],
            totalDocs: 2,
            totalPages: 1,
          });
        if (init?.method === 'PATCH') {
          updated = JSON.parse(String(init.body));
          return json({ doc: { id: 'existing', ...updated } });
        }
        return json({
          docs: [{ id: 'existing', siteId: 'actual', title: 'Existing page' }],
          totalDocs: 1,
        });
      }),
    );
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /pages/i }));
    const picker = await screen.findByRole('combobox', { name: 'Site' });
    await screen.findByRole('option', { name: 'Actual site' });
    await user.selectOptions(picker, 'actual');
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const lockedPicker = screen.getByRole('combobox', { name: 'Site' }) as HTMLSelectElement;
    expect(lockedPicker.disabled).toBe(true);
    await user.selectOptions(lockedPicker, 'other-owned');
    expect(lockedPicker.value).toBe('actual');
    await user.clear(screen.getByRole('textbox', { name: /title/i }));
    await user.type(screen.getByRole('textbox', { name: /title/i }), 'Updated page');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updated).toMatchObject({ siteId: 'actual', title: 'Updated page' }));
  });

  it('keeps an unrelated collection on its existing list and save path', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (target: string, init?: RequestInit) => {
      expect(new URL(target, 'https://admin.example').pathname).toBe('/api/collections/posts');
      if (init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ title: 'Post' });
        return json({ doc: { id: 'post', title: 'Post' } });
      }
      return json({ docs: [], totalDocs: 0 });
    });
    vi.stubGlobal('fetch', fetch);
    renderDashboard([{ slug: 'posts', fields: [{ name: 'title', type: 'text', required: true }] }]);
    await user.click(screen.getByRole('button', { name: /posts/i }));
    await user.click(await screen.findByRole('button', { name: /Create New/i }));
    expect(screen.queryByRole('combobox', { name: 'Site' })).toBeNull();
    await user.type(screen.getByRole('textbox', { name: /title/i }), 'Post');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
  });
});
