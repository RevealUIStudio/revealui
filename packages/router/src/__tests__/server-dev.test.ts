// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerInfo, honoGet, honoFetch, HonoMock, serveMock } = vi.hoisted(() => {
  const loggerInfo = vi.fn();
  const honoGet = vi.fn();
  const honoFetch = vi.fn();
  const HonoMock = vi.fn(function Hono() {
    return {
      get: honoGet,
      fetch: honoFetch,
    };
  });
  const serveMock = vi.fn();

  return {
    loggerInfo,
    honoGet,
    honoFetch,
    HonoMock,
    serveMock,
  };
});

vi.mock('@revealui/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: loggerInfo,
    debug: vi.fn(),
  },
}));

vi.mock('hono', () => ({
  Hono: HonoMock,
}));

vi.mock('@hono/node-server', () => ({
  serve: serveMock,
}));

import { createDevServer } from '../server.js';
import type { Route } from '../types.js';

const DummyComponent = () => null;

function createRoute(path: string): Route {
  return {
    path,
    component: DummyComponent,
  };
}

describe('createDevServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serveMock.mockReturnValue({ close: vi.fn() });
  });

  it('creates a Hono app, registers the SSR handler, and uses the default port', async () => {
    const server = await createDevServer([createRoute('/')]);

    expect(HonoMock).toHaveBeenCalledOnce();
    expect(honoGet).toHaveBeenCalledWith('*', expect.any(Function));
    expect(serveMock).toHaveBeenCalledWith({
      fetch: honoFetch,
      port: 3000,
    });
    expect(loggerInfo).toHaveBeenCalledWith('RevealUI dev server running', {
      url: 'http://localhost:3000',
    });
    expect(server).toEqual({ close: expect.any(Function) });
  });

  it('uses the provided port when one is specified', async () => {
    await createDevServer([createRoute('/about')], { port: 4321 });

    expect(serveMock).toHaveBeenCalledWith({
      fetch: honoFetch,
      port: 4321,
    });
    expect(loggerInfo).toHaveBeenCalledWith('RevealUI dev server running', {
      url: 'http://localhost:4321',
    });
  });
});
