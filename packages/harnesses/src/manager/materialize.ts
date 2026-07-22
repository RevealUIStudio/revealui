import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

export function managerPath(projectRoot: string): string {
  return join(projectRoot, MANAGER_DIR, MANAGER_FILE);
}

export function contentRootPath(projectRoot: string, config?: ManagerConfig): string {
  const root = config?.contentRoot ?? MANAGER_CONTENT_DIR;
  return join(projectRoot, MANAGER_DIR, root);
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'ENOENT'
  );
}

/** Load manager.json or return defaults. */
export function loadManager(projectRoot: string): ManagerConfig {
  const path = managerPath(projectRoot);
  // Read first (no existsSync TOCTOU). Missing file → schema defaults.
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    return ManagerSchema.parse(raw);
  } catch (err) {
    if (isEnoent(err)) {
      return ManagerSchema.parse({});
    }
    throw err;
  }
}

/**
 * Write manager.json (pretty). Skips the write when on-disk content already matches.
 * Uses try-read (not existsSync) so CodeQL js/file-system-race does not flag
 * a check-then-write TOCTOU on the project manager path.
 */
export function writeManager(projectRoot: string, config?: ManagerConfig): string {
  const parsed = ManagerSchema.parse(config ?? {});
  const path = managerPath(projectRoot);
  const next = `${JSON.stringify(parsed, null, 2)}\n`;
  try {
    if (readFileSync(path, 'utf-8') === next) {
      return path;
    }
  } catch (err) {
    if (!isEnoent(err)) {
      throw err;
    }
  }
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
2. Shared rules/skills: **\`.revealui/content/\`** (generated from \`@revealui/harnesses\`).
3. Day-to-day free surfaces: path in \`manager.json\` → \`tracker.path\` (fleet: \`docs/TRACKER.md\`).
4. Product I/O: RevealUI MCP only (device token via \`rfg\` / revvault) — not vendor side channels.
5. Equal vendors: Claude is not more authoritative than Grok, Cursor, or OpenCode.

See \`.revealui/README.md\`.
`;
  writeFileSync(abs, body, 'utf-8');
  return rel;
}

/** Thin Cursor stub note under .cursor if tree exists or always create pointer. */
export function materializeCursorStub(projectRoot: string): string {
  const rel = join('.cursor', 'revealui-manager.md');
  const abs = join(projectRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(
    abs,
    `${STUB_HEADER}
# RevealUI manager (Cursor adapter)

Authority: \`.revealui/manager.json\` + \`.revealui/content/\`.
Hooks may call \`revealui-harnesses hook cursor\`; policy text is not owned here.
`,
    'utf-8',
  );
  return rel;
}

/** OpenCode: short AGENTS fragment note under .opencode */
export function materializeOpenCodeStub(projectRoot: string): string {
  const rel = join('.opencode', 'revealui-manager.md');
  const abs = join(projectRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(
    abs,
    `${STUB_HEADER}
# RevealUI manager (OpenCode adapter)

Authority: \`.revealui/manager.json\` + \`.revealui/content/\`.
`,
    'utf-8',
  );
  return rel;
}

/**
 * Grok has no project tree by default — emit a project AGENTS pointer fragment
 * under .revealui so machine ~/.grok can tell operators to open it.
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
2. Read \`.revealui/content/\` for shared rules
3. Open \`tracker.path\` from the manager (fleet TRACKER)
4. Product work via RevealUI MCP (\`rfg\`)

Do not copy hardlines into \`~/.grok/rules/\`.
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

/** Fail if manager missing or Claude tree looks like a full policy fork without stub. */
export function checkManager(projectRoot: string): ManagerCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mPath = managerPath(projectRoot);
  if (!existsSync(mPath)) {
    errors.push(
      `missing ${MANAGER_DIR}/${MANAGER_FILE} — run: revealui-harnesses manager materialize`,
    );
  } else {
    try {
      loadManager(projectRoot);
    } catch (err) {
      errors.push(`invalid manager.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const claudeStub = join(projectRoot, '.claude', 'rules', '00-revealui-manager.md');
  if (!existsSync(claudeStub)) {
    warnings.push('missing .claude/rules/00-revealui-manager.md stub (materialize claude-code)');
  }
  const readme = join(projectRoot, MANAGER_DIR, 'README.md');
  if (!existsSync(readme)) {
    warnings.push('missing .revealui/README.md manager contract');
  }
  return { ok: errors.length === 0, errors, warnings };
}
