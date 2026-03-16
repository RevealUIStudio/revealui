import { describe, expect, it } from 'vitest';
import sitemap from '../sitemap';

describe('sitemap.xml', () => {
  it('returns an array of sitemap entries', () => {
    const entries = sitemap();

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('includes the homepage with highest priority', () => {
    const entries = sitemap();
    const homepage = entries.find((e) => e.url === 'https://revealui.com');

    expect(homepage).toBeDefined();
    expect(homepage?.priority).toBe(1);
    expect(homepage?.changeFrequency).toBe('weekly');
  });

  it('includes the pricing page', () => {
    const entries = sitemap();
    const pricing = entries.find((e) => e.url === 'https://revealui.com/pricing');

    expect(pricing).toBeDefined();
    expect(pricing?.priority).toBe(0.8);
    expect(pricing?.changeFrequency).toBe('monthly');
  });

  it('includes legal pages (terms, privacy)', () => {
    const entries = sitemap();
    const terms = entries.find((e) => e.url === 'https://revealui.com/terms');
    const privacy = entries.find((e) => e.url === 'https://revealui.com/privacy');

    expect(terms).toBeDefined();
    expect(privacy).toBeDefined();
    expect(terms?.changeFrequency).toBe('yearly');
    expect(privacy?.changeFrequency).toBe('yearly');
  });

  it('includes the sponsor page', () => {
    const entries = sitemap();
    const sponsor = entries.find((e) => e.url === 'https://revealui.com/sponsor');

    expect(sponsor).toBeDefined();
    expect(sponsor?.priority).toBe(0.5);
  });

  it('all entries have lastModified as a Date', () => {
    const entries = sitemap();

    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });

  it('all URLs use the revealui.com domain', () => {
    const entries = sitemap();

    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\/revealui\.com/);
    }
  });
});
