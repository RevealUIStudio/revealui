#!/usr/bin/env tsx

/**
 * Seed Script  -  Seeds all initial admin content
 *
 * Creates pages (and only collections that are registered with a backing table).
 * Pages are seeded first because the frontend root URL (/) queries for
 * slug='home'  -  without it, new users see a 404 after signup.
 *
 * All seed operations are idempotent (checks for existing entries before creating).
 *
 * Durable rules:
 *   - Env via scripts/lib/seed-env.ts (direnv passwordless demotion + preflight)
 *   - CLI creates use overrideAccess: true (no interactive admin session)
 *   - Empty DB requires REVEALUI_ADMIN_EMAIL + REVEALUI_ADMIN_PASSWORD (≥12 chars)
 *   - contents/events are NOT seeded: not in allCollections (no Postgres tables)
 *
 * Usage:
 *   pnpm db:seed                    # Seed everything
 *   pnpm db:seed -- --pages-only    # Seed pages only
 *   pnpm db:seed -- --content-only  # No-op notice (legacy collections unregistered)
 */

import config from '@reveal-config';
import { getRevealUI } from '@revealui/core';
import { getClient } from '@revealui/db';
import { sites, users } from '@revealui/db/schema';
import { eq, or } from 'drizzle-orm';
import {
  assertSeedDatabaseReady,
  loadSeedEnv,
  SeedEnvError,
} from '../../../scripts/lib/seed-env.js';

// pnpm db:seed:admin runs from monorepo root; seed-env loads apps/admin/.env.local
// and demotes passwordless direnv/Nix POSTGRES_URL placeholders.
loadSeedEnv(process.cwd());

