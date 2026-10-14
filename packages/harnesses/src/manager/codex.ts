import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { z } from 'zod';
import { buildManifest } from '../content/definitions/index.js';
import type { GeneratedFile } from '../content/generators/types.js';
import { alwaysOnRuleIds } from '../content/preamble-ids.js';
import type { Manifest } from '../content/schemas/manifest.js';
import { assertManagedDestination, contentRootRelative, loadManager } from './paths.js';
import { RelativeManagerPathSchema } from './schema.js';

export const CODEX_POINTER_PATH = '.revealui/adapters/codex.md';
export const CODEX_FILES_PATH = '.revealui/adapters/codex-files.json';
const START = '<!-- revealui-codex:start -->';
const END = '<!-- revealui-codex:end -->';
const DISCOVERY = `${START}
## RevealUI project manager

For Codex sessions, read [.revealui/adapters/codex.md](.revealui/adapters/codex.md).
Shared project policy and skills use the manager's contentRoot under .revealui/.
${END}`;

function readOptional(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

/** Follow Codex's native project instruction precedence without replacing owner guidance. */
export function codexInstructionsPath(projectRoot: string): string {
  return readOptional(join(projectRoot, 'AGENTS.override.md')).trim()
    ? 'AGENTS.override.md'
    : 'AGENTS.md';
}

export function hasCodexInstructions(projectRoot: string): boolean {
  return readOptional(join(projectRoot, codexInstructionsPath(projectRoot))).includes(DISCOVERY);
}

export function codexPointerText(projectRoot: string, manifest = buildManifest()): string {
  const content = contentRootRelative(loadManager(projectRoot));
  const required = alwaysOnRuleIds(manifest);
  return `# RevealUI manager (Codex adapter)

Codex has equal authority with the other project adapters.

1. Read .revealui/manager.json for the project manager and tracker.path.
2. Before acting, read each required shared policy file listed below.
3. Discover generated skills under .agents/skills/. Edit canonical package definitions, then run revealui-harnesses manager materialize to refresh delivery files.
4. Use revealui-harnesses session adapter codex to inspect the session adapter.
5. Follow the same project authorization and security rules as every other adapter.

## Required shared policy

${manifest.rules
  .filter((rule) => required.has(rule.id))
  .map((rule) => `- ${content}/rules/${rule.id}.md`)
  .join('\n')}

## Additional shared policy

Read applicable rules before work in their scope:

${manifest.rules
  .filter((rule) => !required.has(rule.id))
  .map((rule) => `- ${content}/rules/${rule.id}.md: ${rule.description}`)
  .join('\n')}

Shared skills and supporting resources are generated under ${content}/skills/ and delivered to the native .agents/skills/ surface.
Native discovery paths are fixed by Codex; manager contentRoot configures the shared source location.

The native entry point is AGENTS.md (or a non-empty AGENTS.override.md).
This adapter supplies project instructions and skills. CodexAdapter also provides
bounded app-server dispatch, streamed output, project-scoped resume, MCP attachment,
and cancellation through the shared harness registry. Approval review uses an optional
host callback; absent review declines. Configured shared memory uses the existing signed
session boundary and knowledge-graph MCP launcher; native memory calls need no model turn.
Lifecycle hooks and a packaged review UI remain separate milestones. Keep credentials in the existing secret store.

Instruction discovery: https://learn.chatgpt.com/docs/agent-configuration/agents-md
`;
}

/** Native Codex metadata comes from the same definitions as manager content. */
export function codexSkillFiles(manifest: Manifest): GeneratedFile[] {
  return manifest.skills.flatMap((skill) => {
    const id = RelativeManagerPathSchema.parse(skill.id);
    if (id.includes('/')) throw new Error(`Skill id must be a single directory name: ${id}`);
    let body = skill.content;
    if (skill.skipFrontmatter && body.startsWith('---\n')) {
      const end = body.indexOf('\n---', 4);
      if (end === -1) throw new Error(`Malformed skill frontmatter: ${id}`);
      body = body.slice(end + 4).trimStart();
    }
    const directory = `.agents/skills/${id}`;
    const files: GeneratedFile[] = [
      {
        relativePath: `${directory}/SKILL.md`,
        content: `---\nname: ${id}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n${body.trimEnd()}\n`,
      },
    ];
    if (skill.disableModelInvocation) {
      files.push({
        relativePath: `${directory}/agents/openai.yaml`,
        content: 'policy:\n  allow_implicit_invocation: false\n',
      });
    }
    for (const [path, content] of Object.entries(skill.references)) {
      RelativeManagerPathSchema.parse(path);
      if (path === 'SKILL.md' || path === 'agents/openai.yaml') {
        throw new Error(`Reserved skill resource path: ${id}/${path}`);
      }
      files.push({
        relativePath: `${directory}/${path}`,
        content: content.endsWith('\n') ? content : `${content}\n`,
      });
    }
    return files;
  });
}

const OwnedSkillPathSchema = RelativeManagerPathSchema.refine(
  (path) => path.startsWith('.agents/skills/') && path.split('/').length >= 4,
  'Expected a native skill path',
);
const CodexFilesSchema = z.object({
  version: z.literal(1),
  files: z.record(OwnedSkillPathSchema, z.string().length(64)),
});
const ProfileFilesSchema = z.object({
  mode: z.literal('copy'),
  files: z.record(
    RelativeManagerPathSchema,
    z.object({ source: z.string().min(1), sha256: z.string().length(64) }),
  ),
});

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function ownedCodexFiles(projectRoot: string): Record<string, string> {
  assertManagedDestination(projectRoot, CODEX_FILES_PATH);
  const text = readOptional(join(projectRoot, CODEX_FILES_PATH));
  return text ? CodexFilesSchema.parse(JSON.parse(text) as unknown).files : {};
}

function fileKind(path: string): 'missing' | 'file' | 'link' | 'other' {
  try {
    const stat = lstatSync(path);
    return stat.isSymbolicLink() ? 'link' : stat.isFile() ? 'file' : 'other';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'missing';
    throw error;
  }
}

/** Only the existing RevCon profile skill link shape may migrate to package delivery. */
function legacySkillLink(projectRoot: string, path: string): boolean {
  const parts = path.split('/');
  if (parts.length !== 4 || parts[3] !== 'SKILL.md') return false;
  const target = readlinkSync(join(projectRoot, path));
  return (
    posix.isAbsolute(target) &&
    target.endsWith(`/revcon/profiles/revealui/agents/skills/${parts[2]}/SKILL.md`)
  );
}

/** Preflight the whole native delivery before replacing any owner files. */
export function materializeCodexSkills(projectRoot: string, manifest: Manifest): string[] {
  const files = codexSkillFiles(manifest);
  const previous = ownedCodexFiles(projectRoot);
  const next = Object.fromEntries(files.map((file) => [file.relativePath, hash(file.content)]));
  const links = new Set<string>();
  for (const path of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    assertManagedDestination(projectRoot, dirname(path));
    const kind = fileKind(join(projectRoot, path));
    if (kind === 'missing') continue;
    if (kind === 'link' && path in next && legacySkillLink(projectRoot, path)) {
      links.add(path);
      continue;
    }
    assertManagedDestination(projectRoot, path);
    if (
      kind !== 'file' ||
      !(path in previous) ||
      hash(readOptional(join(projectRoot, path))) !== previous[path]
    ) {
      throw new Error(`Codex delivery ownership conflict: ${path}; owner content was left intact`);
    }
  }
  for (const path of links) unlinkSync(join(projectRoot, path));
  for (const file of files) {
    const path = join(projectRoot, file.relativePath);
    mkdirSync(dirname(path), { recursive: true });
    if (readOptional(path) !== file.content) writeFileSync(path, file.content, 'utf8');
  }
  for (const path of Object.keys(previous)) {
    if (!(path in next) && fileKind(join(projectRoot, path)) === 'file')
      unlinkSync(join(projectRoot, path));
  }
  const ledger = join(projectRoot, CODEX_FILES_PATH);
  mkdirSync(dirname(ledger), { recursive: true });
  writeFileSync(ledger, `${JSON.stringify({ version: 1, files: next }, null, 2)}\n`, 'utf8');
  return [...files.map((file) => file.relativePath), CODEX_FILES_PATH];
}

export function checkCodexDelivery(projectRoot: string, manifest = buildManifest()): string[] {
  const errors: string[] = [];
  try {
    assertManagedDestination(projectRoot, codexInstructionsPath(projectRoot));
    assertManagedDestination(projectRoot, CODEX_POINTER_PATH);
    if (!hasCodexInstructions(projectRoot))
      errors.push('missing or stale Codex project instruction pointer');
    if (
      readOptional(join(projectRoot, CODEX_POINTER_PATH)) !==
      codexPointerText(projectRoot, manifest)
    ) {
      errors.push(`missing or stale ${CODEX_POINTER_PATH}`);
    }
    const owned = ownedCodexFiles(projectRoot);
    const expected = codexSkillFiles(manifest);
    for (const file of expected) {
      assertManagedDestination(projectRoot, file.relativePath);
      if (
        readOptional(join(projectRoot, file.relativePath)) !== file.content ||
        owned[file.relativePath] !== hash(file.content)
      ) {
        errors.push(`missing, stale, or unowned ${file.relativePath}`);
      }
    }
    const paths = new Set(expected.map((file) => file.relativePath));
    for (const path of Object.keys(owned)) {
      if (!paths.has(path)) errors.push(`retired Codex delivery still recorded: ${path}`);
    }
    const profileLedger = '.agents/.revcon-manifest.json';
    assertManagedDestination(projectRoot, profileLedger);
    const profileText = readOptional(join(projectRoot, profileLedger));
    if (profileText) {
      const profile = ProfileFilesSchema.parse(JSON.parse(profileText) as unknown);
      for (const [relativePath, entry] of Object.entries(profile.files)) {
        const path = `.agents/${relativePath}`;
        assertManagedDestination(projectRoot, path);
        if (path in owned) errors.push(`multiply owned Codex artifact: ${path}`);
        if (
          fileKind(join(projectRoot, path)) !== 'file' ||
          hash(readOptional(join(projectRoot, path))) !== entry.sha256
        ) {
          errors.push(`missing or modified profile delivery: ${path}`);
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}

/** Materialize the policy adapter; execution/lifecycle adapters remain separate capabilities. */
export function materializeCodexPointer(projectRoot: string): string[] {
  const guide = codexInstructionsPath(projectRoot);
  const guidePath = join(projectRoot, guide);
  assertManagedDestination(projectRoot, guide);
  assertManagedDestination(projectRoot, CODEX_POINTER_PATH);
  const previous = readOptional(guidePath);
  const start = previous.indexOf(START);
  const end = previous.indexOf(END);
  if (
    (start === -1) !== (end === -1) ||
    (start !== -1 &&
      (end < start ||
        previous.indexOf(START, start + START.length) !== -1 ||
        previous.indexOf(END, end + END.length) !== -1))
  ) {
    throw new Error(`Malformed RevealUI Codex block in ${guide}; owner guidance was left intact`);
  }
  const next =
    start === -1
      ? `${previous}${previous ? (previous.endsWith('\n') ? '\n' : '\n\n') : ''}${DISCOVERY}\n`
      : `${previous.slice(0, start)}${DISCOVERY}${previous.slice(end + END.length)}`;
  const pointer = join(projectRoot, CODEX_POINTER_PATH);
  mkdirSync(dirname(pointer), { recursive: true });
  writeFileSync(pointer, codexPointerText(projectRoot), 'utf8');
  if (next !== previous) writeFileSync(guidePath, next, 'utf8');
  return [CODEX_POINTER_PATH, guide];
}
