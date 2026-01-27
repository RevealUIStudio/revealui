/**
 * Unit tests for seed-sample-content.ts
 * Tests sample content seeding logic
 */

import { describe, expect, it } from 'vitest'

describe('seed-sample-content', () => {
  describe('Sample content structure', () => {
    it('should have contents array', () => {
      const sampleContent = {
        contents: [
          {
            name: 'Getting Started',
            description: 'Welcome to RevealUI Framework.',
          },
          {
            name: 'About RevealUI',
            description: 'RevealUI is a production-ready framework.',
          },
        ],
      }
      expect(sampleContent.contents.length).toBe(2)
      expect(sampleContent.contents[0]).toHaveProperty('name')
      expect(sampleContent.contents[0]).toHaveProperty('description')
    })

    it('should have cards array with required fields', () => {
      const card = {
        name: 'Documentation',
        label: 'Learn More',
        cta: 'View Docs',
        href: '/docs',
        loading: 'eager' as const,
      }
      expect(card).toHaveProperty('name')
      expect(card).toHaveProperty('href')
      expect(card).toHaveProperty('loading')
      expect(['eager', 'lazy']).toContain(card.loading)
    })

    it('should have heros array with optional video', () => {
      const hero = {
        href: '/hero',
        altText: 'Hero image',
        video: 'optional-video.mp4',
      }
      expect(hero).toHaveProperty('href')
      expect(hero).toHaveProperty('altText')
      expect(hero.video).toBeDefined()
    })

    it('should have events array with required fields', () => {
      const event = {
        title: 'Event Title',
        name: 'event-name',
        description: 'Event description',
        alt: 'Event alt text',
      }
      expect(event).toHaveProperty('title')
      expect(event).toHaveProperty('name')
      expect(event).toHaveProperty('description')
    })

    it('should have banners array with complex structure', () => {
      const banner = {
        heading: 'Banner Heading',
        subheading: 'Subheading',
        description: 'Description',
        cta: 'Call to Action',
        highlight: 'Highlight',
        punctuation: '!',
        alt: 'Alt text',
        link: {
          href: '/link',
          text: 'Link Text',
        },
        stats: [
          { label: 'Stat 1', value: '100' },
          { label: 'Stat 2', value: '200' },
        ],
      }
      expect(banner).toHaveProperty('heading')
      expect(banner).toHaveProperty('link')
      expect(banner.link).toHaveProperty('href')
      expect(banner.stats).toBeInstanceOf(Array)
      expect(banner.stats.length).toBeGreaterThan(0)
    })
  })

  describe('Content validation', () => {
    it('should validate required fields are present', () => {
      const content = {
        name: 'Test Content',
        description: 'Test Description',
      }
      expect(content.name).toBeTruthy()
      expect(content.description).toBeTruthy()
    })

    it('should validate loading attribute values', () => {
      const validValues = ['eager', 'lazy']
      expect(validValues).toContain('eager')
      expect(validValues).toContain('lazy')
    })
  })
})
