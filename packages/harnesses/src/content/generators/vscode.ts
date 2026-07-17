/**
 * VS Code Agent Plugin Generator
 *
 * Emits `plugin.json` -- the VS Code agent-plugin manifest (Preview;
 * verified 2026-07-17 against code.visualstudio.com/docs/agent-customization/agent-plugins
 * and .../docs/agents/reference/hooks-reference; the design doc's own audit
 * flags a high release cadence for this surface -- re-verify at each future
 * touch). A plugin root carries a `plugin.json` with a required kebab-case
 * `name`, plus optional `description`, `version`, `author`, `skills`,
 * `agents`, `hooks`, and `mcpServers` fields. `hooks` and `mcpServers` may
 * each be either an inline object or a path to a separate config file (for
 * example `.mcp.json`).
 *
 * This generator's `hooks` field is COMMAND-BASED only, mirroring
 * `CursorGenerator` (multi-editor harness design doc §3-B acceptance:
 * "100% command-based hooks"). Every one of VS Code's eight documented hook
 * events runs the same command: `revealui-harnesses hook vscode`, which
 * reads the hook payload from stdin and prints the permission decision to
 * stdout (`../../cli.ts` `hook` subcommand, `../../hooks/run-hook.ts`).
 *
 * `.mcp.json` generation is NOT part of this generator -- exactly the split
 * `CursorGenerator`'s own doc comment describes for `.cursor/mcp.json`: it
 * needs a `ProtocolConfig` + an MCP URL/token-input-id option the
 * `ContentGenerator` interface's `generateAll(manifest, ctx)` signature
 * doesn't carry, and it is security-critical (never emit a literal token).
 * It lives alongside `protocolConfigToCursorMcpConfig` in
 * `../../protocol/config-normalizer.ts` as `protocolConfigToVSCodeMcpConfig`,
 * the same leak-proof pattern. This manifest's own `mcpServers` field is
 * therefore a STRING PATH REFERENCE to `.mcp.json` (matching the manifest
 * schema's documented "path to an MCP config file" form) rather than an
 * inline object -- the file bundles the MCP *contribution* (the manifest
 * advertises and wires it) without this generator ever handling the URL or
 * token itself.
 *
 * VS Code's other writable plugin surfaces (`skills/`, `agents/`, a slash
 * commands surface) are NOT emitted yet -- Phase C scope, mirroring
 * `cursor.ts`'s and `opencode.ts`'s scoping notes. `generateRule`/
 * `generateCommand`/`generateAgent`/`generateSkill` return no files -- a
 * scoping decision, not an oversight.
 *
 * Unlike `.cursor/` or `.opencode/`, VS Code does not auto-discover a plugin
 * from inside a project -- it must be registered via the `chat.pluginLocations`
 * setting or installed from a git URL. This generator writes the bundle to
 * `.revealui/vscode-plugin/` (a project-relative, human-findable location)
 * rather than the project root, so nothing else in the tree collides with
 * `plugin.json`. See `../../../docs/vscode-agent-plugin.md` for the local
 * install + org-allowlist governance notes (multi-editor harness design doc
 * §6 Phase C acceptance).
 */

import type { ResolverContext } from '../resolvers/types.js';
import type { Agent, Command, Manifest, Rule, Skill } from '../schemas/index.js';
import type { ContentGenerator, GeneratedFile } from './types.js';

/**
 * The eight VS Code agent-hook event names this package's `hook vscode`
 * subcommand normalizes (multi-editor harness design doc §2.3, verified
 * 2026-07-17 against code.visualstudio.com/docs/agents/reference/hooks-reference).
 * Notably no `SessionEnd` -- VS Code does not document one, unlike Cursor and
 * Claude Code (see `../../hooks/normalizers/vscode.ts`'s module doc).
 */
const VSCODE_HOOK_EVENT_NAMES: readonly string[] = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PreCompact',
  'SubagentStart',
  'SubagentStop',
  'Stop',
];

/** One `plugin.json` `hooks.<eventName>` entry. */
interface VSCodePluginHookEntry {
  type: 'command';
  command: string;
}

/** The `plugin.json` shape this generator writes (design doc §2.3 / the agent-plugins manifest). */
interface VSCodePluginManifest {
  name: string;
  description: string;
  version: string;
  hooks: Record<string, VSCodePluginHookEntry[]>;
  /** Path reference to the separately-generated `.mcp.json` -- see module doc. */
  mcpServers: string;
}

export class VSCodeGenerator implements ContentGenerator {
  readonly id = 'vscode';
  readonly outputDir = '.revealui/vscode-plugin';

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
    const hooks: VSCodePluginManifest['hooks'] = {};
    for (const eventName of VSCODE_HOOK_EVENT_NAMES) {
      hooks[eventName] = [{ command: 'revealui-harnesses hook vscode', type: 'command' }];
    }

    const manifest: VSCodePluginManifest = {
      name: 'revealui',
      description: 'RevealUI governed hooks and MCP access for VS Code agent mode',
      version: '0.1.0',
      hooks,
      mcpServers: '.mcp.json',
    };

    return [
      {
        relativePath: '.revealui/vscode-plugin/plugin.json',
        content: `${JSON.stringify(manifest, null, 2)}\n`,
      },
    ];
  }
}
