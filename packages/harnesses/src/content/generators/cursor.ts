/**
 * Cursor Content Generator
 *
 * Emits `.cursor/hooks.json` -- COMMAND-BASED hooks only (multi-editor
 * harness design doc §3-B acceptance: "100% command-based hooks"; Cursor
 * cloud agents run command hooks only, no prompt-based hooks, per design
 * doc §2.3). Every configured event runs the same command:
 * `revealui-harnesses hook cursor`, which reads the hook payload from
 * stdin and prints the permission decision to stdout (`../../cli.ts`
 * `hook` subcommand, `../../hooks/run-hook.ts`).
 *
 * `.cursor/mcp.json` generation is NOT part of this generator -- it needs a
 * `ProtocolConfig` + an MCP URL/token-env-var option the `ContentGenerator`
 * interface's `generateAll(manifest, ctx)` signature doesn't carry, and it
 * is security-critical (never emit a literal token). It lives alongside
 * `protocolConfigToOpencodeConfig` in `../../protocol/config-normalizer.ts`
 * as `protocolConfigToCursorMcpConfig`, the same leak-proof pattern.
 *
 * Cursor's documented writable surfaces this generator does NOT emit yet
 * (Phase C scope, mirroring `opencode.ts`'s scoping note): `.cursor/commands/`,
 * `.cursor/rules/` (Cursor's own rules format, distinct from `.cursorrules`
 * which `protocolConfigToCursorrules` already emits), and an agents surface.
 * `generateRule`/`generateCommand`/`generateAgent`/`generateSkill` return no
 * files -- a scoping decision, not an oversight.
 */

import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';

/**
 * The eleven Cursor hook event names this package's `hook cursor`
 * subcommand normalizes (multi-editor harness design doc §2.3, verified
 * 2026-07-17 against cursor.com/docs/agent/hooks). `beforeReadFile` and the
 * subagent events are intentionally included -- the normalizer
 * (`../../hooks/normalizers/cursor.ts`) has an explicit, tested mapping for
 * every one of them.
 */
const CURSOR_HOOK_EVENT_NAMES: readonly string[] = [
  'sessionStart',
  'sessionEnd',
  'preToolUse',
  'postToolUse',
  'beforeShellExecution',
  'afterShellExecution',
  'beforeMCPExecution',
  'afterMCPExecution',
  'beforeReadFile',
  'afterFileEdit',
  'stop',
];

/** The `.cursor/hooks.json` shape (design doc §2.3 / cursor.com/docs/agent/hooks). */
interface CursorHooksConfig {
  version: 1;
  hooks: Record<string, Array<{ command: string; type: 'command' }>>;
}

export class CursorGenerator implements ContentGenerator {
  readonly id = 'cursor';
  readonly outputDir = '.cursor';

  generateRule(_rule: Rule, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateCommand(_cmd: Command, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateAgent(_agent: Agent, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateSkill(_skill: Skill, _ctx: ResolverContext): GeneratedFile[] {
    return [];
  }

  generateAll(_manifest: Manifest, _ctx: ResolverContext): GeneratedFile[] {
    const hooks: CursorHooksConfig['hooks'] = {};
    for (const eventName of CURSOR_HOOK_EVENT_NAMES) {
      hooks[eventName] = [{ command: 'revealui-harnesses hook cursor', type: 'command' }];
    }

    const config: CursorHooksConfig = { version: 1, hooks };

    return [
      {
        relativePath: '.cursor/hooks.json',
        content: `${JSON.stringify(config, null, 2)}\n`,
      },
    ];
  }
}
