import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildManifest } from '../content/definitions/index.js';
import { grokCommandPath, grokRulePathForDefinitionId } from '../content/generators/grok.js';
import { alwaysOnRuleIds } from '../content/preamble-ids.js';
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
 * Grok load path is `.grok/` (projectTree). Materialize writes the adapter
 * note plus SessionStart/SessionEnd/PreToolUse hook templates. The grok
 * content generator (writeManagerAdapterContent) emits preamble-tier-1
 * rules into `.grok/rules/` and slash commands into `.grok/commands/`.
 * RevKit `rfg` / bootstrap deploys hook JSON to Grok's vendor attach
 * point. Do not document a home `cp` recipe.
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
2. Shared policy: \`.revealui/content/\` (SSOT). Grok's **load path** is
   \`.grok/rules/\` (preamble tier 1) + \`.grok/commands/\` (slash commands) +
   \`.grok/skills/rule-*/\` (on-demand), generated by \`manager materialize\`.
   Do not set \`[compat.claude] rules = true\` — that re-ingests the Claude vendor dump.
3. Open \`tracker.path\` from the manager (fleet TRACKER)
4. Product work via RevealUI MCP (\`rfg\`)

## Peer session hooks (control layer)

Templates (SSOT, regenerated by \`manager materialize\`):

- \`.revealui/adapters/grok/hooks/session-start.json\`
- \`.revealui/adapters/grok/hooks/session-end.json\`
- \`.revealui/adapters/grok/hooks/pre-tool.json\`

RevKit deploys those templates to Grok's vendor attach point on \`rfg\`
launch and on \`bootstrap.sh\` (same pattern as git \`core.hooksPath\`).
Do not \`cp\` policy into \`$HOME/.grok\` by hand.

PreToolUse must be able to deny. The installed \`pre-tool.json\` runs
\`public-security-comment-pretool.cjs\`, which forwards to
\`revealui-harnesses hook grok\` and **must not** wrap that forward in
\`|| true\` (swallows exit 2).

What SessionStart/SessionEnd run (warn-only, never blocks the session):

| Boundary | Control surface |
|----------|-----------------|
| SessionStart | \`tracker-session-check.js\` (manager + TRACKER) |
| SessionStart | \`[menu] CURRENT-HANDOFF\` pointer (session deltas; continue = \`/pickup\`) |
| SessionStart / SessionEnd | \`revealui-harnesses hotfix check\` (GAP-405 control layer) |
| SessionStart / SessionEnd | \`revealui-harnesses tmpscript check\` (GAP-295 control layer) |
| SessionStart | \`revealui-harnesses session register --backend grok\` (soft if daemon down) |
| SessionEnd | \`revealui-harnesses session end\` (signed when identity cached; soft if daemon down) |
| PreToolUse | public-comment gate, then \`hook grok\` (deny is exit 2) |

Do not hand-copy hardlines into \`~/.grok/rules/\` or \`.grok/rules/\`.
Generated preamble-tier-1 files under \`.grok/rules/<id>.md\` are the Grok
analog of GAP-421 Claude mirrors, not a second authoring home.
Do not invent a second hotfix registry.
Rebuild \`@revealui/harnesses\` so \`dist/cli.js session\` / \`hook grok\` are available.
`,
    'utf-8',
  );

  // Hook JSON templates in the project tree. RevKit (rfg / bootstrap) copies
  // the allowlist to Grok's vendor attach point. Materialize does not write HOME.
  for (const [name, body] of Object.entries(GROK_HOOK_FILES)) {
    const hookRel = join(GROK_HOOK_TEMPLATE_DIR, name);
    const hookAbs = join(projectRoot, hookRel);
    mkdirSync(dirname(hookAbs), { recursive: true });
    writeFileSync(hookAbs, body.endsWith('\n') ? body : `${body}\n`, 'utf-8');
  }

  return rel;
}

/**
 * GAP-293 Phase A: RevDev consumes `.revealui/content` as SSOT.
 * No second emit tree (would twin the claude-code generator).
 */
