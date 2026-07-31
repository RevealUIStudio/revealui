import { describe, expect, it } from 'vitest';
import {
  negotiateRepresentation,
  resolveRscEndpointPath,
  routingPathname,
  wantsRscPayload,
} from '../negotiate.js';
import { Router } from '../router.js';

function req(url: string, accept?: string): Request {
  const headers = accept ? { accept } : undefined;
  return new Request(url, { headers });
}

describe('negotiate (T3)', () => {
  it('wantsRscPayload detects text/x-component Accept', () => {
    expect(wantsRscPayload(req('http://x/', 'text/html'))).toBe(false);
    expect(wantsRscPayload(req('http://x/', 'text/x-component'))).toBe(true);
    expect(wantsRscPayload(req('http://x/', 'text/html, text/x-component;q=0.9'))).toBe(true);
  });

  it('resolveRscEndpointPath strips endpoint prefix', () => {
    expect(resolveRscEndpointPath('/posts/1', undefined)).toEqual({
      pathname: '/posts/1',
      forceRsc: false,
    });
    expect(resolveRscEndpointPath('/.rsc/posts/1', '/.rsc')).toEqual({
      pathname: '/posts/1',
      forceRsc: true,
    });
    expect(resolveRscEndpointPath('/.rsc', '/.rsc')).toEqual({
      pathname: '/',
      forceRsc: true,
    });
    expect(resolveRscEndpointPath('/about', '/.rsc')).toEqual({
      pathname: '/about',
      forceRsc: false,
    });
  });

  it('negotiateRepresentation prefers Accept then HTML', () => {
    expect(negotiateRepresentation(req('http://x/about'), {})).toBe('html');
    expect(negotiateRepresentation(req('http://x/about', 'text/x-component'), {})).toBe('rsc');
  });

  it('negotiateRepresentation forces rsc on endpoint path', () => {
    expect(negotiateRepresentation(req('http://x/.rsc/about'), { endpoint: '/.rsc' })).toBe('rsc');
    expect(
      negotiateRepresentation(req('http://x/.rsc/about', 'text/html'), { endpoint: '/.rsc' }),
    ).toBe('rsc');
  });

  it('routingPathname strips endpoint for matching', () => {
    expect(routingPathname(req('http://x/.rsc/posts/9'), { endpoint: '/.rsc' })).toBe('/posts/9');
  });

  it('Router.negotiate is html in client mode', () => {
    const router = new Router();
    expect(router.negotiate(req('http://x/', 'text/x-component'))).toBe('html');
  });

  it('Router.negotiate uses rsc options in rsc mode', () => {
    const router = new Router({ rsc: { endpoint: '/.rsc' } });
    expect(router.negotiate(req('http://x/.rsc/a'))).toBe('rsc');
    expect(router.negotiate(req('http://x/a'))).toBe('html');
    expect(router.negotiate(req('http://x/a', 'text/x-component'))).toBe('rsc');
    expect(router.routingPathname(req('http://x/.rsc/a'))).toBe('/a');
  });
});
