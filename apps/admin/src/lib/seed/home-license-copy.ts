/**
 * Refresh the admin seed home page when a database already has the
 * pre-correction license sentence. New installs read the current sentence
 * from apps/admin/src/seed.ts; this walk updates that one sentence in place
 * and leaves every other page untouched.
 */

export const STALE_HOME_LICENSE_SENTENCE =
  '20 of 26 packages are MIT - forever; the 5 Pro packages convert to MIT after 2 years.';

const STALE_PRIMITIVES_FRAGMENT = 'agents - wired';
const CURRENT_PRIMITIVES_FRAGMENT = 'agents: wired';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function replaceInString(
  value: string,
  licenseSentence: string,
): { text: string; replaced: boolean } {
  let text = value;
  let replaced = false;
  if (text.includes(STALE_HOME_LICENSE_SENTENCE)) {
    text = text.replaceAll(STALE_HOME_LICENSE_SENTENCE, licenseSentence);
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
): { value: unknown; replaced: boolean } {
  let replaced = false;

  function walk(node: unknown): unknown {
    if (typeof node === 'string') {
      const next = replaceInString(node, licenseSentence);
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
 * Return replacement blocks when the stored home page still carries the stale
 * sentence. Null means the page should stay as stored.
 */
export function homeLicenseBlocksPatch(blocks: unknown, licenseSentence: string): unknown[] | null {
  const next = replaceStaleHomeCopy(blocks, licenseSentence);
  if (!(next.replaced && Array.isArray(next.value))) return null;
  return next.value;
}
