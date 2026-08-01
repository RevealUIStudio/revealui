/**
 * Phase 2.2.4 — progressive form actions (ADR D2 form path) + redirect-from-action.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  getRouterRedirect,
  isFormActionRequest,
  RSC_ACTION_HEADER,
  RSC_REDIRECT_HEADER,
} from '../actions.js';
import { redirect } from '../navigation.js';
import { Router } from '../router.js';
import { renderRequest } from '../server-rsc.js';

function flightStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function formPost(path = 'http://x/', fields: Record<string, string> = {}): Request {
  const body = new URLSearchParams(fields);
  return new Request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

describe('isFormActionRequest', () => {
  it('detects urlencoded POST without x-rsc-action', () => {
    expect(isFormActionRequest(formPost())).toBe(true);
  });

  it('rejects JS action posts', () => {
    const r = new Request('http://x/', {
      method: 'POST',
      headers: {
        [RSC_ACTION_HEADER]: 'id',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'a=1',
    });
    expect(isFormActionRequest(r)).toBe(false);
  });

  it('rejects GET', () => {
    expect(isFormActionRequest(new Request('http://x/'))).toBe(false);
  });
});

describe('2.2.4 progressive form actions', () => {
  it('runs decodeFormAction and passes formState to createRscStream', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    let seenFormState: unknown;
    const decodeFormAction = vi.fn(async () => async () => 'ok-result');
    const decodeFormState = vi.fn(async (result: unknown, formData: FormData) => {
      expect(formData.get('message')).toBe('hi');
      return { message: result };
    });

    const res = await renderRequest(formPost('http://x/', { message: 'hi' }), {
      router,
      decodeFormAction,
      decodeFormState,
      createRscStream: async (_req, ctx) => {
        seenFormState = ctx.formState;
        expect(ctx.formAction).toBe(true);
        return flightStream('form-ok');
      },
    });

    expect(res.status).toBe(200);
    expect(decodeFormAction).toHaveBeenCalledOnce();
    expect(decodeFormState).toHaveBeenCalledOnce();
    expect(seenFormState).toEqual({ message: 'ok-result' });
  });

  it('actionMiddleware blocks form posts with 403', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    router.useAction(async () => false);
    const res = await renderRequest(formPost(), {
      router,
      decodeFormAction: async () => async () => 'nope',
      createRscStream: async () => flightStream('x'),
    });
    expect(res.status).toBe(403);
  });

  it('redirect() from form action yields 307 HTML Location', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    const res = await renderRequest(formPost(), {
      router,
      decodeFormAction: async () => async () => {
        redirect('/done');
      },
      createRscStream: async () => flightStream('x'),
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('Location')).toBe('/done');
  });

  it('redirect() from JS action yields X-Router-Redirect on RSC accept', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    const res = await renderRequest(
      new Request('http://x/', {
        method: 'POST',
        headers: {
          [RSC_ACTION_HEADER]: 'go',
          accept: 'text/x-component',
        },
      }),
      {
        router,
        loadServerAction: async () => async () => {
          redirect('/after');
        },
        createRscStream: async () => flightStream('x'),
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get(RSC_REDIRECT_HEADER)).toBe('/after');
    expect(getRouterRedirect(res)).toBe('/after');
  });

  it('form action failure returns 500', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    const res = await renderRequest(formPost(), {
      router,
      decodeFormAction: async () => async () => {
        throw new Error('boom');
      },
      createRscStream: async () => flightStream('x'),
    });
    expect(res.status).toBe(500);
  });

  it('POST without decodeFormAction is a normal resolve (not form path)', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    let formActionFlag: boolean | undefined;
    const res = await renderRequest(formPost(), {
      router,
      createRscStream: async (_req, ctx) => {
        formActionFlag = ctx.formAction;
        return flightStream('plain');
      },
    });
    expect(res.status).toBe(200);
    expect(formActionFlag).toBeUndefined();
  });
});
