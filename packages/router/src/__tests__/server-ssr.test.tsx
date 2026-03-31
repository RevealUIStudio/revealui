// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { createSSRHandler } from '../server.js';
import type { Route } from '../types.js';

const HomeComponent = () => 'Home Page';
const AboutComponent = () => 'About Page';

function createRoute(path: string, overrides?: Partial<Route>): Route {
  return { path, component: HomeComponent, ...overrides };
}

function createMockContext(url: string): {
  req: { url: string };
  status: ReturnType<typeof vi.fn>;
  html: ReturnType<typeof vi.fn>;
  header: ReturnType<typeof vi.fn>;
  body: ReturnType<typeof vi.fn>;
} {
  return {
    req: { url },
    status: vi.fn(),
    html: vi.fn((html: string) => new Response(html, { headers: { 'content-type': 'text/html' } })),
    header: vi.fn(),
    body: vi.fn(),
  };
}

describe('createSSRHandler', () => {
  it('returns a function', () => {
    const handler = createSSRHandler([createRoute('/')]);
    expect(typeof handler).toBe('function');
  });

  it('returns 404 for unmatched routes', async () => {
    const handler = createSSRHandler([createRoute('/about')]);
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/nowhere') as any;
    await handler(c);
    expect(c.status).toHaveBeenCalledWith(404);
    expect(c.html).toHaveBeenCalledWith(expect.stringContaining('404'));
  });

  it('renders matched route to HTML', async () => {
    const handler = createSSRHandler([createRoute('/')]);
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/') as any;
    await handler(c);
    expect(c.status).not.toHaveBeenCalledWith(404);
    expect(c.status).not.toHaveBeenCalledWith(500);
    expect(c.html).toHaveBeenCalledWith(expect.stringContaining('Home Page'));
  });

  it('injects __REVEALUI_DATA__ script tag', async () => {
    const handler = createSSRHandler([createRoute('/')]);
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/') as any;
    await handler(c);
    const htmlArg = c.html.mock.calls[0][0] as string;
    expect(htmlArg).toContain('__REVEALUI_DATA__');
  });

  it('uses custom template when provided', async () => {
    const customTemplate = (html: string) => `<custom>${html}</custom>`;
    const handler = createSSRHandler([createRoute('/')], { template: customTemplate });
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/') as any;
    await handler(c);
    const htmlArg = c.html.mock.calls[0][0] as string;
    expect(htmlArg).toMatch(/^<custom>/);
  });

  it('passes route metadata to template', async () => {
    let templateData: Record<string, unknown> | undefined;
    const customTemplate = (_html: string, data?: Record<string, unknown>) => {
      templateData = data;
      return '<html></html>';
    };
    const handler = createSSRHandler([createRoute('/', { meta: { title: 'Home Title' } })], {
      template: customTemplate,
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/') as any;
    await handler(c);
    expect(templateData?.title).toBe('Home Title');
    expect(templateData?.route).toBe('/');
  });

  it('runs loader and includes data in template', async () => {
    let templateData: Record<string, unknown> | undefined;
    const customTemplate = (_html: string, data?: Record<string, unknown>) => {
      templateData = data;
      return '<html></html>';
    };
    const handler = createSSRHandler(
      [
        createRoute('/posts/:id', {
          component: AboutComponent,
          loader: async (params) => ({ title: `Post ${params.id}` }),
        }),
      ],
      { template: customTemplate },
    );
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/posts/5') as any;
    await handler(c);
    expect(templateData?.data).toEqual({ title: 'Post 5' });
    expect(templateData?.params).toEqual({ id: '5' });
  });

  it('returns 500 when loader throws', async () => {
    const handler = createSSRHandler([
      createRoute('/error', {
        loader: async () => {
          throw new Error('Loader failed');
        },
      }),
    ]);
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/error') as any;
    await handler(c);
    expect(c.status).toHaveBeenCalledWith(500);
    expect(c.html).toHaveBeenCalledWith(expect.stringContaining('500'));
  });

  it('calls onError callback when loader throws', async () => {
    const onError = vi.fn();
    const handler = createSSRHandler(
      [
        createRoute('/error', {
          loader: async () => {
            throw new Error('Loader failed');
          },
        }),
      ],
      { onError },
    );
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/error') as any;
    await handler(c);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), c);
  });

  it('default template includes doctype and root div', async () => {
    const handler = createSSRHandler([createRoute('/')]);
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c = createMockContext('http://localhost:3000/') as any;
    await handler(c);
    const htmlArg = c.html.mock.calls[0][0] as string;
    expect(htmlArg).toContain('<!DOCTYPE html>');
    expect(htmlArg).toContain('<div id="root">');
    expect(htmlArg).toContain('type="module"');
  });

  it('handles multiple routes correctly', async () => {
    const handler = createSSRHandler([
      createRoute('/', { meta: { title: 'Home' } }),
      createRoute('/about', { component: AboutComponent, meta: { title: 'About' } }),
    ]);
    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c1 = createMockContext('http://localhost:3000/') as any;
    await handler(c1);
    expect(c1.html).toHaveBeenCalledWith(expect.stringContaining('Home Page'));

    // biome-ignore lint/suspicious/noExplicitAny: mock context
    const c2 = createMockContext('http://localhost:3000/about') as any;
    await handler(c2);
    expect(c2.html).toHaveBeenCalledWith(expect.stringContaining('About Page'));
  });
});
