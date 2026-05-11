#!/usr/bin/env tsx

/**
 * Seed Script  -  Seeds all initial CMS content
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
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger, getProjectRoot } from '@revealui/scripts/index.js';

const logger = createLogger();

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
    _status: 'published' as const,
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: richTextDoc(
              heading('Stop building the backend. Ship the AI business.'),
              paragraph(
                'Auth, billing, content, and agents - wired, audited, yours. Five primitives, one audit log, one policy plane. From npx create-revealui to first paying customer in a weekend.',
              ),
              heading('Why RevealUI?', 'h3'),
              paragraph(
                'Every action by every human and every agent is RBAC-gated, ABAC-checked, and signed into a tamper-evident audit chain. The same primitives the runtime exposes to your team are auto-exposed to your agents via MCP. One contract, two audiences.',
              ),
              heading('Get Started', 'h3'),
              paragraph(
                'Run npx create-revealui to scaffold a new project. Visit /admin to manage content, create pages, and configure your application. 24 of 26 packages are MIT - forever; the 2 Pro packages convert to MIT after 2 years.',
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
    _status: 'published' as const,
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: richTextDoc(
              heading('About RevealUI'),
              paragraph(
                'RevealUI is an agentic business runtime. Instead of bolting together auth, payments, CMS, and AI from different vendors, RevealUI ships them as one coherent stack  -  pre-wired, tested, and ready to deploy.',
              ),
              paragraph(
                'Built on React 19, Next.js 16, TypeScript, and Tailwind CSS v4. Designed for product teams who ship fast and founders who build alone.',
              ),
              heading('Open Source + Pro', 'h3'),
              paragraph(
                'The core runtime is MIT-licensed. AI agents and harnesses are Fair Source (FSL-1.1-MIT)  -  free for single-product use, commercially licensed for platforms, converting to MIT after two years.',
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
    _status: 'published' as const,
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
        'Static dashboards and manual workflows are finished. What replaces them are adaptive runtimes where humans and agents work on the same data, the same permissions, and the same business logic. RevealUI is the runtime for that transition.',
    },
    {
      name: 'Five Primitives. One Audit Log. One Policy Plane.',
      description:
        'Users. Content. Products. Payments. Intelligence. Every action by every human and every agent is RBAC-gated, ABAC-checked, and signed into a tamper-evident audit chain. Define once; both audiences operate immediately.',
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
      altText: 'RevealUI  -  agentic business runtime',
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
        'You build the product. Agents extend it. Bring your own model: default ships open-weight (Llama 4, Gemma 3, Qwen 3, DeepSeek R1) so the inference bill does not scale with usage; switch to Claude or GPT in one config line. The runtime is provider-agnostic.',
      alt: 'RevealUI agentic vision',
    },
  ],
  banners: [
    {
      heading: 'Stop building the backend. Ship the AI business.',
      subheading: 'Open-source. Self-hostable. Audit-grade.',
      description:
        'Auth, billing, content, and agents - wired, audited, yours. Five primitives, one audit log, one policy plane. From npx create-revealui to first paying customer in a weekend.',
      cta: 'Get Started',
      highlight: 'Open Source',
      punctuation: '.',
      alt: 'RevealUI banner',
      link: { href: '/getting-started', text: 'Start Building' },
      stats: [
        { label: 'Packages', value: '26' },
        { label: 'MCP Servers', value: '13' },
        { label: 'UI Components', value: '58' },
        { label: 'MIT', value: '24/26' },
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
        where: { [identifierField]: { equals: item[identifierField] } },
        limit: 1,
      });

      if (existing.docs && existing.docs.length > 0) {
        logger.info(`   Skipping "${identifier}" (already exists)`);
        continue;
      }

      await revealui.create({ collection, data: item });
      logger.success(`   Created: "${identifier}"`);
    } catch (error) {
      logger.error(
        `   Error creating "${identifier}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function seedPages(revealui: Awaited<ReturnType<typeof getRevealUI>>) {
  await seedCollection(revealui, 'pages', pages, 'slug', 'Pages');
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
    const _projectRoot = await getProjectRoot(import.meta.url);
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
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();

export { pages, sampleContent, seedContent, seedPages };
