// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { encodeBase64Chunked, readStreamToUint8Array } from '../base64.js';
import { Router } from '../router.js';
import { inlineRscPayloadScript, renderRequest } from '../server-rsc.js';

function flightStream(text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(text));
      controller.close();
    },
  });
}

describe('base64 chunked (T4 / D15)', () => {
  it('encodes empty and small payloads', () => {
    expect(encodeBase64Chunked(new Uint8Array(0))).toBe('');
    const bytes = new TextEncoder().encode('hello-rsc');
    expect(encodeBase64Chunked(bytes)).toBe(btoa('hello-rsc'));
  });

  it('encodes large payloads without throwing (no spread stack blow)', () => {
    const big = new Uint8Array(200_000);
    for (let i = 0; i < big.length; i++) big[i] = i % 256;
    const b64 = encodeBase64Chunked(big);
    expect(b64.length).toBeGreaterThan(1000);
    // Round-trip first 100 bytes via atob of whole is heavy; spot-check length formula
    expect(b64.length).toBe(Math.ceil(big.length / 3) * 4);
  });
});

describe('renderRequest (T3/T4)', () => {
  it('throws when router is not in rsc mode', async () => {
    const router = new Router();
    await expect(
      renderRequest(new Request('http://localhost/'), {
        router,
        createRscStream: async () => flightStream('x'),
      }),
    ).rejects.toThrow(/rsc mode/);
  });

  it('returns text/x-component when Accept asks for RSC', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null, meta: { title: 'Home' } });
    const res = await renderRequest(
      new Request('http://localhost/', { headers: { accept: 'text/x-component' } }),
      {
        router,
        createRscStream: async () => flightStream('1:flight-payload'),
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/x-component');
    expect(res.headers.get('vary')?.toLowerCase()).toContain('accept');
    const body = await res.text();
    expect(body).toBe('1:flight-payload');
  });

  it('returns HTML with __RSC_PAYLOAD__ when Accept is HTML', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null, meta: { title: 'Home' } });
    const res = await renderRequest(new Request('http://localhost/'), {
      router,
      createRscStream: async () => flightStream('flight-bytes'),
      loadBootstrapScriptContent: async () => '/*boot*/',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('__RSC_PAYLOAD__');
    expect(html).toContain(btoa('flight-bytes'));
    expect(html).toContain('/*boot*/');
    expect(html).toContain('<title>Home</title>');
  });

  it('endpoint path forces RSC even without Accept', async () => {
    const router = new Router({ rsc: { endpoint: '/.rsc' } });
    router.register({ path: '/about', component: () => null });
    const res = await renderRequest(new Request('http://localhost/.rsc/about'), {
      router,
      createRscStream: async (_req, ctx) => {
        expect(ctx.pathname).toBe('/about');
        expect(ctx.representation).toBe('rsc');
        return flightStream('endpoint-flight');
      },
    });
    expect(res.headers.get('content-type')).toContain('text/x-component');
    expect(await res.text()).toBe('endpoint-flight');
  });

  it('returns 404 status when no route matches', async () => {
    const router = new Router({ rsc: {} });
    router.register({ path: '/', component: () => null });
    const res = await renderRequest(
      new Request('http://localhost/missing', { headers: { accept: 'text/x-component' } }),
      {
        router,
        createRscStream: async () => flightStream('x'),
      },
    );
    expect(res.status).toBe(404);
  });

  it('inlineRscPayloadScript produces assignable JSON string', async () => {
    const script = await inlineRscPayloadScript(flightStream('abc'));
    expect(script.startsWith('self.__RSC_PAYLOAD__=')).toBe(true);
    expect(script).toContain(JSON.stringify(btoa('abc')));
  });

  it('readStreamToUint8Array concatenates chunks', async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('ab'));
        c.enqueue(enc.encode('cd'));
        c.close();
      },
    });
    const bytes = await readStreamToUint8Array(stream);
    expect(new TextDecoder().decode(bytes)).toBe('abcd');
  });
});