const logger = {
  header: (msg: string) =>
    process.stdout.write(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}\n`),
  info: (msg: string) => process.stdout.write(`${msg}\n`),
  success: (msg: string) => process.stdout.write(`\x1b[32m${msg}\x1b[0m\n`),
  error: (msg: string) => process.stderr.write(`\x1b[31m${msg}\x1b[0m\n`),
  warn: (msg: string) => process.stderr.write(`\x1b[33m${msg}\x1b[0m\n`),
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
              heading('Stop building the backend. Ship the AI business.'),
              paragraph(
                'Auth, billing, content, and agents - wired, audited, yours. Five primitives for you and your AI agents, governed by one RBAC + ABAC policy and signed into one tamper-evident audit chain.',
              ),
              heading('Why RevealUI?', 'h3'),
              paragraph(
                'You define your business data once. The admin UI, REST API, and MCP tools all appear simultaneously. Humans manage through the dashboard. Agents operate through the same API. Same permissions, same audit trail, same policy plane.',
              ),
              heading('Get Started', 'h3'),
              paragraph(
                'Run npx create-revealui to scaffold a new project. Visit /admin to manage content, create pages, and configure your application. 20 of 26 packages are MIT - forever; the 5 Pro packages convert to MIT after 2 years.',
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
                'The core runtime is MIT-licensed. The 5 Pro packages (ai, engines, harnesses, mcp, services) are Fair Source (FSL-1.1-MIT), free for single-product use, commercially licensed for platforms, converting to MIT after two years.',
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

/**
 * Legacy sample rows for collections that are intentionally unregistered
 * (no Postgres table yet). Kept for reference when wire-up lands; not seeded.
 * See apps/admin/src/lib/collections/registry.ts WIRE-UP-PENDING.
 */
const sampleContent = {
  contents: [
    {
      name: 'The Adaptive Runtime Playbook',
      description:
        'Static dashboards and manual workflows are finished. What replaces them are adaptive runtimes: products where humans and agents work on the same data, the same permissions, and the same business logic. RevealUI is the runtime for that transition.',
    },
    {
      name: 'Five Primitives. One Audit Log. One Policy Plane.',
      description:
        'Users. Content. Products. Payments. Intelligence. Every action by every human and every agent is RBAC-gated, ABAC-checked, and signed into a tamper-evident audit chain. Define once; both audiences operate immediately.',
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
};

interface SeedCollectionResult {
  created: number;
  skipped: number;
  failed: number;
}

// --- Seed Functions ---

/**
 * When the users table is empty, onInit will try to bootstrap the first admin.
 * Fail closed here so we do not continue into page creates that look "done"
 * while bootstrap silently no-ops on a short/missing password.
 */
async function assertBootstrapCredentialsIfEmptyUsers(): Promise<void> {
  const db = getClient();
  const [existing] = await db.select({ id: users.id }).from(users).limit(1);
  if (existing) return;

  const email = process.env.REVEALUI_ADMIN_EMAIL?.trim() ?? '';
  const password = process.env.REVEALUI_ADMIN_PASSWORD ?? '';

  if (!(email && password)) {
    throw new SeedEnvError(
      [
        'No users in the database and bootstrap credentials are incomplete.',
        '  Set both REVEALUI_ADMIN_EMAIL and REVEALUI_ADMIN_PASSWORD (apps/admin/.env.local or revvault).',
        '  Password must be at least 12 characters.',
        '  Then re-run: pnpm db:seed:admin',
      ].join('\n'),
    );
  }

  if (password.length < 12) {
    throw new SeedEnvError(
      [
        `REVEALUI_ADMIN_PASSWORD is set but only ${password.length} character(s); minimum is 12.`,
        '  onInit will refuse first-admin create with the same rule.',
        '  Fix the password in apps/admin/.env.local (or revvault), then re-run pnpm db:seed:admin.',
      ].join('\n'),
    );
  }
}

async function seedCollection(
  revealui: Awaited<ReturnType<typeof getRevealUI>>,
  collection: string,
  items: Array<Record<string, unknown>>,
  identifierField: string,
  label: string,
): Promise<SeedCollectionResult> {
  logger.info(`\nSeeding ${label}...`);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const identifier = String(item[identifierField]);
    try {
      // CLI seed has no interactive session — same override as first-admin bootstrap.
      const existing = await revealui.find({
        collection,
        where: { [identifierField]: { equals: item[identifierField] } } as never,
        limit: 1,
        overrideAccess: true,
      });

      if (existing.docs && existing.docs.length > 0) {
        logger.info(`   Skipping "${identifier}" (already exists)`);
        skipped++;
        continue;
      }

      await revealui.create({
        collection,
        data: item as never,
        overrideAccess: true,
      });
      logger.success(`   Created: "${identifier}"`);
      created++;
    } catch (error) {
      failed++;
      logger.error(
        `   Error creating "${identifier}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { created, skipped, failed };
}

async function getOrCreateDefaultSite(
  revealui: Awaited<ReturnType<typeof getRevealUI>>,
): Promise<string> {
  if (!revealui.db) throw new Error('No database connection');
  const db = getClient();

  // Prefer a dedicated default site slug if present; else first site (often fleet-marketing in dogfood).
  const [named] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.slug, 'revealui'))
    .limit(1);
  if (named?.id) {
    logger.info(`   Using existing site: ${named.id} (slug=revealui)`);
    return named.id;
  }

  const [existingSite] = await db.select({ id: sites.id, slug: sites.slug }).from(sites).limit(1);
  if (existingSite?.id) {
    logger.info(`   Using existing site: ${existingSite.id} (slug=${existingSite.slug ?? '?'})`);
    return existingSite.id;
  }

  // role column is owner/admin/editor/... — app "super-admin" lives in roles[], not role.
  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.role, 'owner'), eq(users.role, 'admin')))
    .limit(1);
  const [anyUser] = adminUser ? [null] : await db.select({ id: users.id }).from(users).limit(1);
  const adminId = adminUser?.id ?? anyUser?.id;
  if (!adminId) {
    throw new SeedEnvError(
      'No user found to own a new default site. Bootstrap an admin user first ' +
        '(REVEALUI_ADMIN_EMAIL + REVEALUI_ADMIN_PASSWORD ≥12), then re-run.',
    );
  }

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

async function seedPages(
  revealui: Awaited<ReturnType<typeof getRevealUI>>,
): Promise<SeedCollectionResult> {
  const siteId = await getOrCreateDefaultSite(revealui);
  const pagesWithSite = pages.map((p) => ({ ...p, site_id: siteId }));
  return seedCollection(revealui, 'pages', pagesWithSite, 'slug', 'Pages');
}

/**
 * contents / events are WIRE-UP-PENDING (registry omits them; no tables).
 * Seeding them always produced "Collection not found" — gate closed here.
 */
function seedContentNotice(): void {
  logger.info('\nContents / Events: skipped (not registered)');
  logger.info(
    '  apps/admin collections registry omits contents/events until Postgres tables exist',
  );
  logger.info('  (see registry.ts WIRE-UP-PENDING). Re-enable seed when those land.');
}

// --- Main ---

async function main() {
  try {
    const args = process.argv.slice(2);
    const pagesOnly = args.includes('--pages-only');
    const contentOnly = args.includes('--content-only');

    logger.header('RevealUI Seed');
    logger.info('Initializing admin...\n');

    const { target } = await assertSeedDatabaseReady();
    logger.info(`Database ${target.host}:${target.port}/${target.database}\n`);

    await assertBootstrapCredentialsIfEmptyUsers();

    const revealuiConfig = await config;
    const revealui = await getRevealUI({ config: revealuiConfig });

    let pageResult: SeedCollectionResult = { created: 0, skipped: 0, failed: 0 };

    if (!contentOnly) {
      pageResult = await seedPages(revealui);
    }

    if (!pagesOnly) {
      seedContentNotice();
    }

    if (pageResult.failed > 0) {
      throw new SeedEnvError(
        `Admin page seed finished with ${pageResult.failed} failure(s) ` +
          `(created=${pageResult.created}, skipped=${pageResult.skipped}). ` +
          'Fix the errors above and re-run pnpm db:seed:admin.',
      );
    }

    logger.success('\nSeeding completed!');

    if (!contentOnly) {
      logger.info(
        `Pages: created=${pageResult.created} skipped=${pageResult.skipped} failed=${pageResult.failed}`,
      );
      for (const page of pages) {
        logger.info(`   /${page.slug} — ${page.title}`);
      }
    }

    logger.info('\nNext steps:');
    logger.info('   1. Visit /admin to manage content');
    logger.info('   2. Visit / to see the home page');
    logger.info('   3. Add images via Media collection\n');
  } catch (error) {
    if (error instanceof SeedEnvError) {
      logger.error(error.message);
      process.exit(1);
    }
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

main();

export { pages, sampleContent, seedContentNotice as seedContent, seedPages };
