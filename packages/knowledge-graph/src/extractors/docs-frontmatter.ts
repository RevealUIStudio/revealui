/**
 * Docs frontmatter extractor (Tier-1).
 *
 * Walks `docs/**\/*.md`, parses YAML frontmatter (when present), infers a
 * node kind from the path (`gaps/` -> gap, `lanes/` -> lane, `decisions/` ->
 * adr, `skills/` -> skill, `rules/` -> rule, else a learned `concept` with
 * `attributes.proposedKind = 'doc'`), and links `blocked-by` / `blocks` /
 * `supersedes` / `related` references that resolve to a `GAP-NNN` id (the
 * only reference shape with a canonical natural-key builder in P1).
 */

import { join } from 'node:path';
import { parse } from 'yaml';
import type { EdgeRelation, NodeKind } from '../ontology/index.js';
import type { EdgeInput, NodeInput } from '../types.js';
import { fileKey, gapKey, isDir, readTextFile, scanEpisode, walkFiles } from './shared.js';
import type { Extractor, ExtractorContext, ScanProduct } from './types.js';

interface ReferenceField {
  field: string;
  relation: EdgeRelation;
  /** true when the edge points FROM the referenced gap TO this doc. */
  reversed: boolean;
}

const REFERENCE_FIELDS: readonly ReferenceField[] = [
  { field: 'blocks', relation: 'blocks', reversed: false },
  { field: 'blocked-by', relation: 'blocks', reversed: true },
  { field: 'supersedes', relation: 'supersedes', reversed: false },
  { field: 'related', relation: 'relates-to', reversed: false },
  { field: 'related-lanes', relation: 'relates-to', reversed: false },
];

function mapKey(kind: string, naturalKey: string): string {
  return `${kind}:${naturalKey}`;
}

function extractFrontmatter(text: string): Record<string, unknown> | null {
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i] ?? '').trim() === '') i++;
  if (i >= lines.length || (lines[i] ?? '').trim() !== '---') return null;
  i++;

  const block: string[] = [];
  let closed = false;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;
    if (line.trim() === '---') {
      closed = true;
      break;
    }
    block.push(line);
    i++;
  }
  if (!closed) return null;

  try {
    const parsed = parse(block.join('\n'));
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function inferKind(rel: string): NodeKind {
  const segments = rel.split('/');
  if (segments.includes('gaps')) return 'gap';
  if (segments.includes('lanes')) return 'lane';
  if (segments.includes('decisions')) return 'adr';
  if (segments.includes('skills')) return 'skill';
  if (segments.includes('rules')) return 'rule';
  return 'concept';
}

function pickString(fm: Record<string, unknown>, key: string): string | undefined {
  const value = fm[key];
  return typeof value === 'string' ? value : undefined;
}

function definedEntries(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function isAllDigits(value: string): boolean {
  if (value.length === 0) return false;
  return [...value].every((c) => c >= '0' && c <= '9');
}

/** A value is a GAP id only when it is exactly `GAP-` followed by digits. */
function asGapId(value: string): string | null {
  if (!value.startsWith('GAP-')) return null;
  return isAllDigits(value.slice(4)) ? value : null;
}

function stringListField(fm: Record<string, unknown>, field: string): string[] {
  const value = fm[field];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export const docsFrontmatterExtractor: Extractor = {
  name: 'docs-frontmatter',
  async extract(ctx: ExtractorContext): Promise<ScanProduct[]> {
    const docsDir = join(ctx.repoRoot, 'docs');
    if (!isDir(docsDir)) return [];

    const nodes = new Map<string, NodeInput>();
    const edges: EdgeInput[] = [];

    const files = walkFiles(docsDir, ctx.repoRoot, ['.md']);
    for (const rel of files) {
      try {
        const text = readTextFile(join(ctx.repoRoot, rel));
        if (text === null) continue;

        const frontmatter = extractFrontmatter(text);
        if (frontmatter === null) continue;

        const kind = inferKind(rel);
        const naturalKey = fileKey(ctx.repo, rel);

        const docNode: NodeInput = {
          kind,
          name: rel,
          naturalKey,
          repo: ctx.repo,
          attributes: definedEntries({
            status: pickString(frontmatter, 'status'),
            priority: pickString(frontmatter, 'priority'),
            owner: pickString(frontmatter, 'owner'),
            state: pickString(frontmatter, 'state'),
            date: pickString(frontmatter, 'date'),
            path: rel,
            ...(kind === 'concept' ? { proposedKind: 'doc' } : {}),
          }),
        };
        nodes.set(mapKey(docNode.kind, docNode.naturalKey), docNode);

        for (const { field, relation, reversed } of REFERENCE_FIELDS) {
          for (const raw of stringListField(frontmatter, field)) {
            const gapId = asGapId(raw);
            if (gapId === null) continue; // lane slugs etc. have no canonical key builder in P1

            const gapNode: NodeInput = {
              kind: 'gap',
              name: gapId,
              naturalKey: gapKey(gapId),
              repo: null,
            };
            const gapMapKey = mapKey(gapNode.kind, gapNode.naturalKey);
            if (!nodes.has(gapMapKey)) nodes.set(gapMapKey, gapNode);

            const thisRef = { kind, naturalKey };
            const gapRef = { kind: 'gap' as const, naturalKey: gapKey(gapId) };
            const [source, target] = reversed ? [gapRef, thisRef] : [thisRef, gapRef];

            edges.push({
              source,
              target,
              relation,
              fact: reversed ? `${gapId} ${relation} ${rel}` : `${rel} ${relation} ${gapId}`,
              repo: ctx.repo,
            });
          }
        }
      } catch {
        // Skip files that fail to parse; extraction is best-effort and resilient.
      }
    }

    if (nodes.size === 0) return [];

    return [
      {
        episode: scanEpisode(ctx, 'docs-frontmatter'),
        nodes: [...nodes.values()],
        edges,
        scope: { repo: ctx.repo, extractor: 'docs-frontmatter' },
      },
    ];
  },
};
