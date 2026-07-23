#!/usr/bin/env tsx

/**
 * Seed the fleet-marketing `sites` row plus its published marketing pages
 * (home, products, philosophy, local-ai, fair-source, services,
 * for-operators-how-it-works) for the visual-edit-sessions block wire.
 *
 * The page `blocks` come from the SAME pure derivation the marketing app falls
 * back to (`apps/marketing/app/lib/page-blocks.ts`), so the seeded CMS content
 * and the site's static fallback can never drift: both are derived from the
 * claim-covered content modules.
 *
 * Idempotent: the site row is inserted once; each page is inserted if missing,
 * updated (with an optimistic version guard) only when its blocks changed, and
 * skipped when its blocks already match. Soft-deleted pages are surfaced, never
 * silently resurrected.
 *
 * Database / owner resolution (durable — see scripts/lib/seed-env.ts):
 *   - POSTGRES_URL preferred over DATABASE_URL; process env wins over dotenv files
 *   - electric-latency-probe DB (5434 / revealui_probe) is refused unless
 *     REVEALUI_ALLOW_PROBE_DB=1
 *   - Site owner email: REVEALUI_SEED_OWNER_EMAIL → revvault bootstrap email →
 *     founder@revealui.com → first active owner/admin user
 *
 * Usage:
 *   pnpm db:seed:fleet-marketing
 *   pnpm tsx scripts/seed-fleet-marketing-site.ts -- --dry-run
 *   POSTGRES_URL=postgresql://…@127.0.0.1:5432/revealui pnpm db:seed:fleet-marketing
 *
 * Spec: the internal visual-edit-sessions spec (2026-07-02); Phase A.2 row A2.
 */

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  fairSourceBlocks,
  foHiwBlocks,
  homeBlocks,
  localAiBlocks,
  philosophyBlocks,
  productsBlocks,
  servicesBlocks,
} from '../apps/marketing/app/lib/page-blocks';
import {
  assertSeedDatabaseReady,
  loadSeedEnv,
  resolveSeedOwnerEmailCandidates,
  SeedEnvError,
  tryReadBootstrapEmailFromRevvault,
} from './lib/seed-env.js';

const rootDir = resolve(import.meta.dirname, '..');
loadSeedEnv(rootDir);

const SITE_ID = 'fleet-marketing';

const log = {
  info: (msg: string) => console.log(`  i ${msg}`),
  success: (msg: string) => console.log(`  + ${msg}`),
  warn: (msg: string) => console.log(`  ! ${msg}`),
  error: (msg: string) => console.error(`  x ${msg}`),
};

interface PageSeed {
  readonly slug: string;
  readonly path: string;
  readonly title: string;
  readonly blocks: unknown[];
  readonly seo: { title: string; description: string };
}

