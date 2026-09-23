/**
 * Session launch order: control layer first, then one vendor adapter.
 *
 * A known vendor uses the adapter already registered in this package.
 * An unknown vendor gets a thin adapter that only forwards into the
 * control layer. It does not get a second policy home.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ImplementedHookSource } from '../hooks/normalizers/index.js';

const ALIASES: Readonly<Record<string, string>> = {
  grok: 'grok',
  'grok-build': 'grok',
  claude: 'claude-code',
  'claude-code': 'claude-code',
  cursor: 'cursor',
  vscode: 'vscode',
  'vs-code': 'vscode',
  code: 'vscode',
  opencode: 'opencode',
  'open-code': 'opencode',
  revdev: 'revdev',
  acp: 'acp',
};

const EXISTING: Readonly<
  Record<string, { generatorId: string | null; hookSource: ImplementedHookSource | null }>
> = {
  grok: { generatorId: 'grok', hookSource: 'grok' },
  'claude-code': { generatorId: 'claude-code', hookSource: 'claude-code' },
  cursor: { generatorId: 'cursor', hookSource: 'cursor' },
  vscode: { generatorId: 'vscode', hookSource: 'vscode' },
  opencode: { generatorId: 'opencode', hookSource: null },
  revdev: { generatorId: null, hookSource: null },
  acp: { generatorId: null, hookSource: null },
};

export interface ExistingSessionAdapter {
  readonly mode: 'existing';
  readonly vendor: string;
  readonly generatorId: string | null;
  readonly hookSource: ImplementedHookSource | null;
}

export interface CreatedSessionAdapter {
  readonly mode: 'created';
  readonly vendor: string;
  readonly generatorId: null;
  readonly hookSource: 'generic';
}

export type SessionAdapterPlan = ExistingSessionAdapter | CreatedSessionAdapter;

/** Lowercase slug, or null when the name cannot be an adapter id. */
export function canonicalizeVendor(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  const id = ALIASES[trimmed] ?? trimmed;
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) return null;
  return id;
}

/**
 * Control layer is already in force. This only chooses the vendor adapter.
 * Returns null when the vendor string is not a safe id.
 */
export function resolveSessionAdapter(raw: string): SessionAdapterPlan | null {
  const vendor = canonicalizeVendor(raw);
  if (!vendor) return null;
  const known = EXISTING[vendor];
  if (known) {
    return {
      mode: 'existing',
      vendor,
      generatorId: known.generatorId,
      hookSource: known.hookSource,
    };
  }
  return { mode: 'created', vendor, generatorId: null, hookSource: 'generic' };
}

export function renderSessionAdapterLines(plan: SessionAdapterPlan): string {
  const head = '[control-layer] first: .revealui/manager.json + .revealui/content + token-budget';
  const memory =
    '[memory] first: knowledge-graph revealui.memory.v1. Vendor memory is a pointer, not a second store.';
  const adapter =
    plan.mode === 'existing'
      ? `[adapter] ${plan.vendor}: existing, extends control layer`
      : `[adapter] ${plan.vendor}: created thin adapter (control layer only, no second policy home)`;
  return `${head}\n${memory}\n${adapter}\n`;
}

export function thinAdapterPointer(vendor: string): string {
  return `# ${vendor} adapter

Created because no adapter was registered for this vendor.
The control layer stays first. This file does not author policy.

1. \`.revealui/manager.json\`
2. \`.revealui/content/\` and the token budget (\`src/token-budget.ts\`)
3. Hooks call \`revealui-harnesses hook ${vendor}\`, which normalizes onto that policy

Do not copy hardlines into this vendor's home directory.
`;
}

/** Write the pointer only when it is missing. Returns the relative path. */
export function writeThinAdapterPointer(projectRoot: string, vendor: string): string {
  const rel = join('.revealui', 'adapters', `${vendor}.md`);
  const abs = join(projectRoot, rel);
  mkdirSync(join(projectRoot, '.revealui', 'adapters'), { recursive: true });
  writeFileSync(abs, thinAdapterPointer(vendor), { flag: 'wx' });
  return rel;
}
