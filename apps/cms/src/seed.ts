#!/usr/bin/env tsx

/**
 * Seed Script — Seeds all initial CMS content
 *
 * Creates pages, sample content, cards, heros, events, and banners.
 * Pages are seeded first because the frontend root URL (/) queries for
 * slug='home' — without it, new users see a 404 after signup.
 *
 * All seed operations are idempotent (checks for existing entries before creating).
 *
 * Usage:
 *   pnpm db:seed                    # Seed everything
 *   pnpm db:seed -- --pages-only    # Seed pages only
 *   pnpm db:seed -- --content-only  # Seed sample content only
 */

import config from '@reveal-config';
import { getRevealUI } from '@revealui/core';
import { getClient } from '@revealui/db';
import { sites, users } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';

const logger = {
  header: (msg: string) =>
    process.stdout.write(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}\n`),
  info: (msg: string) => process.stdout.write(`${msg}\n`),
  success: (msg: string) => process.stdout.write(`\x1b[32m${msg}\x1b[0m\n`),
  error: (msg: string) => process.stderr.write(`\x1b[31m${msg}\x1b[0m\n`),
};

// --- Lexical richText helpers ---

function heading(text: string, tag: 'h2' | 'h3' | 'h4' = 'h2') {
  return {
    type: 'heading',
    children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    tag,
    version: 1,
  };
}

function paragraph(text: string) {
  return {
    type: 'paragraph',
    children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    version: 1,
  };
}

function richTextDoc(...nodes: unknown[]) {
  return {
    root: {
      type: 'root',
      children: nodes,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  };
}

// --- Seed Data ---

const pages = [
  {
    title: 'Home',
    slug: 'home',
    path: '/',
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: richTextDoc(
              heading('Welcome to RevealUI'),
              paragraph(
                'RevealUI is an open-source business runtime. Users, content, products, payments, and AI — five primitives, pre-wired into one deployable stack built on React 19, Next.js 16, and TypeScript.',
              ),
              heading('Get Started', 'h3'),
              paragraph(
                'Visit the admin panel at /admin to manage your content, create pages, and configure your application.',
              ),
              heading('Features', 'h3'),
              paragraph(
                'Authentication, real-time collaboration, AI agents, rich text editing, media management, payments, and more — build your business, not your boilerplate.',
              ),
            ),
          },
        ],
      },
    ],
  },
  {
    title: 'About',
    slug: 'about',
    path: '/about',
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: richTextDoc(
              heading('About RevealUI'),
              paragraph(
                'RevealUI is an agentic business runtime that ships with users, content, products, payments, and AI out of the box. Built on React 19, Next.js 16, TypeScript, and Tailwind CSS v4.',
              ),
              paragraph(
                'Designed for TypeScript-first agencies, SaaS builders, and enterprise teams who want to ship faster without sacrificing quality.',
              ),
            ),
          },
        ],
      },
    ],
  },
  {
    title: 'Getting Started',
    slug: 'getting-started',
    path: '/getting-started',
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: richTextDoc(
              heading('Getting Started'),
              paragraph('Follow these steps to set up your RevealUI project.'),
              heading('1. Install Dependencies', 'h3'),
              paragraph('Run pnpm install to install all workspace dependencies.'),
              heading('2. Start Development', 'h3'),
              paragraph('Run pnpm dev to start all development servers.'),
              heading('3. Create Content', 'h3'),
              paragraph(
                'Visit /admin to access the CMS admin panel. From there you can create pages, manage media, and configure your application.',
              ),
            ),
          },
        ],
      },
    ],
  },
];

const sampleContent = {
  contents: [
    {
      name: 'Getting Started',
      description:
        'Welcome to RevealUI — an open-source business runtime. Users, content, products, payments, and AI are pre-wired so you can focus on building your business. Explore the admin panel to manage content and configure your application.',
    },
    {
      name: 'About RevealUI',
      description:
        'RevealUI is an agentic business runtime — users, content, products, payments, and AI in one deployable stack. Built with React 19, Next.js 16, TypeScript, and Tailwind CSS v4, featuring authentication, media management, and real-time collaboration.',
    },
  ],
  cards: [
    {
      name: 'Documentation',
      label: 'Learn More',
      cta: 'View Docs',
      href: '/docs',
      loading: 'eager' as const,
    },
    {
      name: 'Components',
      label: 'UI Library',
      cta: 'Browse Components',
      href: '/components',
      loading: 'lazy' as const,
    },
    {
      name: 'Examples',
      label: 'Code Samples',
      cta: 'View Examples',
      href: '/examples',
      loading: 'lazy' as const,
    },
  ],
  heros: [
    {
      href: 'https://revealui.com',
      altText: 'RevealUI hero image',
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
      name: 'Runtime Features',
      description:
        'Discover all the powerful features RevealUI has to offer: five built-in primitives (users, content, products, payments, AI), React 19 Server Components, TypeScript support, authentication, media management, and more.',
      alt: 'RevealUI runtime features',
    },
  ],
  banners: [
    {
      heading: 'Welcome to RevealUI!',
      subheading: 'Build Your Business',
      description:
        'Build your business, not your boilerplate. RevealUI gives you users, content, products, payments, and AI — five primitives, one runtime.',
      cta: 'Get Started',
      highlight: 'Agentic Business Runtime',
      punctuation: '.',
      alt: 'RevealUI banner image',
      link: { href: '/docs', text: 'Read Documentation' },
      stats: [
        { label: 'React 19', value: 'Latest' },
        { label: 'Next.js', value: '16' },
        { label: 'TypeScript', value: '5.9' },
        { label: 'Packages', value: '50+' },
      ],
    },
  ],
};

// --- Seed Functions ---

async function seedCollection(
  revealui: Awaited<ReturnType<typeof getRevealUI>>,
  collection: string,
  items: Array<Record<string, unknown>>,
  identifierField: string,
  label: string,
) {
  logger.info(`\nSeeding ${label}...`);
  for (const item of items) {
    const identifier = String(item[identifierField]);
    try {
      const existing = await revealui.find({
        collection,
        where: { [identifierField]: { equals: item[identifierField] } } as never,
        limit: 1,
      });

      if (existing.docs && existing.docs.length > 0) {
        logger.info(`   Skipping "${identifier}" (already exists)`);
        continue;
      }

      await revealui.create({ collection, data: item as never });
      logger.success(`   Created: "${identifier}"`);
    } catch (error) {
      logger.error(
        `   Error creating "${identifier}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function getOrCreateDefaultSite(
  revealui: Awaited<ReturnType<typeof getRevealUI>>,
): Promise<string> {
  if (!revealui.db) throw new Error('No database connection');
  const db = getClient();

  // Check for existing site
  const [existingSite] = await db.select({ id: sites.id }).from(sites).limit(1);
  if (existingSite?.id) {
    logger.info(`   Using existing site: ${existingSite.id}`);
    return existingSite.id;
  }

  // Get admin user to set as site owner
  // Check role column first (set by onInit), then fall back to any user
  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'user-super-admin'))
    .limit(1);
  const [anyUser] = adminUser ? [null] : await db.select({ id: users.id }).from(users).limit(1);
  const adminId = adminUser?.id ?? anyUser?.id;
  if (!adminId) throw new Error('Admin user not found — run user seed first');

  // Create a default site
  const siteId = `site_${Date.now()}_default`;
  await db.insert(sites).values({
    id: siteId,
    schemaVersion: '1',
    ownerId: adminId,
    name: 'RevealUI',
    slug: 'revealui',
    status: 'published',
  });
  logger.success(`   Created default site: ${siteId}`);
  return siteId;
}

async function seedPages(revealui: Awaited<ReturnType<typeof getRevealUI>>) {
  const siteId = await getOrCreateDefaultSite(revealui);
  const pagesWithSite = pages.map((p) => ({ ...p, site_id: siteId }));
  await seedCollection(revealui, 'pages', pagesWithSite, 'slug', 'Pages');
}

async function seedContent(revealui: Awaited<ReturnType<typeof getRevealUI>>) {
  await seedCollection(revealui, 'contents', sampleContent.contents, 'name', 'Contents');
  await seedCollection(revealui, 'cards', sampleContent.cards, 'name', 'Cards');
  await seedCollection(revealui, 'heros', sampleContent.heros, 'href', 'Heros');
  await seedCollection(revealui, 'events', sampleContent.events, 'title', 'Events');
  await seedCollection(revealui, 'banners', sampleContent.banners, 'heading', 'Banners');
}

// --- Main ---

async function main() {
  try {
    const args = process.argv.slice(2);
    const pagesOnly = args.includes('--pages-only');
    const contentOnly = args.includes('--content-only');

    logger.header('RevealUI Seed');
    logger.info('Initializing CMS...\n');

    const revealuiConfig = await config;
    const revealui = await getRevealUI({ config: revealuiConfig });

    if (!contentOnly) {
      await seedPages(revealui);
    }

    if (!pagesOnly) {
      await seedContent(revealui);
    }

    logger.success('\nSeeding completed!');

    if (!contentOnly) {
      logger.info('\nPages:');
      for (const page of pages) {
        logger.info(`   /${page.slug} — ${page.title}`);
      }
    }

    logger.info('\nNext steps:');
    logger.info('   1. Visit /admin to manage content');
    logger.info('   2. Visit / to see the home page');
    logger.info('   3. Add images via Media collection\n');
  } catch (error) {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

main();

export { pages, sampleContent, seedContent, seedPages };
