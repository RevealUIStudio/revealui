// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { getServerActionId, RSC_ACTION_HEADER } from '../actions.js';
import { notFound, RouterNotFound, RouterRedirect, redirect } from '../navigation.js';
import { getRequest, getRequestOrNull, runWithRequest } from '../request-context.js';
import { Router } from '../router.js';
import { renderRequest } from '../server-rsc.js';

function flightStream(text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(text));
      controller.close();
    },
  });
}

describe('T5 redirect / notFound', () => {
  it('redirect() throws RouterRedirect', () => {
    expect(() => redirect('/login')).toThrow(RouterRedirect);
    try {
      redirect('/login', { permanent: true });
    } catch (e) {
      expect(e).toBeInstanceOf(RouterRedirect);
      expect((e as RouterRedirect).path).toBe('/login');
      expect((e as RouterRedirect).permanent).toBe(true);
    }
  });

  it('notFound() throws RouterNotFound', () => {
    expect(() => notFound()).toThrow(RouterNotFound);
  });

  it('HTML redirect yields 307 Location', async () => {
    const router = new Router({ rsc: {} });
    router.register({
      path: '/secure',
      component: () => null,
      loader: async () => {
        redirect('/login');
      },
    });
    const res = await renderRequest(new Request('http://x/secure'), {
      router,
      createRscStream: async () => flightStream('x'),
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('/login');
  });

  it('HTML permanent redirect yields 308', async () => {
    const router = new Router({ rsc: {} });
    router.register({
      path: '/old',
      component: () => null,
      loader: async () => {
        redirect('/new', { permanent: true });
      },
    });
    const res = await renderRequest(new Request('http://x/old'), {
      router,
      createRscStream: async () => flightStream('x'),
    });
    expect(res.status).toBe(308);
    expect(res.headers.get('Location')).toBe('/new');
  });

  it('RSC redirect yields JSON body with path', async () => {
    const router = new Router({ rsc: {} });
    router.register({
      path: '/secure',
      component: () => null,
      loader: async () => {
        redirect('/login');
      },
    });
    const res = await renderRequest(
      new Request('http://x/secure', { headers: { accept: 'text/x-component' } }),
      {
        router,
        createRscStream: async () => flightStream('x'),
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Router-Redirect')).toBe('/login');
    const body = await res.json();
    expect(body).toEqual({ redirect: '/login', permanent: false });
  });

  it('notFound yields 404 HTML', async () => {
    const router = new Router({ rsc: {} });
    router.register({
      path: '/gone',
      component: () => null,
      loader: async () => {
        notFound();
      },
    });
    const res = await renderRequest(new Request('http://x/gone'), {
      router,
      createRscStream: async () => flightStream('x'),
    });
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('404');
  });
});

describe('T6 getRequest ALS', () => {
  it('getRequest throws outside context', () => {
    expect(() => getRequest()).toThrow(/outside a request context/);
    expect(getRequestOrNull()).toBeNull();
  });

  it('getRequest returns bound request inside runWithRequest', () => {
    const r = new Request('http://x/a');
    const got = runWithRequest(r, () => getRequest());
    expect(got).toBe(r);
  });

  it('renderRequest binds getRequest during createRscStream', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    let seen: string | undefined;
    await renderRequest(new Request('http://x/'), {
      router,
      createRscStream: async () => {
        seen = getRequest().url;
        return flightStream('ok');
      },
    });
    expect(seen).toBe('http://x/');
  });
});

describe('T7 server actions', () => {
  it('getServerActionId reads x-rsc-action on POST', () => {
    const r = new Request('http://x/', {
      method: 'POST',
      headers: { [RSC_ACTION_HEADER]: 'act-1' },
    });
    expect(getServerActionId(r)).toBe('act-1');
    expect(getServerActionId(new Request('http://x/'))).toBeNull();
  });

  it('actionMiddleware can block with 403', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    router.useAction(async () => false);
    const res = await renderRequest(
      new Request('http://x/', {
        method: 'POST',
        headers: { [RSC_ACTION_HEADER]: 'act-1', accept: 'text/x-component' },
      }),
      {
        router,
        createRscStream: async () => flightStream('x'),
        loadServerAction: async () => async () => 'nope',
      },
    );
    expect(res.status).toBe(403);
  });

  it('actionMiddleware can redirect', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    router.useAction(async () => '/login');
    const res = await renderRequest(
      new Request('http://x/', {
        method: 'POST',
        headers: { [RSC_ACTION_HEADER]: 'act-1' },
      }),
      {
        router,
        createRscStream: async () => flightStream('x'),
        loadServerAction: async () => async () => 'nope',
      },
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('/login');
  });

  it('runs loadServerAction and passes returnValue to createRscStream', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    const load = vi.fn(async (_id: string) => {
      return async (...args: unknown[]) => {
        const n = args[0];
        if (typeof n !== 'number') throw new Error('expected number arg');
        return n * 2;
      };
    });
    let returnValue: unknown;
    const res = await renderRequest(
      new Request('http://x/', {
        method: 'POST',
        headers: {
          [RSC_ACTION_HEADER]: 'double',
          accept: 'text/x-component',
        },
      }),
      {
        router,
        loadServerAction: load,
        decodeActionArgs: async () => [21],
        createRscStream: async (_req, ctx) => {
          returnValue = ctx.returnValue;
          return flightStream(`rv:${JSON.stringify(ctx.returnValue)}`);
        },
      },
    );
    expect(load).toHaveBeenCalledWith('double');
    expect(returnValue).toEqual({ ok: true, data: 42 });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('rv:{"ok":true,"data":42}');
  });

  it('requires loadServerAction when x-rsc-action present', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    await expect(
      renderRequest(
        new Request('http://x/', {
          method: 'POST',
          headers: { [RSC_ACTION_HEADER]: 'x' },
        }),
        {
          router,
          createRscStream: async () => flightStream('x'),
        },
      ),
    ).rejects.toThrow(/loadServerAction/);
  });
});
