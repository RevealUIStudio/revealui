// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { applyDocHead, buildOgUrl } from '../head';

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
