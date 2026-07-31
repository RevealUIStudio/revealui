import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildManifest } from '../content/definitions/index.js';
import { claudeRulePathForDefinitionId } from '../content/write-manager-adapters.js';
import { GROK_HOOK_FILES, GROK_HOOK_TEMPLATE_DIR } from './grok-session-hooks.js';
import {
  MANAGER_CONTENT_DIR,
  MANAGER_DIR,
  MANAGER_FILE,
  type ManagerConfig,
  ManagerSchema,
} from './schema.js';

const STUB_HEADER = `> **RevealUI manager.** Policy and skills are owned by \`.revealui/\`.
> This vendor tree is an **adapter stub only** (equal rank with every other vendor).
> Do not fork hardlines here. Edit package definitions → generate into \`.revealui/content/\`.
> **Quality over speed:** correctness and proof outrank throughput in every session.
`;

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'ENOENT'
  );
}

/** Read UTF-8 file contents, or null when missing (no existsSync TOCTOU). */
function readFileOrNull(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

export function managerPath(projectRoot: string): string {
  return join(projectRoot, MANAGER_DIR, MANAGER_FILE);
}

export function contentRootPath(projectRoot: string, config?: ManagerConfig): string {
  const root = config?.contentRoot ?? MANAGER_CONTENT_DIR;
  return join(projectRoot, MANAGER_DIR, root);
}

/** Load manager.json or return defaults. */
export function loadManager(projectRoot: string): ManagerConfig {
  const path = managerPath(projectRoot);
  const text = readFileOrNull(path);
  if (text === null) {
    return ManagerSchema.parse({});
  }
  return ManagerSchema.parse(JSON.parse(text) as unknown);
}

/**
 * Write manager.json (pretty).
 * Always performs a single writeFileSync after mkdir — no existsSync/read
 * then write race (CodeQL js/file-system-race). Manager files are small.
 */
export function writeManager(projectRoot: string, config?: ManagerConfig): string {
  const parsed = ManagerSchema.parse(config ?? {});
  const path = managerPath(projectRoot);
  const next = `${JSON.stringify(parsed, null, 2)}\n`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next, 'utf-8');
  return path;
}

/**
 * Persist manager.json without clobbering project-specific fields.
 * When no explicit config is passed, re-load via loadManager (defaults if
 * missing) so monorepo name/tracker notes survive `manager materialize`.
 */
export function writeManagerPreserving(projectRoot: string, config?: ManagerConfig): string {
  if (config !== undefined) {
    return writeManager(projectRoot, config);
  }
  return writeManager(projectRoot, loadManager(projectRoot));
}

