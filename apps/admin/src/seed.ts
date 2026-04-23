#!/usr/bin/env tsx

/**
 * Seed Script  -  Seeds all initial admin content
 *
 * Creates pages, sample content, cards, heros, events, and banners.
 * Pages are seeded first because the frontend root URL (/) queries for
 * slug='home'  -  without it, new users see a 404 after signup.
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
              heading('Build for Humans. Ready for Agents.'),
              paragraph(
                'RevealUI is an agentic business runtime. Users, content, products, payments, and intelligence: five primitives for you and your AI agents, pre-wired into one deployable stack.',
              ),
              heading('Why RevealUI?', 'h3'),
              paragraph(
                'You define your business data once. The admin UI, REST API, and MCP tools all appear simultaneously. Humans manage through the dashboard. Agents operate through the same API. Same permissions, same audit trail.',
              ),
              heading('Get Started', 'h3'),
              paragraph(
                'Run npx create-revealui to scaffold a new project. Visit /admin to manage content, create pages, and configure your application. Your agents can discover and use everything you build from day one.',
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
                'RevealUI is an agentic business runtime. Instead of bolting together auth, payments, admin, and AI from different vendors, RevealUI ships them as one coherent stack, pre-wired for human builders and AI agents alike.',
              ),
              paragraph(
                'Built on React 19, Next.js 16, TypeScript, and Tailwind CSS v4. Every feature works for you and is accessible to your agents. One runtime, one set of permissions, one audit trail.',
              ),
              heading('Open Source + Pro', 'h3'),
              paragraph(
                'The core runtime is MIT-licensed. AI agents and harnesses are Fair Source (FSL-1.1-MIT), free for single-product use, commercially licensed for platforms, converting to MIT after two years.',
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
              paragraph('Three commands from zero to running application.'),
              heading('1. Scaffold', 'h3'),
              paragraph(
                'Run npx create-revealui my-app to create a new project with everything pre-configured.',
              ),
              heading('2. Start', 'h3'),
              paragraph(
                'Run pnpm dev to start the admin dashboard, API, and frontend in parallel.',
              ),
              heading('3. Build', 'h3'),
              paragraph(
                'Visit /admin to create pages, manage content, configure products and pricing. Your first customer can sign up immediately.',
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
      name: 'The Adaptive Runtime Playbook',
      description:
        'Static dashboards and manual workflows are finished. What replaces them are adaptive runtimes: products where humans and agents work on the same data, the same permissions, and the same business logic. RevealUI is the runtime for that transition.',
    },
    {
      name: 'Five Primitives, One Stack',
      description:
        'Users. Content. Products. Payments. Intelligence. Every business application needs these five primitives. RevealUI pre-wires them for humans and agents alike. Define once, both layers operate immediately.',
    },
  ],
  cards: [
    {
      name: 'Quick Start',
      label: 'Get Running',
      cta: 'npx create-revealui',
      href: '/getting-started',
      loading: 'eager' as const,
    },
    {
      name: 'Documentation',
      label: 'Learn More',
      cta: 'Read the Docs',
      href: '/docs',
      loading: 'lazy' as const,
    },
    {
      name: 'Pro Tier',
      label: 'AI Agents',
      cta: 'Explore Pro',
      href: '/docs/pro',
      loading: 'lazy' as const,
    },
  ],
  heros: [
    {
      href: 'https://revealui.com',
      altText: 'RevealUI, agentic business runtime',
      video: 'https://revealui.com',
    },
  ],
  events: [
    {
      title: 'LAUNCH',
      name: 'RevealUI is Open Source',
      description:
        'The core runtime is MIT-licensed and available on npm. Built with TypeScript strict mode, extensive test coverage, and zero avoidable type errors. Run npx create-revealui to start building.',
      alt: 'RevealUI open source launch',
    },
    {
      title: 'VISION',
      name: 'Agentic Business Runtime',
      description:
        'You build the product. Agents extend it. Neither is locked to any vendor. RevealUI ships with AI agents that operate on your business data through the same API humans use, all running on open-source models.',
      alt: 'RevealUI agentic vision',
    },
  ],
  banners: [
    {
      heading: 'Build for Humans. Ready for Agents.',
      subheading: 'Agentic Business Runtime',
      description:
        'Five primitives for you and your AI agents: users, content, products, payments, and intelligence. One runtime, one deployment.',
      cta: 'Get Started',
      highlight: 'Open Source',
      punctuation: '.',
      alt: 'RevealUI banner',
      link: { href: '/getting-started', text: 'Start Building' },
      stats: [
        { label: 'Packages', value: '22' },
        { label: 'Tests', value: '20,000+' },
        { label: 'License', value: 'MIT' },
        { label: 'AI Agents', value: 'Pro' },
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
    .where(eq(users.role, 'super-admin'))
    .limit(1);
  const [anyUser] = adminUser ? [null] : await db.select({ id: users.id }).from(users).limit(1);
  const adminId = adminUser?.id ?? anyUser?.id;
  if (!adminId) throw new Error('Admin user not found, run user seed first');

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
    logger.info('Initializing admin...\n');

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
