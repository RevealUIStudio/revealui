import { describe, expect, it } from 'vitest';
import robots from '../robots';

describe('robots.txt', () => {
  it('returns a valid robots config', () => {
    const config = robots();

    expect(config.rules).toBeDefined();
    expect(config.sitemap).toBeDefined();
  });

  it('allows all user agents to crawl /', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');

    expect(wildcardRule).toBeDefined();
    expect(wildcardRule?.allow).toBe('/');
  });

  it('disallows crawling of /api/ paths', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');

    expect(wildcardRule?.disallow).toContain('/api/');
  });

  it('points sitemap to revealui.com', () => {
    const config = robots();

    expect(config.sitemap).toBe('https://revealui.com/sitemap.xml');
  });
});