/** Thin Claude project stub: one rule file that points at the manager. */
export function materializeClaudeStub(projectRoot: string): string {
  const rel = join('.claude', 'rules', '00-revealui-manager.md');
  const abs = join(projectRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  const body = `${STUB_HEADER}
# RevealUI manager (Claude adapter)

1. Open **\`.revealui/manager.json\`** for project authority.
2. Shared policy SSOT: package definitions → **\`.revealui/content/\`** (materialize).
3. Claude loads \`.claude/rules/\`: definition-backed rule bodies are **mirrored** from content (GAP-421 phase 2); monorepo-only rules stay hand-authored here; this stub is adapter-only.
4. Day-to-day free surfaces: path in \`manager.json\` → \`tracker.path\` (fleet: \`docs/TRACKER.md\`).
5. Product I/O: RevealUI MCP only (device token via \`rfg\` / revvault) — not vendor side channels.
6. Equal vendors: Claude is not more authoritative than Grok, Cursor, or OpenCode.

See \`.revealui/README.md\`.
`;
  writeFileSync(abs, body, 'utf-8');
  return rel;
}

/** Thin Cursor stub: equal-rank adapter pointing at the project manager. */
export function materializeCursorStub(projectRoot: string): string {
  const rel = join('.cursor', 'revealui-manager.md');
  const abs = join(projectRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(
    abs,
    `${STUB_HEADER}
# RevealUI manager (Cursor adapter)

1. Open **\`.revealui/manager.json\`** for project authority.
2. Shared rules/skills: **\`.revealui/content/\`** (generated from \`@revealui/harnesses\`).
3. Day-to-day free surfaces: path in \`manager.json\` → \`tracker.path\` (fleet: \`docs/TRACKER.md\`).
4. Product I/O: RevealUI MCP only (device token via \`rfg\` / revvault) — not vendor side channels.
5. Equal vendors: Cursor is not more authoritative than Claude, Grok, or OpenCode.

\`manager materialize\` also emits \`.cursor/hooks.json\` (command hooks → \`revealui-harnesses hook cursor\`).
Do not fork hardline policy under \`.cursor/rules/\`; edit package definitions instead.

See \`.revealui/README.md\`.
`,
    'utf-8',
  );
  return rel;
}

/** Thin OpenCode stub: equal-rank adapter pointing at the project manager. */
export function materializeOpenCodeStub(projectRoot: string): string {
  const rel = join('.opencode', 'revealui-manager.md');
  const abs = join(projectRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(
    abs,
    `${STUB_HEADER}
# RevealUI manager (OpenCode adapter)

1. Open **\`.revealui/manager.json\`** for project authority.
2. Shared rules/skills: **\`.revealui/content/\`** (generated from \`@revealui/harnesses\`).
3. Day-to-day free surfaces: path in \`manager.json\` → \`tracker.path\` (fleet: \`docs/TRACKER.md\`).
4. Product I/O: RevealUI MCP only (device token via \`rfg\` / revvault) — not vendor side channels.
5. Equal vendors: OpenCode is not more authoritative than Claude, Grok, or Cursor.

\`manager materialize\` also emits \`.opencode/agents/\` and \`.opencode/commands/\` from package definitions.
Policy text is not owned under \`.opencode/\`.

See \`.revealui/README.md\`.
`,
    'utf-8',
  );
  return rel;
}

/**
 * Grok has no project tree by default — emit a project AGENTS pointer fragment
 * under .revealui plus SessionStart/SessionEnd hook templates that call the
 * RevealUI control layer (same thin adapters Claude uses for hotfix / temp-scripts
 * + shared tracker-session-check). Machine install: copy
 * `.revealui/adapters/grok/hooks/*.json` → `~/.grok/hooks/`.
 */
export function materializeGrokPointer(projectRoot: string): string {
  const rel = join(MANAGER_DIR, 'adapters', 'grok.md');
  const abs = join(projectRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(
    abs,
    `${STUB_HEADER}
# RevealUI manager (Grok adapter)

Machine home (\`~/.grok\`) must stay **pointer-thin**. When cwd is this project:

1. Read \`.revealui/manager.json\`
2. Read \`.revealui/content/\` for generated shared policy (committed after
   \`manager materialize\`; this machine home still loads thin adapters /
   pointers — Claude Code still loads \`.claude/rules/\` until control-layer
   phase 2 retires duplicated rule bodies)
3. Open \`tracker.path\` from the manager (fleet TRACKER)
4. Product work via RevealUI MCP (\`rfg\`)

## Peer session hooks (control layer)

Templates (SSOT, regenerated by \`manager materialize\`):

- \`.revealui/adapters/grok/hooks/session-start.json\`
- \`.revealui/adapters/grok/hooks/session-end.json\`

Install to the machine home (Grok loads \`~/.grok/hooks/*.json\` always):

\`\`\`bash
mkdir -p ~/.grok/hooks
cp .revealui/adapters/grok/hooks/session-start.json ~/.grok/hooks/
cp .revealui/adapters/grok/hooks/session-end.json ~/.grok/hooks/
\`\`\`

What they run (warn-only, never blocks the session):

| Boundary | Control surface |
|----------|-----------------|
| SessionStart | \`tracker-session-check.js\` (manager + TRACKER) |
| SessionStart / SessionEnd | \`hotfix-check.js\` → \`revealui-harnesses hotfix\` (GAP-405) |
| SessionStart / SessionEnd | \`tmpscript-check.js\` (lifecycle until GAP-295 control-layer cutover) |
| SessionStart | \`revealui-harnesses session register --backend grok\` (soft if daemon down) |
| SessionEnd | \`revealui-harnesses session end\` (signed when identity cached; soft if daemon down) |
| PreToolUse | \`revealui-harnesses hook grok\` (policy + receipt spool) |

Do not copy hardlines into \`~/.grok/rules/\`. Do not invent a second hotfix registry.
Rebuild \`@revealui/harnesses\` so \`dist/cli.js session\` / \`hook grok\` are available.
`,
    'utf-8',
  );

  // Hook JSON templates (peer control-layer attach; install to ~/.grok/hooks).
  for (const [name, body] of Object.entries(GROK_HOOK_FILES)) {
    const hookRel = join(GROK_HOOK_TEMPLATE_DIR, name);
    const hookAbs = join(projectRoot, hookRel);
    mkdirSync(dirname(hookAbs), { recursive: true });
    writeFileSync(hookAbs, body.endsWith('\n') ? body : `${body}\n`, 'utf-8');
  }

  return rel;
}

export interface MaterializeResult {
  managerPath: string;
  stubs: string[];
}

/** Write manager.json + equal-rank adapter stubs. */
export function materializeManager(
  projectRoot: string,
  options?: {
    config?: ManagerConfig;
    adapters?: Array<'claude-code' | 'cursor' | 'opencode' | 'grok'>;
  },
): MaterializeResult {
  const managerFile = writeManagerPreserving(projectRoot, options?.config);
  const adapters = options?.adapters ?? ['claude-code', 'cursor', 'opencode', 'grok'];
  const stubs: string[] = [];
  for (const id of adapters) {
    if (id === 'claude-code') stubs.push(materializeClaudeStub(projectRoot));
    else if (id === 'cursor') stubs.push(materializeCursorStub(projectRoot));
    else if (id === 'opencode') stubs.push(materializeOpenCodeStub(projectRoot));
    else if (id === 'grok') stubs.push(materializeGrokPointer(projectRoot));
  }
  return { managerPath: managerFile, stubs };
}

export interface ManagerCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * True when the content tree has at least one non-empty nested path (rules,
 * commands, agents, or skills). Used by checkManager (GAP-421 content ADR).
 */
function contentTreeHasFiles(contentRoot: string): boolean {
  try {
    const top = readdirSync(contentRoot, { withFileTypes: true });
    for (const entry of top) {
      if (entry.isFile() && entry.name !== '.gitkeep') return true;
      if (entry.isDirectory()) {
        const nested = readdirSync(join(contentRoot, entry.name), { withFileTypes: true });
        if (nested.some((e) => e.isFile() || e.isDirectory())) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Fail if manager missing; warn if equal-rank adapter stubs/surfaces lag materialize. */
export function checkManager(projectRoot: string): ManagerCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mPath = managerPath(projectRoot);
  const managerText = readFileOrNull(mPath);
  let parsedConfig: ManagerConfig | undefined;
  if (managerText === null) {
    errors.push(
      `missing ${MANAGER_DIR}/${MANAGER_FILE} — run: revealui-harnesses manager materialize`,
    );
  } else {
    try {
      parsedConfig = ManagerSchema.parse(JSON.parse(managerText) as unknown);
    } catch (err) {
      errors.push(`invalid manager.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // GAP-421 content materialization ADR phase 1: absent/empty content tree is
  // a hard error once manager.json exists (materialize writes both).
  if (parsedConfig !== undefined) {
    const contentRoot = contentRootPath(projectRoot, parsedConfig);
    if (!contentTreeHasFiles(contentRoot)) {
      errors.push(
        `missing or empty ${MANAGER_DIR}/${parsedConfig.contentRoot}/ — run: revealui-harnesses manager materialize`,
      );
    } else {
      // Phase 2: definition rule bodies under .claude/rules must match content
      // (Claude load path). Monorepo-only rules (git.md, …) are not checked.
      const manifest = buildManifest();
      for (const rule of manifest.rules) {
        const contentRel = join(MANAGER_DIR, parsedConfig.contentRoot, 'rules', `${rule.id}.md`);
        const contentAbs = join(projectRoot, contentRel);
        const claudeRel = claudeRulePathForDefinitionId(rule.id);
        const claudeAbs = join(projectRoot, claudeRel);
        const contentBody = readFileOrNull(contentAbs);
        const claudeBody = readFileOrNull(claudeAbs);
        if (contentBody === null) {
          errors.push(`missing ${contentRel} — run: revealui-harnesses manager materialize`);
          continue;
        }
        if (claudeBody === null) {
          errors.push(
            `missing ${claudeRel} (GAP-421 phase 2: definition rules must load under .claude/rules) — run: revealui-harnesses manager materialize`,
          );
          continue;
        }
        if (claudeBody !== contentBody) {
          errors.push(
            `dual drift: ${claudeRel} !== ${contentRel} — run: revealui-harnesses manager materialize`,
          );
        }
      }
    }
  }

  const claudeStub = join(projectRoot, '.claude', 'rules', '00-revealui-manager.md');
  if (readFileOrNull(claudeStub) === null) {
    warnings.push('missing .claude/rules/00-revealui-manager.md stub (materialize claude-code)');
  }
  const cursorStub = join(projectRoot, '.cursor', 'revealui-manager.md');
  if (readFileOrNull(cursorStub) === null) {
    warnings.push('missing .cursor/revealui-manager.md stub (materialize cursor)');
  }
  const cursorHooks = join(projectRoot, '.cursor', 'hooks.json');
  if (readFileOrNull(cursorHooks) === null) {
    warnings.push(
      'missing .cursor/hooks.json (manager materialize writes cursor generator output)',
    );
  }
  const opencodeStub = join(projectRoot, '.opencode', 'revealui-manager.md');
  if (readFileOrNull(opencodeStub) === null) {
    warnings.push('missing .opencode/revealui-manager.md stub (materialize opencode)');
  }
  const readme = join(projectRoot, MANAGER_DIR, 'README.md');
  if (readFileOrNull(readme) === null) {
    warnings.push('missing .revealui/README.md manager contract');
  }
  return { ok: errors.length === 0, errors, warnings };
}
