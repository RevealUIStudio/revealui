import { describe, expect, it } from 'vitest';
import {
  BlockSchema,
  CtaSectionBlockSchema,
  createCtaSectionBlock,
  createHeroBlock,
  createSectionBlock,
  HeroBlockSchema,
  SectionBlockSchema,
} from '../index.js';

describe('Marketing section blocks', () => {
  describe('HeroBlockSchema', () => {
    it('round-trips a full hero block', () => {
      const block = createHeroBlock('hero-1', 'Ship agents your business can audit', {
        eyebrow: 'RevealUI',
        subtitle: 'The self-hosted runtime for governed agents.',
        support: 'Runs on any AI provider you choose.',
        links: [
          { label: 'Get started', href: '/start', variant: 'primary' },
          { label: 'Read the docs', href: '/docs', variant: 'secondary' },
        ],
      });

      const parsed = HeroBlockSchema.safeParse(block);
      expect(parsed.success).toBe(true);
      // Parses through the canonical union too.
      expect(BlockSchema.safeParse(block).success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.type).toBe('hero');
        expect(parsed.data.data.title).toBe('Ship agents your business can audit');
        expect(parsed.data.data.links).toHaveLength(2);
      }
    });

    it('requires a title', () => {
      const parsed = HeroBlockSchema.safeParse({
        id: 'hero-2',
        type: 'hero',
        data: { subtitle: 'no title here' },
      });
      expect(parsed.success).toBe(false);
    });

    it('rejects an unknown link variant', () => {
      const parsed = HeroBlockSchema.safeParse({
        id: 'hero-3',
        type: 'hero',
        data: { title: 'x', links: [{ label: 'a', href: '/a', variant: 'ghost' }] },
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('CtaSectionBlockSchema', () => {
    it('round-trips a cta block with a display-only snippet', () => {
      const block = createCtaSectionBlock('cta-1', 'Deploy in one command', {
        body: 'One roof for your business and the agents that run it.',
        links: [{ label: 'Install', href: '/install', variant: 'primary' }],
        snippet: {
          lines: ['npx create-revealui', 'cd my-app'],
          caption: 'That is the whole setup.',
        },
      });

      const parsed = CtaSectionBlockSchema.safeParse(block);
      expect(parsed.success).toBe(true);
      expect(BlockSchema.safeParse(block).success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.data.snippet?.lines).toEqual(['npx create-revealui', 'cd my-app']);
      }
    });

    it('requires a heading', () => {
      const parsed = CtaSectionBlockSchema.safeParse({
        id: 'cta-2',
        type: 'ctaSection',
        data: { body: 'no heading' },
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('SectionBlockSchema', () => {
    it('round-trips a repeater section', () => {
      const block = createSectionBlock('sec-1', 'Questions', {
        eyebrow: 'FAQ',
        items: [
          { title: 'Is it self-hosted?', body: 'Yes, it runs on your infrastructure.' },
          { label: 'Beat 2', body: 'The receipt prints.' },
        ],
      });

      const parsed = SectionBlockSchema.safeParse(block);
      expect(parsed.success).toBe(true);
      expect(BlockSchema.safeParse(block).success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.data.items).toHaveLength(2);
      }
    });

    it('requires each item to carry a body', () => {
      const parsed = SectionBlockSchema.safeParse({
        id: 'sec-2',
        type: 'section',
        data: { heading: 'x', items: [{ title: 'no body' }] },
      });
      expect(parsed.success).toBe(false);
    });
  });
});
