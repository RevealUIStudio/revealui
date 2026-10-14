import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildManifest,
  diffContent,
  listSkillCatalog,
  writeManagerAdapterContent,
} from '../content/index.js';
import {
  CODEX_FILES_PATH,
  checkCodexDelivery,
  hasCodexInstructions,
  materializeCodexSkills,
} from '../manager/codex.js';
import {
  checkManager,
  loadManager,
  ManagerSchema,
  materializeCodexPointer,
  materializeManager,
  writeManager,
} from '../manager/index.js';
import { resolveSessionAdapter } from '../session/resolve-adapter.js';

const START = '<!-- revealui-codex:start -->';
const END = '<!-- revealui-codex:end -->';

describe('Codex manager adapter', () => {
  const roots: string[] = [];

  function project(): string {
    const root = mkdtempSync(join(tmpdir(), 'revealui-codex-manager-'));
    roots.push(root);
    return root;
  }

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('registers Codex in defaults and materializes its native entry point', () => {
    const root = project();
    expect(ManagerSchema.parse({}).adapters).toContainEqual({
      id: 'codex',
      projectTree: null,
      rank: 'equal',
    });
    const result = materializeManager(root);
    expect(result.stubs).toContain('AGENTS.md');
    expect(result.stubs).toContain('.revealui/adapters/codex.md');
    expect(hasCodexInstructions(root)).toBe(true);
  });

  it('adds Codex to a legacy manager while preserving project settings and peer adapters', () => {
    const root = project();
    const original = ManagerSchema.parse({
      name: 'Operator project',
      contentRoot: 'custom-content',
      tracker: { path: 'planning/BOARD.md', note: 'Owner tracker note' },
      mcp: { configPath: 'local-mcp.json' },
      contentPackage: '@example/policy',
      adapters: [{ id: 'cursor', projectTree: '.custom-cursor', rank: 'equal' }],
    });
    writeManager(root, original);
    materializeManager(root, { adapters: ['codex'] });
    expect(loadManager(root)).toEqual({
      ...original,
      adapters: [...original.adapters, { id: 'codex', projectTree: null, rank: 'equal' }],
    });
    expect(existsSync(join(root, '.claude'))).toBe(false);
    expect(existsSync(join(root, '.grok'))).toBe(false);
  });

  it('keeps an explicit Codex registration and remains byte-identical on repeated materialization', () => {
    const root = project();
    const config = ManagerSchema.parse({
      adapters: [{ id: 'codex', projectTree: '.operator-codex', rank: 'equal' }],
    });
    materializeManager(root, { adapters: ['codex'], config });
    const paths = ['AGENTS.md', '.revealui/manager.json', '.revealui/adapters/codex.md'];
    const before = paths.map((path) => readFileSync(join(root, path), 'utf8'));
    materializeManager(root, { adapters: ['codex'] });
    expect(paths.map((path) => readFileSync(join(root, path), 'utf8'))).toEqual(before);
    expect(loadManager(root).adapters).toEqual(config.adapters);
  });

  it('does not enroll Codex into a legacy manager when only another adapter is requested', () => {
    const root = project();
    const config = ManagerSchema.parse({ adapters: [{ id: 'cursor' }] });
    writeManager(root, config);
    materializeManager(root, { adapters: ['cursor'] });
    expect(loadManager(root)).toEqual(config);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(false);
  });

  it('appends discovery without replacing owner guidance', () => {
    const root = project();
    const owner = '# Owner instructions\n\nUse the project release checklist.';
    writeFileSync(join(root, 'AGENTS.md'), owner);
    materializeCodexPointer(root);
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toMatch(
      /^# Owner instructions\n\nUse the project release checklist\.\n\n<!-- revealui-codex:start -->/,
    );
    expect(hasCodexInstructions(root)).toBe(true);
  });

  it('refreshes only the managed block and preserves surrounding owner text', () => {
    const root = project();
    writeFileSync(
      join(root, 'AGENTS.md'),
      `owner before\n${START}\nold pointer\n${END}\nowner after`,
    );
    materializeCodexPointer(root);
    const result = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(result.startsWith(`owner before\n${START}`)).toBe(true);
    expect(result.endsWith(`${END}\nowner after`)).toBe(true);
    expect(result).not.toContain('old pointer');
    expect(hasCodexInstructions(root)).toBe(true);
  });

  it('uses a nonempty override and leaves AGENTS.md untouched', () => {
    const root = project();
    writeFileSync(join(root, 'AGENTS.md'), 'base owner guidance');
    writeFileSync(join(root, 'AGENTS.override.md'), 'override owner guidance');
    expect(materializeCodexPointer(root)).toContain('AGENTS.override.md');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('base owner guidance');
    expect(readFileSync(join(root, 'AGENTS.override.md'), 'utf8')).toContain(
      'override owner guidance',
    );
    expect(hasCodexInstructions(root)).toBe(true);
  });

  it('falls back to AGENTS.md when the override is empty', () => {
    const root = project();
    writeFileSync(join(root, 'AGENTS.override.md'), '');
    expect(materializeCodexPointer(root)).toContain('AGENTS.md');
    expect(readFileSync(join(root, 'AGENTS.override.md'), 'utf8')).toBe('');
    expect(hasCodexInstructions(root)).toBe(true);
  });

  it.each([
    `${START}\nunfinished`,
    `orphan\n${END}`,
    `${END}\nreverse\n${START}`,
    `${START}\n${START}\n${END}`,
    `${START}\n${END}\n${END}`,
  ])('rejects malformed managed markers without writing either instruction file: %s', (body) => {
    const root = project();
    const original = `owner instructions\n${body}`;
    writeFileSync(join(root, 'AGENTS.md'), original);
    expect(() => materializeCodexPointer(root)).toThrow('Malformed RevealUI Codex block');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe(original);
    expect(existsSync(join(root, '.revealui/adapters/codex.md'))).toBe(false);
  });

  it.each(['codex', 'codex-cli', ' CODEX '])(
    'resolves %s without inventing lifecycle hook support',
    (vendor) => {
      expect(resolveSessionAdapter(vendor)).toEqual({
        mode: 'existing',
        vendor: 'codex',
        generatorId: null,
        hookSource: null,
      });
    },
  );

  function complete(root: string): void {
    materializeManager(root);
    writeManagerAdapterContent(root);
  }

  it('delivers regular native skills and resources, with slug names and explicit invocation policy', () => {
    const root = project();
    complete(root);
    const skill = join(root, '.agents/skills/revealui-safety/SKILL.md');
    expect(lstatSync(skill).isFile()).toBe(true);
    expect(readFileSync(skill, 'utf8')).toContain('name: revealui-safety\n');
    expect(
      readFileSync(join(root, '.agents/skills/db-migrate/agents/openai.yaml'), 'utf8'),
    ).toContain('allow_implicit_invocation: false');
    expect(
      readFileSync(join(root, '.agents/skills/tailwind-4-docs/references/gotchas.md'), 'utf8'),
    ).toContain('Tailwind CSS v4 Gotchas');
    expect(checkCodexDelivery(root)).toEqual([]);
    const ledger = readFileSync(join(root, CODEX_FILES_PATH), 'utf8');
    complete(root);
    expect(readFileSync(join(root, CODEX_FILES_PATH), 'utf8')).toBe(ledger);
  });

  it('honors custom content roots in generation, native policy, adapter guides, diff, and catalog', () => {
    const root = project();
    writeManager(root, ManagerSchema.parse({ contentRoot: 'policy/generated' }));
    complete(root);
    expect(existsSync(join(root, '.revealui/content'))).toBe(false);
    for (const guide of [
      '.revealui/adapters/codex.md',
      '.cursor/revealui-manager.md',
      '.grok/rules/00-revealui-manager.md',
    ]) {
      expect(readFileSync(join(root, guide), 'utf8')).toContain('.revealui/policy/generated/');
    }
    const manifest = buildManifest();
    expect(
      diffContent('claude-code', manifest, { projectRoot: root }, root).every(
        (file) => file.status === 'unchanged',
      ),
    ).toBe(true);
    expect(
      diffContent('grok', manifest, { projectRoot: root }, root).every(
        (file) => file.status === 'unchanged',
      ),
    ).toBe(true);
    expect(
      listSkillCatalog({ projectRoot: root }).every((skill) =>
        skill.path.includes('.revealui/policy/generated/skills/'),
      ),
    ).toBe(true);
    expect(checkManager(root).errors).toEqual([]);
  });

  it.each([
    '../escape',
    '/absolute',
    'C:/absolute',
    'nested/../escape',
    'nested\\escape',
    '',
    'nested//empty',
  ])('rejects unsafe content roots: %s', (contentRoot) => {
    expect(ManagerSchema.safeParse({ contentRoot }).success).toBe(false);
  });

  it('migrates only recognized legacy profile links and leaves unrelated skills alone', () => {
    const root = project();
    const directory = join(root, '.agents/skills/revealui-safety');
    mkdirSync(directory, { recursive: true });
    symlinkSync(
      '/retired/revcon/profiles/revealui/agents/skills/revealui-safety/SKILL.md',
      join(directory, 'SKILL.md'),
    );
    const owner = join(root, '.agents/skills/owner-skill');
    mkdirSync(owner, { recursive: true });
    writeFileSync(join(owner, 'SKILL.md'), 'owner content');
    complete(root);
    expect(lstatSync(join(directory, 'SKILL.md')).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(owner, 'SKILL.md'), 'utf8')).toBe('owner content');
  });

  it.each(['file', 'link', 'directory'])(
    'preflights ownership conflicts without writing other native files: %s',
    (kind) => {
      const root = project();
      const directory = join(root, '.agents/skills/revealui-safety');
      mkdirSync(directory, { recursive: true });
      const path = join(directory, 'SKILL.md');
      if (kind === 'file') writeFileSync(path, 'owner guidance');
      else if (kind === 'link') symlinkSync('/foreign/SKILL.md', path);
      else mkdirSync(path);
      expect(() => materializeCodexSkills(root, buildManifest())).toThrow();
      expect(existsSync(join(root, '.agents/skills/db-migrate/SKILL.md'))).toBe(false);
      expect(existsSync(join(root, CODEX_FILES_PATH))).toBe(false);
      if (kind === 'file') expect(readFileSync(path, 'utf8')).toBe('owner guidance');
    },
  );

  it('preserves modified managed files and refuses symlinked destination parents', () => {
    const root = project();
    complete(root);
    const path = join(root, '.agents/skills/revealui-safety/SKILL.md');
    writeFileSync(path, 'local owner changes');
    expect(checkManager(root).ok).toBe(false);
    expect(() => writeManagerAdapterContent(root)).toThrow('ownership conflict');
    expect(readFileSync(path, 'utf8')).toBe('local owner changes');
    const other = project();
    symlinkSync(root, join(other, '.agents'));
    expect(() => materializeCodexSkills(other, buildManifest())).toThrow('regular path');
  });

  it('fails validation for missing instructions, resources, and stale shared definitions', () => {
    const root = project();
    complete(root);
    unlinkSync(join(root, '.agents/skills/tailwind-4-docs/references/gotchas.md'));
    unlinkSync(join(root, 'AGENTS.md'));
    writeFileSync(join(root, '.revealui/content/rules/biome.md'), 'old definition');
    const checked = checkManager(root);
    expect(checked.ok).toBe(false);
    expect(checked.errors.some((error) => error.includes('gotchas.md'))).toBe(true);
    expect(checked.errors.some((error) => error.includes('instruction pointer'))).toBe(true);
    expect(
      checked.errors.some((error) => error.includes('stale .revealui/content/rules/biome.md')),
    ).toBe(true);
  });

  it('removes retired owned resources but preserves modifications to them', () => {
    const root = project();
    const manifest = buildManifest();
    materializeCodexSkills(root, manifest);
    const reduced = {
      ...manifest,
      skills: manifest.skills.filter((skill) => skill.id !== 'tailwind-4-docs'),
    };
    materializeCodexSkills(root, reduced);
    expect(existsSync(join(root, '.agents/skills/tailwind-4-docs/SKILL.md'))).toBe(false);
    materializeCodexSkills(root, manifest);
    writeFileSync(
      join(root, '.agents/skills/tailwind-4-docs/references/gotchas.md'),
      'owner resource',
    );
    expect(() => materializeCodexSkills(root, reduced)).toThrow('ownership conflict');
  });

  it('rejects traversal and reserved resource destinations before delivery', () => {
    const root = project();
    const manifest = buildManifest();
    for (const path of ['../escape', 'SKILL.md', 'agents/openai.yaml']) {
      const unsafe = {
        ...manifest,
        skills: [{ ...manifest.skills[0], references: { [path]: 'unsafe' } }],
      };
      expect(() => materializeCodexSkills(root, unsafe)).toThrow();
    }
    expect(existsSync(join(root, CODEX_FILES_PATH))).toBe(false);
  });

  it('keeps delivery valid after relocating a checkout', () => {
    const root = project();
    const relocated = project();
    complete(root);
    cpSync(root, relocated, { recursive: true });
    expect(checkManager(relocated).errors).toEqual([]);
    complete(relocated);
    expect(readFileSync(join(relocated, CODEX_FILES_PATH), 'utf8')).toBe(
      readFileSync(join(root, CODEX_FILES_PATH), 'utf8'),
    );
  });

  it('validates a Codex-only project without requiring peer vendor trees', () => {
    const root = project();
    materializeManager(root, {
      config: ManagerSchema.parse({ adapters: [{ id: 'codex' }] }),
      adapters: ['codex'],
    });
    writeManagerAdapterContent(root);
    expect(checkManager(root).errors).toEqual([]);
    for (const vendor of ['.claude', '.cursor', '.opencode', '.grok']) {
      expect(existsSync(join(root, vendor))).toBe(false);
    }
  });

  it('validates profile delivery and rejects overlapping ownership', () => {
    const root = project();
    complete(root);
    const native = JSON.parse(readFileSync(join(root, CODEX_FILES_PATH), 'utf8')) as {
      files: Record<string, string>;
    };
    writeFileSync(
      join(root, '.agents/.revcon-manifest.json'),
      JSON.stringify({
        mode: 'copy',
        files: {
          'skills/revealui-safety/SKILL.md': {
            source: 'profiles/revealui/agents/skills/revealui-safety/SKILL.md',
            sha256: native.files['.agents/skills/revealui-safety/SKILL.md'],
          },
        },
      }),
    );
    expect(checkManager(root).errors.some((error) => error.includes('multiply owned'))).toBe(true);
    writeFileSync(
      join(root, '.agents/.revcon-manifest.json'),
      JSON.stringify({
        mode: 'copy',
        files: {
          'skills/profile-only/SKILL.md': {
            source: 'profiles/revealui/agents/skills/profile-only/SKILL.md',
            sha256: '0'.repeat(64),
          },
        },
      }),
    );
    expect(checkManager(root).errors.some((error) => error.includes('profile delivery'))).toBe(
      true,
    );
  });
});
