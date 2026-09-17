import { createCachedFunction } from '@revealui/cache';
import type { RevealDocument } from '@revealui/core';
import { getClient } from '@revealui/db';
import {
  getGlobalFooter,
  getGlobalHeader,
  getGlobalSettings,
  isGlobalSlug,
} from '@revealui/db/queries/globals';
import { logger } from '@revealui/utils/logger';

type HeaderRow = NonNullable<Awaited<ReturnType<typeof getGlobalHeader>>>;
type FooterRow = NonNullable<Awaited<ReturnType<typeof getGlobalFooter>>>;
type SettingsRow = NonNullable<Awaited<ReturnType<typeof getGlobalSettings>>>;

type Global = string;

function iso(value: Date | string | null | undefined): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return undefined;
}

/** Map drizzle `global_header.nav_items` into the CMS Header `navItems.link` shape. */
export function headerToCms(row: HeaderRow): RevealDocument {
  const navItems = (row.navItems ?? []).map((item) => ({
    link: {
      type: 'custom' as const,
      label: item.label,
      url: item.url,
      newTab: item.newTab ?? false,
    },
  }));
  return {
    id: row.id,
    navItems,
    logoId: row.logoId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** Flatten drizzle footer columns into the CMS Footer `navItems.link` shape. */
export function footerToCms(row: FooterRow): RevealDocument {
  const navItems = (row.columns ?? []).flatMap((column) =>
    (column.links ?? []).map((link) => ({
      link: {
        type: 'custom' as const,
        label: link.label,
        url: link.url,
        newTab: link.newTab ?? false,
      },
    })),
  );
  return {
    id: row.id,
    navItems,
    copyright: row.copyright,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function settingsToCms(row: SettingsRow): RevealDocument {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/**
 * Read a registered global from the drizzle singleton tables (`id = '1'`).
 * Do not use RevealUIGlobal / `id = global_${slug}` inserts (F-089-0009).
 *
 * `depth` stays on the cache key for callers; relationship populate is not
 * applied (Header/Footer only need jsonb fields).
 */
export async function loadGlobal(slug: Global, _depth = 0): Promise<RevealDocument | null> {
  if (!isGlobalSlug(slug)) {
    logger.warn(`Global '${slug}' is not a registered drizzle global`);
    return null;
  }

  try {
    const db = getClient();
    switch (slug) {
      case 'header': {
        const row = await getGlobalHeader(db);
        return row ? headerToCms(row) : null;
      }
      case 'footer': {
        const row = await getGlobalFooter(db);
        return row ? footerToCms(row) : null;
      }
      case 'settings': {
        const row = await getGlobalSettings(db);
        return row ? settingsToCms(row) : null;
      }
    }
  } catch (error) {
    logger.warn(`Global '${slug}' not found or database client failed`, {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Returns a cached function mapped with the cache tag for the slug
 * (GAP-194 3.7a: @revealui/cache, not next/cache unstable_cache).
 */
export const getCachedGlobal = (slug: Global, depth = 0) =>
  createCachedFunction(async () => loadGlobal(slug, depth), {
    keyParts: ['global', String(slug), String(depth)],
    tags: [`global_${String(slug)}`],
  });
