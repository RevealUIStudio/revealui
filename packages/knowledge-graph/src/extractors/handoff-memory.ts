/**
 * P3 deterministic adapters: handoff fragments + free-form memory files →
 * EpisodeIngestInput without requiring an LLM.
 *
 * Explicit publish only (OQ2 held). Paths are recorded in contentRef; secrets
 * never appear as node values.
 */

import { readdirSync, readFileSync, type Stats, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { EpisodeIngestInput } from '../ingest/engine.js';

export interface TextSource {
  path: string;
  text: string;
}

const MAX_FILE_CHARS = 48_000;

/**
 * Load markdown fragments under a handoffs/rolling directory (or any dir of .md).
 */
export function loadMarkdownSources(dir: string, options?: { limit?: number }): TextSource[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const limit = options?.limit ?? 50;
  const out: TextSource[] = [];
  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    const path = join(dir, name);
    let st: Stats;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    if (text.length > MAX_FILE_CHARS) text = text.slice(0, MAX_FILE_CHARS);
    out.push({ path, text });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Deterministic episode from a handoff/memory file: one concept node per file
 * plus a documents edge to a gap/lane id if the first GAP-NNN token is found
 * without regex (substring scan for "GAP-" + digits).
 */
export function textSourceToEpisode(
  source: TextSource,
  options: { siteId: string; sourceLabel?: string; referenceTime?: Date },
): EpisodeIngestInput {
  const referenceTime = options.referenceTime ?? new Date();
  const base = basename(source.path);
  const naturalKey = `handoff-or-memory:${base}`;
  const gapId = findGapId(source.text);

  const nodes: EpisodeIngestInput['nodes'] = [
    {
      kind: 'concept',
      name: base,
      naturalKey,
      summary: source.text.slice(0, 280).replaceAll('\n', ' '),
      attributes: { path: source.path },
    },
  ];

  const edges: EpisodeIngestInput['edges'] = [];
  if (gapId) {
    nodes.push({
      kind: 'gap',
      name: gapId,
      naturalKey: `gap:${gapId}`,
    });
    edges.push({
      source: { kind: 'concept', naturalKey },
      target: { kind: 'gap', naturalKey: `gap:${gapId}` },
      relation: 'relates-to',
      fact: `${base} mentions ${gapId}`,
    });
  }

  return {
    episode: {
      episodeType: 'memory',
      source: options.sourceLabel ?? `file:${source.path}`,
      siteId: options.siteId,
      content: source.text.slice(0, 8000),
      contentRef: { path: source.path },
      referenceTime,
    },
    nodes,
    edges,
  };
}

/** Find first GAP-NNN id by character scan (no authored regex). */
function findGapId(text: string): string | null {
  const marker = 'GAP-';
  let from = 0;
  while (from < text.length) {
    const i = text.indexOf(marker, from);
    if (i < 0) return null;
    let j = i + marker.length;
    let digits = '';
    while (j < text.length) {
      const c = text[j];
      if (c === undefined || c < '0' || c > '9') break;
      digits += c;
      j++;
    }
    if (digits.length > 0) return `GAP-${digits}`;
    from = i + marker.length;
  }
  return null;
}
