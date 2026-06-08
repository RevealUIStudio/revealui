import { matchGlob } from './glob';

export interface IgnoreEntry {
  readonly glob: string;
  readonly tags: ReadonlySet<string>;
}

/**
 * Parse a `.leakignore` allowlist. Format per line:
 *   `<path-glob> <tag[,tag...]>  # reason`
 * Blank lines, comment lines, and glob-only lines (no tags) are skipped, exactly
 * matching the legacy bash parser.
 */
export function parseLeakignore(text: string): IgnoreEntry[] {
  const entries: IgnoreEntry[] = [];
  for (const raw of text.split('\n')) {
    const hash = raw.indexOf('#');
    const line = (hash === -1 ? raw : raw.slice(0, hash)).trim();
    if (line === '') continue;
    const ws = firstWhitespace(line);
    if (ws === -1) continue; // glob with no tags
    const glob = line.slice(0, ws);
    const tagSpec = line.slice(ws).trim();
    if (tagSpec === '') continue;
    const tags = new Set(
      tagSpec
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
    );
    if (tags.size === 0) continue;
    entries.push({ glob, tags });
  }
  return entries;
}

function firstWhitespace(s: string): number {
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === ' ' || c === '\t') return i;
  }
  return -1;
}

/**
 * Build the allowlist predicate. A finding is suppressed only when BOTH the
 * relative path matches an entry's glob AND the finding's tag is in that entry's
 * tag set. A leading `./` on the path is normalized away (revvault#45 parity:
 * `frontend/src/foo.ts` and `./frontend/src/foo.ts` must match the same glob).
 */
export function makeIsIgnored(
  entries: readonly IgnoreEntry[],
): (relPath: string, tag: string) => boolean {
  return (relPath, tag) => {
    const rel = relPath.startsWith('./') ? relPath.slice(2) : relPath;
    for (const entry of entries) {
      if (entry.tags.has(tag) && matchGlob(rel, entry.glob)) return true;
    }
    return false;
  };
}
