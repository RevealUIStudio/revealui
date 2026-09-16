import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';

const HOME_SHELL_TITLE =
  'RevealUI | The agentic business runtime startups operate on their own domain.';
const TEMPLATES_TITLE = 'Templates | RevealUI';

function addMeta(attr: 'name' | 'property', key: string, value: string): void {
  const el = document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', value);
  document.head.appendChild(el);
}

function renderAppAt(pathname: string): void {
  window.history.pushState(null, '', pathname);
  const router = new Router();
  render(
    <RouterProvider router={router}>
      <App />
    </RouterProvider>,
  );
}

function metaContent(attr: 'name' | 'property', key: string): string | null {
  return document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = HOME_SHELL_TITLE;
  addMeta('property', 'og:title', HOME_SHELL_TITLE);
  addMeta('name', 'twitter:title', HOME_SHELL_TITLE);
});

afterEach(() => {
  cleanup();
  document.title = '';
  window.history.pushState(null, '', '/');
});

describe('templates route document title', () => {
  it('registers /templates meta title as Templates | RevealUI', () => {
    const router = new Router();
    render(
      <RouterProvider router={router}>
        <App />
      </RouterProvider>,
    );
    expect(router.match('/templates')?.route.meta?.title).toBe(TEMPLATES_TITLE);
  });

  it('sets document.title and og/twitter title when the app matches /templates', () => {
    renderAppAt('/templates');
    expect(document.title).toBe(TEMPLATES_TITLE);
    expect(metaContent('property', 'og:title')).toBe(TEMPLATES_TITLE);
    expect(metaContent('name', 'twitter:title')).toBe(TEMPLATES_TITLE);
  });

  it('does not replace the home audience title with the short route meta on /', () => {
    renderAppAt('/');
    expect(document.title).toBe(HOME_SHELL_TITLE);
    expect(document.title).not.toBe('RevealUI');
  });
});
