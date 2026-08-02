/**
 * Phase 2.3.2 — error boundaries + notFound + loader 500 path.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ErrorBoundary, RouterProvider, Routes } from '../components.js';
import { notFound } from '../navigation.js';
import { Router } from '../router.js';
import { renderRequest } from '../server-rsc.js';

afterEach(() => {
  cleanup();
  window.history.pushState(null, '', '/');
});

function Boom(): React.ReactNode {
  throw new Error('render boom');
}

function Fallback({ error }: { error: Error }): React.ReactNode {
  return <div data-testid="fallback">caught: {error.message}</div>;
}

function Ok(): React.ReactNode {
  return <div data-testid="ok">ok</div>;
}

function flightStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe('ErrorBoundary (2.3.2)', () => {
  it('catches child render errors and shows fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={Fallback}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('fallback').textContent).toContain('render boom');
    spy.mockRestore();
  });

  it('clears error when resetKey changes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary fallback={Fallback} resetKey="a">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('fallback')).toBeTruthy();
    rerender(
      <ErrorBoundary fallback={Fallback} resetKey="b">
        <Ok />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('ok').textContent).toBe('ok');
    spy.mockRestore();
  });

  it('Routes uses per-route errorBoundary over router option', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function RouteFallback({ error }: { error: Error }) {
      return <div data-testid="route-fb">{error.message}</div>;
    }
    function RouterFallback() {
      return <div data-testid="router-fb">router</div>;
    }
    const router = new Router({ errorBoundary: RouterFallback });
    router.register({
      path: '/',
      component: Boom,
      errorBoundary: RouteFallback,
    });
    router.seedCurrentMatch(router.match('/'));
    render(
      <RouterProvider router={router}>
        <Routes />
      </RouterProvider>,
    );
    expect(screen.getByTestId('route-fb').textContent).toBe('render boom');
    expect(screen.queryByTestId('router-fb')).toBeNull();
    spy.mockRestore();
  });
});

describe('renderRequest loader failures (2.3.2)', () => {
  it('notFound() from loader yields 404', async () => {
    const router = new Router({ rsc: {} });
    router.register({
      path: '/gone',
      component: () => null,
      loader: () => {
        notFound();
      },
    });
    const res = await renderRequest(new Request('http://x/gone'), {
      router,
      createRscStream: async () => flightStream('x'),
    });
    expect(res.status).toBe(404);
  });

  it('generic loader throw yields controlled 500 HTML without stack', async () => {
    const router = new Router({ rsc: {} });
    router.register({
      path: '/boom',
      component: () => null,
      loader: () => {
        throw new Error('loader exploded');
      },
    });
    const res = await renderRequest(new Request('http://x/boom'), {
      router,
      createRscStream: async () => flightStream('x'),
    });
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain('data-router-error');
    expect(body).toContain('Go Home');
    expect(body).not.toContain('at Object.loader');
  });

  it('generic loader throw on RSC accept returns JSON error', async () => {
    const router = new Router({ rsc: {} });
    router.register({
      path: '/boom',
      component: () => null,
      loader: () => {
        throw new Error('loader exploded');
      },
    });
    const res = await renderRequest(
      new Request('http://x/boom', { headers: { accept: 'text/x-component' } }),
      {
        router,
        createRscStream: async () => flightStream('x'),
      },
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('X-Router-Error')).toBe('1');
    const json = (await res.json()) as { error: boolean; message: string };
    expect(json.error).toBe(true);
    expect(json.message).toMatch(/loader exploded|Something went wrong/);
  });
});
