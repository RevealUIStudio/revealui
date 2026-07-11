/**
 * Global database queries
 *
 * Globals are single-row configuration tables (`global_header`,
 * `global_footer`, `global_settings`). Each holds exactly one row; the get
 * helpers read it and the update helpers upsert it. Typed Drizzle access keeps
 * these off the engine's dynamic-SQL path.
 */

import { eq } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import {
  type GlobalFooter,
  type GlobalHeader,
  type GlobalSettings,
  globalFooter,
  globalHeader,
  globalSettings,
  type NewGlobalFooter,
  type NewGlobalHeader,
  type NewGlobalSettings,
} from '../schema/admin.js';

/** The globals exposed over the content API, in URL-slug form. */
export const GLOBAL_SLUGS = ['header', 'footer', 'settings'] as const;
export type GlobalSlug = (typeof GLOBAL_SLUGS)[number];

/** Type guard for the closed set of global slugs. */
export function isGlobalSlug(value: string): value is GlobalSlug {
  return (GLOBAL_SLUGS as readonly string[]).includes(value);
}

/** Default id for the singleton rows (schema default is '1'). */
const SINGLETON_ID = '1';

export async function getGlobalHeader(db: Database): Promise<GlobalHeader | undefined> {
  const rows = await db.select().from(globalHeader).limit(1);
  return rows[0];
}

export async function getGlobalFooter(db: Database): Promise<GlobalFooter | undefined> {
  const rows = await db.select().from(globalFooter).limit(1);
  return rows[0];
}

export async function getGlobalSettings(db: Database): Promise<GlobalSettings | undefined> {
  const rows = await db.select().from(globalSettings).limit(1);
  return rows[0];
}

export async function updateGlobalHeader(
  db: Database,
  data: Partial<Omit<NewGlobalHeader, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<GlobalHeader> {
  const existing = await getGlobalHeader(db);
  if (existing) {
    const rows = await db
      .update(globalHeader)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(globalHeader.id, existing.id))
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: update of an existing row returns it
    return rows[0]!;
  }
  const rows = await db
    .insert(globalHeader)
    .values({ id: SINGLETON_ID, ...data })
    .returning();
  // biome-ignore lint/style/noNonNullAssertion: insert always returns the created row
  return rows[0]!;
}

export async function updateGlobalFooter(
  db: Database,
  data: Partial<Omit<NewGlobalFooter, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<GlobalFooter> {
  const existing = await getGlobalFooter(db);
  if (existing) {
    const rows = await db
      .update(globalFooter)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(globalFooter.id, existing.id))
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: update of an existing row returns it
    return rows[0]!;
  }
  const rows = await db
    .insert(globalFooter)
    .values({ id: SINGLETON_ID, ...data })
    .returning();
  // biome-ignore lint/style/noNonNullAssertion: insert always returns the created row
  return rows[0]!;
}

export async function updateGlobalSettings(
  db: Database,
  data: Partial<Omit<NewGlobalSettings, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<GlobalSettings> {
  const existing = await getGlobalSettings(db);
  if (existing) {
    const rows = await db
      .update(globalSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(globalSettings.id, existing.id))
      .returning();
    // biome-ignore lint/style/noNonNullAssertion: update of an existing row returns it
    return rows[0]!;
  }
  const rows = await db
    .insert(globalSettings)
    .values({ id: SINGLETON_ID, ...data })
    .returning();
  // biome-ignore lint/style/noNonNullAssertion: insert always returns the created row
  return rows[0]!;
}
