import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listSkillCatalog, skimSkillFrontmatter } from '../content/skill-catalog.js';

describe('skill catalog (GAP-293 Phase B)', () => {
  it('skims YAML frontmatter without executing the body', () => {
    const fields = skimSkillFrontmatter(`---
name: Demo skill
description: "A read-only listing fixture"
---

# Demo
run something dangerous
`);
    expect(fields.name).toBe('Demo skill');
    expect(fields.description).toBe('A read-only listing fixture');
  });

  it('lists package definitions when no disk trees are passed', () => {
    const list = listSkillCatalog({ includeDefinitions: true });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => s.source === 'definitions')).toBe(true);
    expect(list.every((s) => s.id.length > 0 && s.name.length > 0)).toBe(true);
    const ids = list.map((s) => s.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('project content wins over definitions for the same id', () => {
    const root = mkdtempSync(join(tmpdir(), 'skill-cat-'));
    const skillDir = join(root, '.revealui/content/skills/preflight');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---
name: Preflight (disk)
description: Materialized override
---
`,
    );
    const list = listSkillCatalog({ projectRoot: root, includeDefinitions: true });
    const hit = list.find((s) => s.id === 'preflight');
    expect(hit?.source).toBe('content');
    expect(hit?.name).toBe('Preflight (disk)');
    expect(hit?.description).toBe('Materialized override');
  });

  it('reads a revskills tree and does not require definitions', () => {
    const root = mkdtempSync(join(tmpdir(), 'revskills-cat-'));
    const skillDir = join(root, 'skills/example-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---
name: Example
description: From revskills
---
body
`,
    );
    const list = listSkillCatalog({
      revskillsRoot: root,
      includeDefinitions: false,
    });
    expect(list).toEqual([
      {
        id: 'example-skill',
        name: 'Example',
        description: 'From revskills',
        path: join(skillDir, 'SKILL.md'),
        source: 'revskills',
      },
    ]);
  });

  it('skips directories without SKILL.md', () => {
    const root = mkdtempSync(join(tmpdir(), 'skill-empty-'));
    mkdirSync(join(root, '.revealui/content/skills/orphan'), { recursive: true });
    const list = listSkillCatalog({
      projectRoot: root,
      includeDefinitions: false,
    });
    expect(list).toEqual([]);
  });
});
