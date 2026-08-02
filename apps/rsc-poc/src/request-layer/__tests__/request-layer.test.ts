/**
 * Request-layer unit tests (2.3.4) — perimeter only; no Router.match auth.
 */
import { describe, expect, it } from 'vitest';
import { csrfOriginResponse } from '../csrf-origin.ts';
import { domainLockResponse } from '../domain-lock.ts';

describe('domainLockResponse', () => {
  it('is disabled when env unset', () => {
    const prev = process.env.RSC_POC_ALLOWED_HOSTS;
    delete process.env.RSC_POC_ALLOWED_HOSTS;
    expect(domainLockResponse(new Request('http://evil.test/'))).toBeNull();
    if (prev !== undefined) process.env.RSC_POC_ALLOWED_HOSTS = prev;
  });

  it('allows listed host', () => {
    process.env.RSC_POC_ALLOWED_HOSTS = '127.0.0.1:4173,localhost:4173';
    expect(domainLockResponse(new Request('http://127.0.0.1:4173/'))).toBeNull();
    delete process.env.RSC_POC_ALLOWED_HOSTS;
  });

  it('blocks unlisted host', async () => {
    process.env.RSC_POC_ALLOWED_HOSTS = 'app.example.com';
    const res = domainLockResponse(new Request('http://evil.test/'));
    expect(res?.status).toBe(403);
    expect(await res?.text()).toMatch(/domain-lock/);
    delete process.env.RSC_POC_ALLOWED_HOSTS;
  });
});

describe('csrfOriginResponse', () => {
  it('allows GET', () => {
    expect(csrfOriginResponse(new Request('http://localhost/'))).toBeNull();
  });

  it('allows x-rsc-action POST without Origin', () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'x-rsc-action': 'act' },
    });
    expect(csrfOriginResponse(req)).toBeNull();
  });

  it('allows matching Origin on form POST', () => {
    const req = new Request('http://localhost:4173/api/session/login', {
      method: 'POST',
      headers: { origin: 'http://localhost:4173' },
    });
    expect(csrfOriginResponse(req)).toBeNull();
  });

  it('rejects mismatched Origin', async () => {
    const req = new Request('http://localhost:4173/api/session/login', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    const res = csrfOriginResponse(req);
    expect(res?.status).toBe(403);
    expect(await res?.text()).toMatch(/Origin mismatch/);
  });

  it('rejects mismatched Referer when Origin absent', async () => {
    const req = new Request('http://localhost:4173/api/session/login', {
      method: 'POST',
      headers: { referer: 'https://evil.example/attack' },
    });
    const res = csrfOriginResponse(req);
    expect(res?.status).toBe(403);
    expect(await res?.text()).toMatch(/Referer mismatch/);
  });
});
