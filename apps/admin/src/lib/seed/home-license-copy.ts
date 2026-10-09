/**
 * Refresh seeded home and about pages when a database already has a
 * pre-correction license sentence. New installs read the current sentences
 * from apps/admin/src/seed.ts; this walk updates those sentences in place
 * and leaves every other page untouched.
 */

import type { Database } from '@revealui/db/client';
import { updatePage } from '@revealui/db/queries/pages';

export const STALE_HOME_LICENSE_SENTENCE =
  '20 of 26 packages are MIT - forever; the 5 Pro packages convert to MIT after 2 years.';

export const STALE_ABOUT_LICENSE_SENTENCE =
  'The core runtime is MIT-licensed. The 5 Pro packages (ai, engines, harnesses, mcp, services) are Fair Source (FSL-1.1-MIT), free for single-product use, commercially licensed for platforms, converting to MIT after two years.';

const STALE_PRIMITIVES_FRAGMENT = 'agents - wired';
const CURRENT_PRIMITIVES_FRAGMENT = 'agents: wired';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function replaceInString(
  value: string,
  licenseSentence: string,
  aboutSentence: string,
): { text: string; replaced: boolean } {
  let text = value;
  let replaced = false;
  if (text.includes(STALE_HOME_LICENSE_SENTENCE)) {
    text = text.replaceAll(STALE_HOME_LICENSE_SENTENCE, licenseSentence);
    replaced = true;
  }
  if (text.includes(STALE_ABOUT_LICENSE_SENTENCE)) {
    text = text.replaceAll(STALE_ABOUT_LICENSE_SENTENCE, aboutSentence);
    replaced = true;
  }
  if (text.includes(STALE_PRIMITIVES_FRAGMENT)) {
    text = text.replaceAll(STALE_PRIMITIVES_FRAGMENT, CURRENT_PRIMITIVES_FRAGMENT);
    replaced = true;
  }
  return { text, replaced };
}

/**
 * Walk JSON and replace the known stale seed phrases. Does not mutate `value`.
 */
export function replaceStaleHomeCopy(
  value: unknown,
  licenseSentence: string,
  aboutSentence: string,
): { value: unknown; replaced: boolean } {
  let replaced = false;

  function walk(node: unknown): unknown {
    if (typeof node === 'string') {
      const next = replaceInString(node, licenseSentence, aboutSentence);
      if (next.replaced) replaced = true;
      return next.text;
    }
    if (Array.isArray(node)) {
      return node.map((entry) => walk(entry));
    }
    if (isRecord(node)) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(node)) {
        out[key] = walk(node[key]);
      }
      return out;
    }
    return node;
  }

  return { value: walk(value), replaced };
}

/**
 * Return replacement blocks when stored page JSON still carries a stale
 * license sentence. Null means the page should stay as stored.
 */
export function homeLicenseBlocksPatch(
  blocks: unknown,
  licenseSentence: string,
  aboutSentence: string,
): unknown[] | null {
  const next = replaceStaleHomeCopy(blocks, licenseSentence, aboutSentence);
  if (!(next.replaced && Array.isArray(next.value))) return null;
  return next.value;
}

export type LicenseBlocksRefreshStatus = 'unchanged' | 'updated' | 'missing';

/**
 * Write corrected blocks through the page query the admin seed uses.
 * `unchanged` means the stored JSON did not contain a stale sentence.
 * `missing` means the row was absent or soft-deleted.
 */
export async function persistRefreshedLicenseBlocks(
  db: Database,
  pageId: string,
  blocks: unknown,
  licenseSentence: string,
  aboutSentence: string,
): Promise<LicenseBlocksRefreshStatus> {
  const patched = homeLicenseBlocksPatch(blocks, licenseSentence, aboutSentence);
  if (!patched) return 'unchanged';
  const row = await updatePage(db, pageId, {
    blocks: patched,
    blockCount: patched.length,
  });
  if (!row) return 'missing';
  return 'updated';
}