export function materializeRevDevPointer(projectRoot: string): string {
  const rel = join(MANAGER_DIR, 'adapters', 'revdev.md');
  const abs = join(projectRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(
    abs,
    `${STUB_HEADER}
# RevealUI manager (RevDev adapter)

RevDev Studio, Console, and the daemon are an **equal adapter**. They **read**
the project manager and generated content. They do not own a second rules tree.

When cwd is this project:

1. Read **\`.revealui/manager.json\`**
2. Read **\`.revealui/content/\`** for shared policy (SSOT after \`manager materialize\`)
3. Open \`tracker.path\` from the manager (fleet TRACKER)
4. Product I/O: RevealUI MCP (\`rfg\`) — not a vendor side channel
5. Local inference stays on snaps / Ollama via the daemon. No Anthropic SDK.

Do not create \`~/.revdev/rules/\` hardline copies. Do not emit a parallel
generator that duplicates \`.revealui/content/\`. Skills index RPC and
AgentRuntime cockpit loops are later GAP-293 phases.

See \`.revealui/README.md\` and \`.jv/docs/gap-specs/GAP-293-revdev-harness-parity-design.md\`.
`,
    'utf-8',
  );
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
    adapters?: Array<'claude-code' | 'cursor' | 'opencode' | 'grok' | 'revdev'>;
  },
): MaterializeResult {
  const managerFile = writeManagerPreserving(projectRoot, options?.config);
  const adapters = options?.adapters ?? ['claude-code', 'cursor', 'opencode', 'grok', 'revdev'];
  const stubs: string[] = [];
  for (const id of adapters) {
    if (id === 'claude-code') stubs.push(materializeClaudeStub(projectRoot));
    else if (id === 'cursor') stubs.push(materializeCursorStub(projectRoot));
    else if (id === 'opencode') stubs.push(materializeOpenCodeStub(projectRoot));
    else if (id === 'grok') stubs.push(materializeGrokPointer(projectRoot));
    else if (id === 'revdev') stubs.push(materializeRevDevPointer(projectRoot));
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
      const grokAlwaysOn = alwaysOnRuleIds(manifest);
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
        if (grokAlwaysOn.has(rule.id)) {
          const grokRel = grokRulePathForDefinitionId(rule.id);
          const grokBody = readFileOrNull(join(projectRoot, grokRel));
          if (grokBody === null) {
            errors.push(
              `missing ${grokRel} (Grok load path: preamble tier 1) — run: revealui-harnesses manager materialize`,
            );
          } else if (grokBody !== contentBody) {
            errors.push(
              `dual drift: ${grokRel} !== ${contentRel} — run: revealui-harnesses manager materialize`,
            );
          }
        }
      }
      for (const cmd of manifest.commands) {
        const grokCmdRel = grokCommandPath(cmd.id);
        if (readFileOrNull(join(projectRoot, grokCmdRel)) === null) {
          errors.push(
            `missing ${grokCmdRel} (Grok load path: slash commands) — run: revealui-harnesses manager materialize`,
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
  const grokStub = join(projectRoot, MANAGER_DIR, 'adapters', 'grok.md');
  if (readFileOrNull(grokStub) === null) {
    warnings.push('missing .revealui/adapters/grok.md stub (materialize grok)');
  }
  const grokSpawnMap = join(projectRoot, '.grok', 'rules', '00-spawn-map.md');
  if (readFileOrNull(grokSpawnMap) === null) {
    warnings.push('missing .grok/rules/00-spawn-map.md (materialize grok generator)');
  }
  const grokManagerRule = join(projectRoot, '.grok', 'rules', '00-revealui-manager.md');
  if (readFileOrNull(grokManagerRule) === null) {
    warnings.push('missing .grok/rules/00-revealui-manager.md (materialize grok generator)');
  }
  const grokPreTool = join(projectRoot, GROK_HOOK_TEMPLATE_DIR, 'pre-tool.json');
  if (readFileOrNull(grokPreTool) === null) {
    warnings.push('missing Grok PreToolUse template (materialize grok hooks)');
  }
  const revdevStub = join(projectRoot, MANAGER_DIR, 'adapters', 'revdev.md');
  if (readFileOrNull(revdevStub) === null) {
    warnings.push('missing .revealui/adapters/revdev.md stub (materialize revdev)');
  }
  const readme = join(projectRoot, MANAGER_DIR, 'README.md');
  if (readFileOrNull(readme) === null) {
    warnings.push('missing .revealui/README.md manager contract');
  }
  return { ok: errors.length === 0, errors, warnings };
}
