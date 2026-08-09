import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMarkdownSources, textSourceToEpisode } from '../extractors/handoff-memory.js';

describe('handoff/memory adapters', () => {
  it('loads markdown sources and maps GAP mentions', () => {
    const dir = join(tmpdir(), `kg-handoff-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'note.md'), '# Session\nWorked on GAP-349 knowledge graph.\n', 'utf8');

    const sources = loadMarkdownSources(dir);
    expect(sources).toHaveLength(1);

    const ep = textSourceToEpisode(sources[0]!, { siteId: 'test', sourceLabel: 'test' });
    expect(ep.nodes.some((n) => n.kind === 'concept')).toBe(true);
    expect(ep.nodes.some((n) => n.naturalKey === 'gap:GAP-349')).toBe(true);
    expect(ep.edges.some((e) => e.relation === 'relates-to')).toBe(true);
  });
});
