// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyDocHead, buildOgUrl, docsCanonicalUrl, setRobotsNoindex } from '../head';

function metaContent(attr: 'name' | 'property', key: string): string | null {
  return document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null;
}

describe('applyDocHead', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('sets the page title with the site suffix and syncs og/twitter tags', () => {
    applyDocHead({ title: 'Quick Start', description: 'Get a local dev stack running.' });
    expect(document.title).toBe('Quick Start · RevealUI Docs');
    expect(metaContent('name', 'description')).toBe('Get a local dev stack running.');
    expect(metaContent('property', 'og:title')).toBe('Quick Start · RevealUI Docs');
    expect(metaContent('property', 'og:image')).toContain('title=Quick+Start');
    expect(metaContent('name', 'twitter:image')).toContain('title=Quick+Start');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://docs.revealui.com/',
    );
    expect(metaContent('property', 'og:url')).toBe('https://docs.revealui.com/');
  });

  it('sets a self-referencing canonical for the page pathname', () => {
    applyDocHead({ title: 'Admin Guide', pathname: '/admin-guide' });
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://docs.revealui.com/admin-guide',
    );
    expect(metaContent('property', 'og:url')).toBe('https://docs.revealui.com/admin-guide');
  });

  it('drops the canonical and sets noindex for not-found pages', () => {
    applyDocHead({ title: 'Admin Guide', pathname: '/admin-guide' });
    applyDocHead({ title: 'Not Found', noindex: true, pathname: '/missing' });
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(metaContent('property', 'og:url')).toBeNull();
    expect(metaContent('name', 'robots')).toBe('noindex, nofollow');
  });

  it('restores the site defaults when fields are omitted', () => {
    applyDocHead({ title: 'Quick Start', description: 'Page-level description.' });
    applyDocHead();
    expect(document.title).toBe('RevealUI Documentation');
    expect(metaContent('name', 'description') ?? '').toContain('agentic business runtime');
    expect(metaContent('property', 'og:title')).toBe('RevealUI Documentation');
  });

  it('updates existing meta tags instead of duplicating them', () => {
    applyDocHead({ title: 'A' });
    applyDocHead({ title: 'B' });
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(metaContent('property', 'og:title')).toBe('B · RevealUI Docs');
  });

  it('treats whitespace-only fields as absent', () => {
    applyDocHead({ title: '   ', description: '  ' });
    expect(document.title).toBe('RevealUI Documentation');
    expect(metaContent('name', 'description') ?? '').toContain('agentic business runtime');
  });
});

describe('docsCanonicalUrl', () => {
  it('uses the docs origin and strips a trailing slash', () => {
    expect(docsCanonicalUrl('/pricing/')).toBe('https://docs.revealui.com/pricing');
    expect(docsCanonicalUrl('/')).toBe('https://docs.revealui.com/');
  });
});

describe('setRobotsNoindex', () => {
  it('removes the canonical while noindex is on', () => {
    document.head.innerHTML = '<link rel="canonical" href="https://docs.revealui.com/" />';
    setRobotsNoindex(true);
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(metaContent('name', 'robots')).toBe('noindex, nofollow');
  });
});

describe('buildOgUrl', () => {
  it('URL-encodes the title and optional description', () => {
    const url = buildOgUrl('RevealUI Documentation', 'Guides, API reference');
    expect(url).toContain('/api/og?');
    expect(url).toContain('title=RevealUI+Documentation');
    expect(url).toContain('description=Guides%2C+API+reference');
  });

  it('omits an empty description', () => {
    expect(buildOgUrl('Docs')).not.toContain('description=');
  });
});
