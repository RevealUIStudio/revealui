#!/usr/bin/env tsx

/**
 * Seed Sample Content Script
 *
 * This script creates sample content entries in the CMS collections
 * for testing the frontend components.
 *
 * Usage:
 *   pnpm tsx scripts/seed-sample-content.ts
 *
 * Note: Make sure the CMS server is running and you have admin access
 */

import config from '@reveal-config'
import {getRevealUI} from '@revealui/core'
import { createLogger, getProjectRoot } from '../../lib/index.js'
import { ErrorCode } from '../lib/errors.js'

const logger = createLogger()

interface SampleContent {
  contents: Array<{
    name: string
    description: string
  }>
  cards: Array<{
    name: string
    label: string
    cta: string
    href: string
    loading: 'eager' | 'lazy'
  }>
  heros: Array<{
    href: string
    altText: string
    video?: string
  }>
  events: Array<{
    title: string
    name: string
    description: string
    alt: string
  }>
  banners: Array<{
    heading: string
    subheading: string
    description: string
    cta: string
    highlight: string
    punctuation: string
    alt: string
    link: {
      href: string
      text: string
    }
    stats: Array<{
      label: string
      value: string
    }>
  }>
}

const sampleContent: SampleContent = {
  contents: [
    {
      name: 'Getting Started',
      description:
        'Welcome to RevealUI Framework. RevealUI is a modern, full-stack React framework with a built-in headless CMS. Get started by exploring the admin panel, creating content, and building your application with React 19 and Next.js 16.',
    },
    {
      name: 'About RevealUI',
      description:
        'RevealUI is a production-ready framework that combines React 19, Next.js 16, and a powerful headless CMS. Built with TypeScript, Tailwind CSS v4, and enterprise-grade features like authentication, media management, and real-time collaboration.',
    },
  ],
  cards: [
    {
      name: 'Documentation',
      label: 'Learn More',
      cta: 'View Docs',
      href: '/docs',
      loading: 'eager',
    },
    {
      name: 'Components',
      label: 'UI Library',
      cta: 'Browse Components',
      href: '/components',
      loading: 'lazy',
    },
    {
      name: 'Examples',
      label: 'Code Samples',
      cta: 'View Examples',
      href: '/examples',
      loading: 'lazy',
    },
  ],
  heros: [
    {
      href: 'https://revealui.com',
      altText: 'RevealUI Framework hero image',
      video: 'https://revealui.com',
    },
  ],
  events: [
    {
      title: 'GETTING STARTED',
      name: 'Quick Start Guide',
      description:
        'Learn how to set up RevealUI, configure your collections, and start building your application. Follow our step-by-step guide to get up and running in minutes.',
      alt: 'RevealUI getting started guide',
    },
    {
      title: 'FEATURES',
      name: 'Framework Features',
      description:
        'Discover all the powerful features RevealUI has to offer: headless CMS, React 19 Server Components, TypeScript support, authentication, media management, and more.',
      alt: 'RevealUI framework features',
    },
  ],
  banners: [
    {
      heading: 'Welcome to RevealUI!',
      subheading: 'Build Faster',
      description:
        'Start building your next application with RevealUI Framework. Experience the power of React 19, Next.js 16, and a modern headless CMS all in one.',
      cta: 'Get Started',
      highlight: 'Modern React Framework',
      punctuation: '.',
      alt: 'RevealUI Framework banner image',
      link: {
        href: '/docs',
        text: 'Read Documentation',
      },
      stats: [
        { label: 'React 19', value: 'Latest' },
        { label: 'Next.js', value: '16' },
        { label: 'TypeScript', value: '5.9' },
        { label: 'Packages', value: '50+' },
      ],
    },
  ],
}

async function seedContent() {
  try {
    const _projectRoot = await getProjectRoot(import.meta.url)
    logger.header('Seed Sample Content')
    logger.info('Starting content seeding...\n')

    const revealuiConfig = await config
    const revealui = await getRevealUI({ config: revealuiConfig })

    // Seed Contents
    logger.info('📝 Seeding Contents collection...')
    for (const content of sampleContent.contents) {
      try {
        const existing = await revealui.find({
          collection: 'contents',
          where: { name: { equals: content.name } },
        })

        if (existing.docs && existing.docs.length > 0) {
          logger.info(`   ⏭️  Skipping "${content.name}" (already exists)`)
          continue
        }

        await revealui.create({
          collection: 'contents',
          data: content,
        })
        logger.success(`   Created: "${content.name}"`)
      } catch (error) {
        logger.error(
          `   Error creating "${content.name}": ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // Seed Cards
    logger.info('\n🃏 Seeding Cards collection...')
    for (const card of sampleContent.cards) {
      try {
        const existing = await revealui.find({
          collection: 'cards',
          where: { name: { equals: card.name } },
        })

        if (existing.docs && existing.docs.length > 0) {
          logger.info(`   ⏭️  Skipping "${card.name}" (already exists)`)
          continue
        }

        await revealui.create({
          collection: 'cards',
          data: card,
        })
        logger.success(`   Created: "${card.name}"`)
      } catch (error) {
        logger.error(
          `   Error creating "${card.name}": ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // Seed Heros
    logger.info('\n🦸 Seeding Heros collection...')
    for (const hero of sampleContent.heros) {
      try {
        const existing = await revealui.find({
          collection: 'heros',
          where: { href: { equals: hero.href } },
        })

        if (existing.docs && existing.docs.length > 0) {
          logger.info(`   ⏭️  Skipping hero with href "${hero.href}" (already exists)`)
          continue
        }

        await revealui.create({
          collection: 'heros',
          data: hero,
        })
        logger.success(`   Created hero: "${hero.altText}"`)
      } catch (error) {
        logger.error(
          `   Error creating hero: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // Seed Events
    logger.info('\n📅 Seeding Events collection...')
    for (const event of sampleContent.events) {
      try {
        const existing = await revealui.find({
          collection: 'events',
          where: { title: { equals: event.title } },
        })

        if (existing.docs && existing.docs.length > 0) {
          logger.info(`   ⏭️  Skipping "${event.title}" (already exists)`)
          continue
        }

        await revealui.create({
          collection: 'events',
          data: event,
        })
        logger.success(`   Created: "${event.title}"`)
      } catch (error) {
        logger.error(
          `   Error creating "${event.title}": ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // Seed Banners
    logger.info('\n🎯 Seeding Banners collection...')
    for (const banner of sampleContent.banners) {
      try {
        const existing = await revealui.find({
          collection: 'banners',
          where: { heading: { equals: banner.heading } },
        })

        if (existing.docs && existing.docs.length > 0) {
          logger.info(`   ⏭️  Skipping "${banner.heading}" (already exists)`)
          continue
        }

        await revealui.create({
          collection: 'banners',
          data: banner,
        })
        logger.success(`   Created: "${banner.heading}"`)
      } catch (error) {
        logger.error(
          `   Error creating "${banner.heading}": ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    logger.success('\n✨ Content seeding completed!')
    logger.info('\n📋 Next steps:')
    logger.info('   1. Go to http://localhost:4000/admin')
    logger.info('   2. Navigate to each collection')
    logger.info('   3. Add images to the entries (upload to Media first)')
    logger.info('   4. Visit http://localhost:3000 to see the content\n')
  } catch (error) {
    logger.error(
      `Fatal error during seeding: ${error instanceof Error ? error.message : String(error)}`,
    )
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await seedContent()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()

export {sampleContent,seedContent}

