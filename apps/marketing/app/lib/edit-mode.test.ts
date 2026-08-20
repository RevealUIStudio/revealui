/**
 * Edit-mode URL helpers: keep the signed preview token on in-iframe navigation
 * so home ↔ products (and other marketing routes) stay in the live-edit path.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  EDIT_QUERY_PARAM,
  installEditModeNavigation,
  preserveEditModeUrl,
  SESSION_QUERY_PARAM,
} from './edit-mode';

const SEARCH = `?${EDIT_QUERY_PARAM}=tok&${SESSION_QUERY_PARAM}=sid`;

describe('preserveEditModeUrl', () => {
  it('returns the target unchanged when edit params are absent', () => {
    expect(preserveEditModeUrl('/products', '')).toBe('/products');
    expect(preserveEditModeUrl('/products', '?for=technical')).toBe('/products');
  });

  it('appends rvui-edit and rvui-session to an internal path', () => {
    expect(preserveEditModeUrl('/products', SEARCH)).toBe(
      `/products?${EDIT_QUERY_PARAM}=tok&${SESSION_QUERY_PARAM}=sid`,
    );
  });

  it('keeps an existing query and hash on the target', () => {
    expect(preserveEditModeUrl('/products?for=technical#flagship', SEARCH)).toBe(
      `/products?for=technical&${EDIT_QUERY_PARAM}=tok&${SESSION_QUERY_PARAM}=sid#flagship`,
    );
  });

  it('leaves hash-only targets unchanged', () => {
    expect(preserveEditModeUrl('#main', SEARCH)).toBe('#main');
  });

  it('leaves non-http(s) schemes unchanged (allowlist, not denylist)', () => {
    expect(preserveEditModeUrl('mailto:hello@example.com', SEARCH)).toBe(
      'mailto:hello@example.com',
    );
    expect(preserveEditModeUrl('javascript:alert(1)', SEARCH)).toBe('javascript:alert(1)');
    expect(preserveEditModeUrl('JavaScript:alert(1)', SEARCH)).toBe('JavaScript:alert(1)');
    expect(preserveEditModeUrl('data:text/html,hi', SEARCH)).toBe('data:text/html,hi');
    expect(preserveEditModeUrl('vbscript:MsgBox(1)', SEARCH)).toBe('vbscript:MsgBox(1)');
  });
});

describe('installEditModeNavigation', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('rewrites history.pushState URLs so client-side nav keeps the edit token', () => {
    window.history.replaceState({}, '', `/${SEARCH}`);
    const uninstall = installEditModeNavigation();
    window.history.pushState({}, '', '/products');
    expect(window.location.pathname).toBe('/products');
    expect(window.location.search).toContain(`${EDIT_QUERY_PARAM}=tok`);
    expect(window.location.search).toContain(`${SESSION_QUERY_PARAM}=sid`);
    uninstall();
  });
});