const PAGE_SEEDS: readonly PageSeed[] = [
  {
    slug: 'home',
    path: '/',
    title: 'Home',
    blocks: homeBlocks(),
    seo: {
      title: 'RevealUI',
      description: 'Agentic business runtime. People, content, offers, payments, and agents.',
    },
  },
  {
    slug: 'products',
    path: '/products',
    title: 'Products',
    blocks: productsBlocks(),
    seo: {
      title: 'The RevFleet product family',
      description: 'Seven products on one foundation, all built and operated by RevealUI Studio.',
    },
  },
  {
    slug: 'philosophy',
    path: '/philosophy',
    title: 'Philosophy',
    blocks: philosophyBlocks(),
    seo: {
      title: 'Philosophy | RevealUI',
      description: 'Software that compounds. Why RevealUI exists.',
    },
  },
  {
    slug: 'local-ai',
    path: '/local-ai',
    title: 'Local-first AI',
    blocks: localAiBlocks(),
    seo: {
      title: 'Local-first AI | RevealUI',
      description:
        'Run your AI on infrastructure you own. Open-weight default, frontier one config line away.',
    },
  },
  {
    slug: 'fair-source',
    path: '/fair-source',
    title: 'Fair Source',
    blocks: fairSourceBlocks(),
    seo: {
      title: 'Fair Source | RevealUI',
      description:
        'Source-visible. Commercially usable. MIT in two years. The license contract for RevealUI Pro packages.',
    },
  },
  {
    slug: 'services',
    path: '/services',
    title: 'Services',
    blocks: servicesBlocks(),
    seo: {
      title: 'Services | RevealUI',
      description:
        'Done-for-you software with AI built in. Discovery, fixed-scope engagement, delivered by the team that builds the runtime.',
    },
  },
  {
    slug: 'for-operators-how-it-works',
    path: '/for-operators/how-it-works',
    title: 'How the engagement works',
    blocks: foHiwBlocks(),
    seo: {
      title: 'How the engagement works | RevealUI',
      description:
        'Discovery, fixed-scope proposal, build, and handoff. Weeks, not quarters. How RevealUI Studio delivers operator software.',
    },
  },
];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    log.warn('DRY RUN — no writes will be made');
  }

  const { url, target } = await assertSeedDatabaseReady();
  log.info(`Database ${target.host}:${target.port}/${target.database} (POSTGRES_URL preferred)`);
  // Ensure getClient sees the same URL we validated.
  process.env.POSTGRES_URL = url;

  const { getClient } = await import('@revealui/db/client');
  const { users, sites, pages } = await import('@revealui/db/schema');
  const { and, eq, inArray } = await import('drizzle-orm');

  const db = getClient('rest');

  // ---------------------------------------------------------------------------
  // Site row — owner resolution (env → revvault bootstrap email → founder → role)
  // ---------------------------------------------------------------------------

  const revvaultEmail = tryReadBootstrapEmailFromRevvault(
    process.env.REVEALUI_ENV === 'production' || process.env.NODE_ENV === 'production'
      ? 'prod'
      : 'dev',
  );
  const emailCandidates = resolveSeedOwnerEmailCandidates({ revvaultEmail });

  let ownerId: string | undefined;
  let ownerEmail: string | undefined;
  let ownerSource: string | undefined;

  for (const email of emailCandidates) {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (rows.length > 0 && rows[0].email) {
      ownerId = rows[0].id;
      ownerEmail = rows[0].email;
      ownerSource =
        email === process.env.REVEALUI_SEED_OWNER_EMAIL
          ? 'REVEALUI_SEED_OWNER_EMAIL'
          : email === revvaultEmail
            ? 'revvault bootstrap email'
            : 'seed default founder@revealui.com';
      break;
    }
  }

  if (!(ownerId && ownerEmail)) {
    const roleRows = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(inArray(users.role, ['owner', 'admin']))
      .limit(5);
    const usable = roleRows.find((r) => typeof r.email === 'string' && r.email.length > 0);
    if (usable?.email) {
      log.warn(
        `No seed owner matched ${emailCandidates.join(' | ')}. ` +
          `Using first ${usable.role} user ${usable.email}. ` +
          'Set REVEALUI_SEED_OWNER_EMAIL or run pnpm admin:bootstrap for a stable owner.',
      );
      ownerId = usable.id;
      ownerEmail = usable.email;
      ownerSource = `fallback role=${usable.role}`;
    }
  }

  if (!(ownerId && ownerEmail)) {
    throw new SeedEnvError(
      [
        'No site owner user found for fleet-marketing seed.',
        `  looked for emails: ${emailCandidates.join(', ')}`,
        '  also looked for any user with role owner|admin',
        '',
        'Fix:',
        '  pnpm admin:bootstrap -- --env=dev --force --no-seed',
        '  # or: REVEALUI_SEED_OWNER_EMAIL=<existing-user-email> pnpm db:seed:fleet-marketing',
      ].join('\n'),
    );
  }

  log.info(`Resolved ownerId for ${ownerEmail} (${ownerSource}): ${ownerId}`);

  const existingSite = await db
    .select({ id: sites.id, slug: sites.slug, status: sites.status })
    .from(sites)
    .where(eq(sites.id, SITE_ID))
    .limit(1);

  const now = new Date();

  if (existingSite.length > 0) {
    const row = existingSite[0];
    log.info('Site already seeded, skipping.');
    log.info(`  id:     ${row.id}`);
    log.info(`  slug:   ${row.slug}`);
    log.info(`  status: ${row.status}`);
  } else {
    const siteRow = {
      id: SITE_ID,
      ownerId,
      name: 'RevealUI fleet marketing',
      slug: 'fleet-marketing',
      description: 'revealui.com customer-facing copy',
      status: 'published' as const,
      theme: { brand: 'revealui-fleet' },
      settings: {
        cacheStrategy: 'edge-tag',
        voiceProfile: 'fleet',
        aiGeneration: {
          provider: 'inference-snaps',
          model: 'gemma3',
          embedModel: 'gemma3',
        },
      },
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (dryRun) {
      log.info('Would insert site:');
      log.info(JSON.stringify(siteRow, null, 2));
    } else {
      await db.insert(sites).values(siteRow).onConflictDoNothing({ target: sites.id });
      const inserted = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, SITE_ID))
        .limit(1);
      if (inserted.length === 0) {
        log.error('Site insert reported no conflict but row is not present — unexpected state.');
        process.exit(1);
      }
      log.success('Seeded fleet-marketing site row.');
    }
  }

  // ---------------------------------------------------------------------------
  // Pages (home + products + philosophy + local-ai + fair-source + services + how-it-works) — version-safe, idempotent
  // ---------------------------------------------------------------------------

  for (const seed of PAGE_SEEDS) {
    const existing = await db
      .select({
        id: pages.id,
        version: pages.version,
        blocks: pages.blocks,
        status: pages.status,
        deletedAt: pages.deletedAt,
      })
      .from(pages)
      .where(and(eq(pages.siteId, SITE_ID), eq(pages.slug, seed.slug)))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      if (row.deletedAt) {
        log.warn(`Page "${seed.slug}" exists but is soft-deleted (id ${row.id}).`);
        log.warn('Not resurrecting automatically — restore or hard-delete it deliberately.');
        continue;
      }

      const currentJson = JSON.stringify(row.blocks ?? []);
      const desiredJson = JSON.stringify(seed.blocks);
      if (currentJson === desiredJson) {
        log.info(`Page "${seed.slug}" already up to date (v${row.version}), skipping.`);
        continue;
      }

      if (dryRun) {
        log.info(
          `Would update page "${seed.slug}" blocks (v${row.version} -> v${row.version + 1}).`,
        );
        continue;
      }

      // Optimistic version guard: only write if the row hasn't changed since read.
      const updated = await db
        .update(pages)
        .set({
          blocks: seed.blocks,
          blockCount: seed.blocks.length,
          version: row.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(pages.id, row.id), eq(pages.version, row.version)))
        .returning({ id: pages.id });

      if (updated.length === 0) {
        log.error(`Page "${seed.slug}" changed concurrently (version moved past ${row.version}).`);
        log.error('Re-run the seed to reconcile.');
        process.exit(1);
      }
      log.success(`Updated page "${seed.slug}" blocks -> v${row.version + 1}.`);
      continue;
    }

    const pageRow = {
      id: `rvl_${randomUUID()}`,
      siteId: SITE_ID,
      title: seed.title,
      slug: seed.slug,
      path: seed.path,
      status: 'published',
      blocks: seed.blocks,
      blockCount: seed.blocks.length,
      seo: seed.seo,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (dryRun) {
      log.info(`Would insert page "${seed.slug}":`);
      log.info(JSON.stringify(pageRow, null, 2));
      continue;
    }

    await db.insert(pages).values(pageRow).onConflictDoNothing();
    const inserted = await db
      .select({ id: pages.id, status: pages.status })
      .from(pages)
      .where(and(eq(pages.siteId, SITE_ID), eq(pages.slug, seed.slug)))
      .limit(1);
    if (inserted.length === 0) {
      log.error(`Page "${seed.slug}" insert reported no conflict but row is not present.`);
      process.exit(1);
    }
    log.success(`Seeded page "${seed.slug}" (${inserted[0].status}).`);
  }

  if (dryRun) {
    log.success('Dry run complete — no writes made.');
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof SeedEnvError) {
    log.error(error.message);
    process.exit(1);
  }
  log.error(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    log.error(error.stack);
  }
  process.exit(1);
}
