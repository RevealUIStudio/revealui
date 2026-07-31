import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerError, loggerInfo, hydrateRootMock } = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  hydrateRootMock: vi.fn(),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: {
    error: loggerError,
    warn: vi.fn(),
    info: loggerInfo,
    debug: vi.fn(),
  },
}));

vi.mock('react-dom/client', () => ({
  hydrateRoot: hydrateRootMock,
}));

import { hydrate } from '../server-ssr.js';

describe('hydrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('logs an error when the root element cannot be found', async () => {
    const router = {
      match: vi.fn(),
      initClient: vi.fn(),
    };

    await hydrate(router as never);

    expect(loggerError).toHaveBeenCalledWith('Root element not found', expect.any(Error));
    expect(router.initClient).not.toHaveBeenCalled();
    expect(hydrateRootMock).not.toHaveBeenCalled();
  });

  it('hydrates the app and seeds matched route data from SSR payload', async () => {
    document.body.innerHTML = `
      <div id="root"></div>
      <script id="__REVEALUI_DATA__" type="application/json">
        {"route":"/docs","data":{"title":"Docs Page"}}
      </script>
    `;

    window.history.replaceState({}, '', '/docs');

    const match = {
      data: undefined as unknown,
    };
    const router = {
      match: vi.fn().mockReturnValue(match),
      seedCurrentMatch: vi.fn(),
      initClient: vi.fn(),
    };

    await hydrate(router as never);

    expect(router.match).toHaveBeenCalledWith('/docs');
    expect(match.data).toEqual({ title: 'Docs Page' });
    expect(router.seedCurrentMatch).toHaveBeenCalledWith(match);
    expect(router.initClient).toHaveBeenCalledOnce();
    expect(hydrateRootMock).toHaveBeenCalledWith(
      document.getElementById('root'),
      expect.any(Object),
    );
    expect(loggerInfo).toHaveBeenCalledWith('RevealUI hydrated');
  });

  it('hydrates without mutating route data when no SSR route payload is present', async () => {
    document.body.innerHTML = `
      <div id="app-root"></div>
      <script id="__REVEALUI_DATA__" type="application/json">
        {"data":{"title":"Ignored"}}
      </script>
    `;

    const router = {
      match: vi.fn(),
      seedCurrentMatch: vi.fn(),
      initClient: vi.fn(),
    };
    const root = document.getElementById('app-root');

    await hydrate(router as never, root);

    expect(router.match).not.toHaveBeenCalled();
    expect(router.seedCurrentMatch).not.toHaveBeenCalled();
    expect(router.initClient).toHaveBeenCalledOnce();
    expect(hydrateRootMock).toHaveBeenCalledWith(root, expect.any(Object));
  });

  it('seeds getCurrentMatch so loader data survives the first client read', async () => {
    const { Router } = await import('../router.js');

    document.body.innerHTML = `
      <div id="root"></div>
      <script id="__REVEALUI_DATA__" type="application/json">
        {"route":"/docs","data":{"title":"Docs Page"}}
      </script>
    `;
    window.history.replaceState({}, '', '/docs');

    const router = new Router();
    router.register({
      path: '/docs',
      component: () => null,
      loader: async () => ({ title: 'Should not re-run' }),
    });

    await hydrate(router);

    const current = router.getCurrentMatch();
    expect(current).not.toBeNull();
    expect(current?.data).toEqual({ title: 'Docs Page' });
  });
});
