#!/usr/bin/env node

/**
 * revealui-harnesses  -  CLI and RPC client for AI harness coordination.
 *
 * The RPC server lives in the RevDev daemon (`~/.local/share/revealui/harness.sock`);
 * this CLI dispatches to it and no longer hosts a socket server itself. See the
 * daemon-ownership ADR (2026-07-25).
 *
 * Commands:
 *   status                           List available harnesses via RPC
 *   list                             List harnesses in TSV format
 *   sync <harnessId> <push|pull>     Sync harness config to/from SSD
 *   coordinate [--project <path>]    Print current workboard state
 *   hook <cursor|claude-code|vscode|grok> Normalize a hook payload from stdin, evaluate policy, spool the receipt
 *   acp                              Run RevealUI as an ACP agent on stdio (GAP-381 Phase D; Zed/JetBrains)
 *   skills list [--json]             Read-only skill catalog (GAP-293 Phase B)
 *   session register|end|peers|reap  Soft-optional RevDev session boundary + peer panel + reaper (GAP-459)
 *
 * License: FSL-1.1-MIT
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { runRevealUiAcpAgentStdio } from './acp/index.js';
import {
  buildManifest,
  checkAllContentSnapshots,
  checkContentSnapshot,
  DEFAULT_CONTENT_GENERATOR_ID,
  diffContent,
  generateContent,
  listContent,
  listGenerators,
  listSkillCatalog,
  loadContentSnapshot,
  MANAGER_CONTENT_OUTPUT,
  MANAGER_MATERIALIZE_GENERATORS,
  snapshotPathFor,
  validateManifest,
  writeAllContentSnapshots,
  writeManagerAdapterContent,
} from './content/index.js';
import { defaultHookRunOptions, isImplementedHookSource, runHookCommand } from './hooks/index.js';
import { runHotfixCli } from './hotfix/cli.js';
import { checkManager, materializeManager } from './manager/index.js';
import { InferenceService } from './server/inference-service.js';
import { runSessionCli } from './session/cli.js';
import { runTmpscriptCli } from './tmpscript/cli.js';
import { WorkboardManager } from './workboard/workboard-manager.js';

const DATA_DIR = join(homedir(), '.local', 'share', 'revealui');
const DEFAULT_SOCKET = join(DATA_DIR, 'harness.sock');
const DEFAULT_PROJECT = process.cwd();

const [, , command, ...args] = process.argv;

async function rpcCall(method: string, params: unknown = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(DEFAULT_SOCKET);
    let buffer = '';
    socket.on('connect', () => {
      const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
      socket.write(`${req}\n`);
    });
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const resp = JSON.parse(line) as { result?: unknown; error?: { message: string } };
          socket.destroy();
          if (resp.error) reject(new Error(resp.error.message));
          else resolve(resp.result);
        } catch {
          reject(new Error(`Invalid JSON: ${line}`));
        }
      }
    });
    socket.on('error', reject);
    setTimeout(() => {
      socket.destroy();
      reject(new Error('RPC timeout'));
    }, 5000);
  });
}

async function handleContentCommand(subcommand: string | undefined, args: string[]): Promise<void> {
  const manifest = buildManifest();
  // Same --project resolution as `manager` (GAP-421 content freshness runs from
  // monorepo root via packages/harnesses/dist/cli.js).
  const projectIdx = args.indexOf('--project');
  const projectRoot = projectIdx >= 0 ? (args[projectIdx + 1] ?? DEFAULT_PROJECT) : DEFAULT_PROJECT;
  const ctx = { projectRoot };

  switch (subcommand) {
    case 'list': {
      const summary = listContent(manifest);
      process.stdout.write(`Canonical content:\n`);
      process.stdout.write(`  Rules:    ${summary.rules}\n`);
      process.stdout.write(`  Commands: ${summary.commands}\n`);
      process.stdout.write(`  Agents:   ${summary.agents}\n`);
      process.stdout.write(`  Skills:   ${summary.skills}\n`);
      process.stdout.write(`  Preambles: ${summary.preambles}\n`);
      process.stdout.write(`  Total:    ${summary.total}\n`);
      process.stdout.write(`\nRules:\n`);
      for (const rule of manifest.rules) {
        process.stdout.write(`  ${rule.id} (tier ${rule.preambleTier}) — ${rule.description}\n`);
      }
      process.stdout.write(`\nCommands:\n`);
      for (const cmd of manifest.commands) {
        process.stdout.write(
          `  ${cmd.id}${cmd.disableModelInvocation ? ' [manual]' : ''} — ${cmd.description.slice(0, 80)}\n`,
        );
      }
      process.stdout.write(`\nAgents:\n`);
      for (const agent of manifest.agents) {
        process.stdout.write(`  ${agent.id} [${agent.isolation}] — ${agent.description}\n`);
      }
      process.stdout.write(`\nSkills:\n`);
      for (const skill of manifest.skills) {
        process.stdout.write(
          `  ${skill.id}${skill.disableModelInvocation ? ' [manual]' : ''} — ${skill.description.slice(0, 80)}\n`,
        );
      }
      process.stdout.write(`\nGenerators: ${listGenerators().join(', ')}\n`);
      break;
    }

    case 'validate': {
      const result = validateManifest(manifest);
      if (result.valid) {
        process.stdout.write(`✓ All definitions valid\n`);
      } else {
        process.stderr.write(`✗ Validation errors:\n`);
        for (const error of result.errors) {
          process.stderr.write(`  - ${error}\n`);
        }
        process.exit(1);
      }
      break;
    }

    case 'diff': {
      const genIdx = args.indexOf('--generator');
      const generatorId =
        genIdx >= 0
          ? (args[genIdx + 1] ?? DEFAULT_CONTENT_GENERATOR_ID)
          : DEFAULT_CONTENT_GENERATOR_ID;
      const check = args.includes('--check');
      const entries = diffContent(generatorId, manifest, ctx, projectRoot);
      const added = entries.filter((e) => e.status === 'added');
      const modified = entries.filter((e) => e.status === 'modified');
      const unchanged = entries.filter((e) => e.status === 'unchanged');

      if (added.length === 0 && modified.length === 0) {
        process.stdout.write(`✓ No changes (${unchanged.length} files up to date)\n`);
      } else {
        if (added.length > 0) {
          process.stdout.write(`Added (${added.length}):\n`);
          for (const e of added) process.stdout.write(`  + ${e.relativePath}\n`);
        }
        if (modified.length > 0) {
          process.stdout.write(`Modified (${modified.length}):\n`);
          for (const e of modified) process.stdout.write(`  ~ ${e.relativePath}\n`);
        }
        process.stdout.write(`Unchanged: ${unchanged.length}\n`);
        if (check) {
          process.stderr.write(
            'content diff --check: disk output drifts from definitions (run content sync)\n',
          );
          process.exit(1);
        }
      }
      break;
    }

    case 'snapshot': {
      // GAP-406: definition ↔ committed generator snapshot lock.
      // --write refreshes content-snapshots/*.json; --check fails CI on drift.
      const write = args.includes('--write');
      const check = args.includes('--check') || !write;
      const genIdx = args.indexOf('--generator');
      const onlyGen = genIdx >= 0 ? (args[genIdx + 1] ?? undefined) : undefined;

      if (write) {
        const paths = writeAllContentSnapshots(onlyGen ? { generatorIds: [onlyGen] } : undefined);
        process.stdout.write(`✓ Wrote ${paths.length} content snapshot(s):\n`);
        for (const p of paths) process.stdout.write(`  ${p}\n`);
        if (!check) break;
      }

      if (check) {
        if (onlyGen) {
          const path = snapshotPathFor(onlyGen);
          const expected = loadContentSnapshot(path);
          const result = checkContentSnapshot(expected);
          if (!result.ok) {
            process.stderr.write(
              `✗ Content snapshot drift for ${onlyGen} (${result.drifts.length} file(s))\n`,
            );
            for (const d of result.drifts.slice(0, 40)) {
              process.stderr.write(`  ${d.kind}: ${d.relativePath}\n`);
            }
            process.stderr.write(
              'Refresh: pnpm exec revealui-harnesses content snapshot --write\n',
            );
            process.exit(1);
          }
          process.stdout.write(
            `✓ Content snapshot OK for ${onlyGen} (${result.fileCount} files)\n`,
          );
        } else {
          const all = checkAllContentSnapshots();
          for (const err of all.errors) process.stderr.write(`ERROR: ${err}\n`);
          for (const r of all.results) {
            if (r.ok) {
              process.stdout.write(`✓ ${r.generatorId}: ${r.fileCount} files match snapshot\n`);
            } else {
              process.stderr.write(`✗ ${r.generatorId}: ${r.drifts.length} drift(s)\n`);
              for (const d of r.drifts.slice(0, 20)) {
                process.stderr.write(`  ${d.kind}: ${d.relativePath}\n`);
              }
            }
          }
          if (!all.ok) {
            process.stderr.write(
              'Refresh: pnpm exec revealui-harnesses content snapshot --write\n',
            );
            process.exit(1);
          }
        }
      }
      break;
    }

    case 'sync': {
      const genIdx = args.indexOf('--generator');
      const generatorId =
        genIdx >= 0
          ? (args[genIdx + 1] ?? DEFAULT_CONTENT_GENERATOR_ID)
          : DEFAULT_CONTENT_GENERATOR_ID;
      const dryRun = args.includes('--dry-run');
      const files = generateContent(generatorId, manifest, ctx);

      if (dryRun) {
        process.stdout.write(
          `Dry run — would write ${files.length} files (generator=${generatorId}` +
            (generatorId === DEFAULT_CONTENT_GENERATOR_ID
              ? `, manager tree ${MANAGER_CONTENT_OUTPUT}`
              : '') +
            `):\n`,
        );
        for (const file of files) {
          process.stdout.write(`  ${file.relativePath}\n`);
        }
      } else {
        let written = 0;
        for (const file of files) {
          const absolutePath = join(projectRoot, file.relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, file.content, 'utf-8');
          written++;
        }
        const destNote =
          generatorId === DEFAULT_CONTENT_GENERATOR_ID
            ? ` → ${MANAGER_CONTENT_OUTPUT} (project manager)`
            : '';
        process.stdout.write(`✓ Wrote ${written} files via ${generatorId} generator${destNote}\n`);
      }
      break;
    }

    case 'export': {
      const outIdx = args.indexOf('--output');
      const rawOutput = outIdx >= 0 ? args[outIdx + 1] : undefined;
      if (!rawOutput) {
        process.stderr.write('Usage: content export --output <path>\n');
        process.exit(1);
      }
      const outputDir: string = rawOutput;

      // 1. Write canonical definitions organized by type/tier
      const definitionTypes = [
        { key: 'rules' as const, items: manifest.rules },
        { key: 'commands' as const, items: manifest.commands },
        { key: 'agents' as const, items: manifest.agents },
        { key: 'skills' as const, items: manifest.skills },
      ];

      let canonicalCount = 0;
      for (const { key, items } of definitionTypes) {
        for (const item of items) {
          const tier = item.tier ?? 'oss';
          const filePath = join(outputDir, key, tier, `${item.id}.md`);
          mkdirSync(dirname(filePath), { recursive: true });
          writeFileSync(filePath, item.content, 'utf-8');
          canonicalCount++;
        }
      }

      // 2. Write pre-rendered generator output (compute once, reuse for manifest)
      const generatorIds = listGenerators();
      const generatorOutputs = new Map<string, { relativePath: string; content: string }[]>();
      let generatedCount = 0;
      for (const genId of generatorIds) {
        const files = generateContent(genId, manifest, ctx);
        generatorOutputs.set(genId, files);
        for (const file of files) {
          const filePath = join(outputDir, 'generators', genId, file.relativePath);
          mkdirSync(dirname(filePath), { recursive: true });
          writeFileSync(filePath, file.content, 'utf-8');
          generatedCount++;
        }
      }

      // 3. Write manifest.json with metadata
      interface ManifestEntry {
        id: string;
        type: string;
        name: string;
        description: string;
        tier: string;
        tags?: string[];
        canonicalPath: string;
        generatorPaths: Record<string, string[]>;
      }

      const entries: ManifestEntry[] = [];
      for (const { key, items } of definitionTypes) {
        for (const item of items) {
          const tier = item.tier ?? 'oss';
          const type = key.replace(/s$/, ''); // rules → rule
          const entry: ManifestEntry = {
            id: item.id,
            type,
            name: item.name,
            description: item.description,
            tier,
            canonicalPath: `${key}/${tier}/${item.id}.md`,
            generatorPaths: {},
          };
          if ('tags' in item && Array.isArray(item.tags) && item.tags.length > 0) {
            entry.tags = item.tags;
          }
          // Map each generator's output paths for this definition
          for (const genId of generatorIds) {
            const genFiles = generatorOutputs.get(genId) ?? [];
            const matching = genFiles
              .filter((f) => f.relativePath.includes(item.id))
              .map((f) => f.relativePath);
            if (matching.length > 0) {
              entry.generatorPaths[genId] = matching;
            }
          }
          entries.push(entry);
        }
      }

      const exportManifest = {
        version: 1,
        generatedAt: new Date().toISOString(),
        generators: generatorIds,
        definitions: entries,
      };

      const manifestPath = join(outputDir, 'manifest.json');
      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(manifestPath, `${JSON.stringify(exportManifest, null, 2)}\n`, 'utf-8');

      process.stdout.write(`✓ Exported to ${outputDir}\n`);
      process.stdout.write(`  Canonical definitions: ${canonicalCount}\n`);
      process.stdout.write(
        `  Generator output: ${generatedCount} files (${generatorIds.join(', ')})\n`,
      );
      process.stdout.write(`  Manifest: manifest.json\n`);
      break;
    }

    case 'pull': {
      const genIdx = args.indexOf('--generator');
      const generatorId =
        genIdx >= 0
          ? (args[genIdx + 1] ?? DEFAULT_CONTENT_GENERATOR_ID)
          : DEFAULT_CONTENT_GENERATOR_ID;
      const tierIdx = args.indexOf('--tier');
      const tierFilter = tierIdx >= 0 ? (args[tierIdx + 1] ?? 'oss') : 'oss';

      if (!['oss', 'pro', 'all'].includes(tierFilter)) {
        process.stderr.write(`Invalid tier: ${tierFilter}. Use: oss, pro, all\n`);
        process.exit(1);
      }

      const baseUrl =
        args[args.indexOf('--url') + 1] ??
        process.env.REVEALUI_RULES_URL ??
        'https://raw.githubusercontent.com/RevealUIStudio/editor-configs/main/harnesses';

      // Fetch manifest from remote
      process.stdout.write(`Fetching manifest from ${baseUrl}/manifest.json...\n`);
      const manifestRes = await fetch(`${baseUrl}/manifest.json`);
      if (!manifestRes.ok) {
        process.stderr.write(
          `Failed to fetch manifest: ${manifestRes.status} ${manifestRes.statusText}\n`,
        );
        process.exit(1);
      }

      const remoteManifest = (await manifestRes.json()) as {
        definitions: Array<{
          id: string;
          type: string;
          name: string;
          tier: string;
          generatorPaths: Record<string, string[]>;
        }>;
      };

      // Filter definitions by tier
      const filtered = remoteManifest.definitions.filter((def) => {
        if (tierFilter === 'all') return true;
        return def.tier === tierFilter;
      });

      process.stdout.write(`Found ${filtered.length} definitions (tier: ${tierFilter})\n`);

      // Download pre-rendered files for the selected generator
      let written = 0;
      let errors = 0;
      for (const def of filtered) {
        const paths = def.generatorPaths[generatorId] ?? [];
        for (const relPath of paths) {
          const fileUrl = `${baseUrl}/generators/${generatorId}/${relPath}`;
          try {
            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) {
              process.stderr.write(`  ✗ ${relPath} (${fileRes.status})\n`);
              errors++;
              continue;
            }
            const content = await fileRes.text();
            const absolutePath = join(projectRoot, relPath);
            // Guard against path traversal  -  ensure output stays within project root
            if (!absolutePath.startsWith(projectRoot)) {
              process.stderr.write(`  ✗ ${relPath} (path traversal blocked)\n`);
              errors++;
              continue;
            }
            mkdirSync(dirname(absolutePath), { recursive: true });
            writeFileSync(absolutePath, content, 'utf-8');
            written++;
          } catch (err) {
            process.stderr.write(
              `  ✗ ${relPath} (${err instanceof Error ? err.message : 'fetch error'})\n`,
            );
            errors++;
          }
        }
      }

      process.stdout.write(`✓ Pulled ${written} files via ${generatorId} generator\n`);
      if (errors > 0) {
        process.stderr.write(`  ${errors} file(s) failed to download\n`);
      }
      break;
    }

    default:
      process.stderr.write(`Unknown content subcommand: ${subcommand ?? '(none)'}\n`);
      process.stderr.write(`Available: list, validate, diff, sync, export, pull\n`);
      process.exit(1);
  }
}

/** Read all of stdin as a UTF-8 string. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * `hook <source>` subcommand: reads the editor's JSON hook payload from
 * stdin, normalizes + evaluates policy + spools the receipt, then writes
 * the editor-native response JSON to stdout. Malformed stdin (not valid
 * JSON) defaults to allow rather than crashing the editor's hook pipeline.
 */
async function handleHookCommand(source: string | undefined): Promise<void> {
  if (!(source && isImplementedHookSource(source))) {
    process.stderr.write(
      `Unsupported hook source: ${source ?? '(none)'}. Supported: cursor, claude-code, vscode, grok\n`,
    );
    process.exitCode = 1;
    return;
  }

  const stdin = await readStdin();
  let rawInput: unknown;
  try {
    rawInput = JSON.parse(stdin);
  } catch {
    process.stderr.write('revealui-harnesses hook: invalid JSON on stdin, defaulting to allow\n');
    process.stdout.write(`${JSON.stringify({ permission: 'allow', decision: 'approve' })}\n`);
    return;
  }

  const result = await runHookCommand(source, rawInput, defaultHookRunOptions());
  process.stdout.write(`${JSON.stringify(result.responseJson)}\n`);
  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}

async function main() {
  if (command === 'hook') {
    const [source] = args;
    await handleHookCommand(source);
    return;
  }

  // GAP-381 Phase D: ACP agent over stdio (blocks until client disconnects).
  if (command === 'acp') {
    const connection = runRevealUiAcpAgentStdio();
    await connection.closed;
    return;
  }

  if (command === 'content') {
    const [subcommand] = args;
    const contentArgs = args.slice(1);
    await handleContentCommand(subcommand, contentArgs);
    return;
  }

  if (command === 'hotfix') {
    const code = runHotfixCli(args);
    process.exit(code);
  }

  if (command === 'tmpscript' || command === 'temp-script') {
    const code = runTmpscriptCli(args);
    process.exit(code);
  }

  if (command === 'inference') {
    const [subcommand, tierArg] = args;
    const inference = new InferenceService();
    if (subcommand === 'profile' || subcommand === 'status') {
      const view = await inference.profileGet();
      process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
      return;
    }
    if (subcommand === 'apply') {
      const tier = tierArg as 'idle' | 'daily' | 'snaps' | 'heavy' | undefined;
      if (!(tier && ['idle', 'daily', 'snaps', 'heavy'].includes(tier))) {
        process.stderr.write(
          'Usage: revealui-harnesses inference apply <idle|daily|snaps|heavy>\n',
        );
        process.exit(1);
      }
      const view = await inference.profileApply(tier);
      process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
      return;
    }
    if (subcommand === 'reconcile') {
      const view = await inference.profileReconcile();
      process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
      return;
    }
    process.stderr.write('Usage: revealui-harnesses inference <status|apply|reconcile> [tier]\n');
    process.exit(1);
  }

  if (command === 'skills') {
    const [subcommand] = args;
    const projectIdx = args.indexOf('--project');
    const revskillsIdx = args.indexOf('--revskills');
    const asJson = args.includes('--json');
    const projectRoot =
      projectIdx >= 0 ? (args[projectIdx + 1] ?? DEFAULT_PROJECT) : DEFAULT_PROJECT;
    const revskillsRoot = revskillsIdx >= 0 ? args[revskillsIdx + 1] : undefined;
    if (subcommand === 'invoke') {
      const skillId = args[1];
      if (!skillId) {
        process.stderr.write(
          'Usage: revealui-harnesses skills invoke <doctor|recover|checkpoint> [--dry-run] [--project <dir>] [--revskills <dir>]\n',
        );
        process.exit(1);
      }
      const dryRun = args.includes('--dry-run');
      const { buildSkillInvokeRequest } = await import('./content/skill-invoke.js');
      const catalog = listSkillCatalog({
        projectRoot,
        revskillsRoot,
        includeDefinitions: true,
      });
      const prepared = buildSkillInvokeRequest(skillId, catalog);
      if ('error' in prepared) {
        process.stderr.write(`${prepared.error}\n`);
        process.exit(1);
      }
      if (dryRun) {
        process.stdout.write(
          `${JSON.stringify({ ...prepared, dryRun: true, ran: false }, null, 2)}\n`,
        );
        return;
      }
      const { runNativeSkillInvoke } = await import('./content/skill-invoke-runtime.js');
      const result = await runNativeSkillInvoke({
        skillId,
        catalog,
        projectRoot,
        revskillsRoot,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (result.error) process.exit(1);
      return;
    }
    if (subcommand !== 'list') {
      process.stderr.write(
        'Usage: revealui-harnesses skills <list|invoke> [--json] [--project <dir>] [--revskills <dir>]\n',
      );
      process.exit(1);
    }
    const catalog = listSkillCatalog({
      projectRoot,
      revskillsRoot,
      includeDefinitions: true,
    });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${catalog.length} skills\n`);
    for (const skill of catalog) {
      process.stdout.write(`${skill.id}\t${skill.source}\t${skill.name}\t${skill.description}\n`);
    }
    return;
  }

  if (command === 'manager') {
    const [subcommand] = args;
    const projectIdx = args.indexOf('--project');
    const projectRoot =
      projectIdx >= 0 ? (args[projectIdx + 1] ?? DEFAULT_PROJECT) : DEFAULT_PROJECT;

    if (subcommand === 'materialize') {
      const result = materializeManager(projectRoot);
      // Equal-rank adapters: manager content + Cursor hooks + OpenCode agents/commands
      const content = writeManagerAdapterContent(projectRoot);
      process.stdout.write(`✓ Manager: ${result.managerPath}\n`);
      process.stdout.write(
        `✓ Content files: ${content.total} (${MANAGER_MATERIALIZE_GENERATORS.join(', ')})\n`,
      );
      for (const [genId, count] of Object.entries(content.byGenerator)) {
        const dest =
          genId === DEFAULT_CONTENT_GENERATOR_ID
            ? ` → ${MANAGER_CONTENT_OUTPUT}`
            : genId === 'cursor'
              ? ' → .cursor/'
              : genId === 'opencode'
                ? ' → .opencode/'
                : genId === 'grok'
                  ? ' → .grok/'
                  : '';
        process.stdout.write(`  ${genId}: ${count}${dest}\n`);
      }
      process.stdout.write(`✓ Adapter stubs:\n`);
      for (const s of result.stubs) process.stdout.write(`  ${s}\n`);
      return;
    }

    if (subcommand === 'check') {
      const result = checkManager(projectRoot);
      for (const w of result.warnings) process.stderr.write(`WARN: ${w}\n`);
      for (const e of result.errors) process.stderr.write(`ERROR: ${e}\n`);
      if (!result.ok) process.exit(1);
      process.stdout.write(`✓ Manager OK at ${join(projectRoot, '.revealui', 'manager.json')}\n`);
      return;
    }

    process.stderr.write(`Unknown manager subcommand: ${subcommand ?? '(none)'}\n`);
    process.stderr.write(`Available: materialize, check\n`);
    process.exit(1);
  }

  switch (command) {
    case 'status': {
      try {
        const infos = (await rpcCall('harness.list')) as Array<{
          id: string;
          name: string;
          version?: string;
        }>;
        if (infos.length === 0) {
          process.stdout.write('No harnesses available\n');
        } else {
          for (const info of infos) {
            process.stdout.write(
              `${info.id}\t${info.name}${info.version ? `\t${info.version}` : ''}\n`,
            );
          }
        }
      } catch (err) {
        process.stderr.write(`RPC error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
      break;
    }

    case 'list': {
      try {
        const infos = (await rpcCall('harness.list')) as Array<{ id: string; name: string }>;
        for (const info of infos) {
          process.stdout.write(`${info.id}\t${info.name}\n`);
        }
      } catch (err) {
        process.stderr.write(`RPC error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
      break;
    }

    case 'sync': {
      const [harnessId, direction] = args;
      if (!(harnessId && direction && ['push', 'pull'].includes(direction))) {
        process.stderr.write('Usage: revealui-harnesses sync <harnessId> <push|pull>\n');
        process.exit(1);
      }
      try {
        const result = (await rpcCall('harness.syncConfig', { harnessId, direction })) as {
          success: boolean;
          message?: string;
        };
        process.stdout.write(result.success ? `✓ ${result.message}\n` : `✗ ${result.message}\n`);
        if (!result.success) process.exit(1);
      } catch (err) {
        process.stderr.write(`RPC error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
      break;
    }

    case 'coordinate': {
      // dump current workboard to stdout
      const projectRoot = args[args.indexOf('--project') + 1] ?? DEFAULT_PROJECT;
      const workboardPath = join(projectRoot, '.claude', 'workboard.md');
      const manager = new WorkboardManager(workboardPath);
      const state = manager.read();
      process.stdout.write(`Agents (${state.agents.length}):\n`);
      for (const a of state.agents) {
        const stale = Date.now() - new Date(a.updated).getTime() > 4 * 60 * 60 * 1000;
        process.stdout.write(`  ${a.id} [${a.env}] — ${a.task}${stale ? ' (STALE)' : ''}\n`);
        if (a.files) process.stdout.write(`    files: ${a.files}\n`);
      }
      if (state.agents.length === 0) process.stdout.write('  (no active agents)\n');
      break;
    }

    case 'health': {
      try {
        const result = (await rpcCall('harness.health')) as {
          healthy: boolean;
          registeredHarnesses: Array<{ harnessId: string; available: boolean }>;
          workboard: { readable: boolean; sessionCount: number; staleSessionIds: string[] };
          diagnostics: string[];
        };
        process.stdout.write(`Health: ${result.healthy ? 'HEALTHY' : 'UNHEALTHY'}\n`);
        process.stdout.write(`Harnesses:\n`);
        for (const h of result.registeredHarnesses) {
          process.stdout.write(`  ${h.harnessId}: ${h.available ? 'available' : 'unavailable'}\n`);
        }
        process.stdout.write(
          `Workboard: ${result.workboard.readable ? 'readable' : 'unreadable'}, ${result.workboard.sessionCount} session(s)\n`,
        );
        if (result.workboard.staleSessionIds.length > 0) {
          process.stdout.write(`  Stale: ${result.workboard.staleSessionIds.join(', ')}\n`);
        }
        if (result.diagnostics.length > 0) {
          process.stdout.write(`Diagnostics:\n`);
          for (const d of result.diagnostics) {
            process.stdout.write(`  ${d}\n`);
          }
        }
        if (!result.healthy) process.exit(1);
      } catch (err) {
        process.stderr.write(`RPC error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
      break;
    }

    case 'session': {
      await runSessionCli(args);
      break;
    }

    default:
      process.stdout.write(`revealui-harnesses — AI harness coordination for RevealUI

Commands:
  status                            List available harnesses (requires daemon)
  list                              List harnesses in TSV format (requires daemon)
  sync <id> <push|pull>             Sync harness config to/from SSD (requires daemon)
  health                            Run health check (requires daemon)
  coordinate [--project <path>]     Print workboard state
  hook <cursor|claude-code|vscode|grok>  Normalize a hook payload from stdin, evaluate policy, spool the receipt
  acp                               Run RevealUI ACP agent on stdio (Zed / JetBrains / ACP clients)
  session register|end|peers|reap   Soft-optional RevDev session boundary + peer panel + reaper (GAP-459)
  content <subcommand>              Manage canonical content definitions
  manager materialize [--project p] Write manager.json + .revealui/content + Cursor/OpenCode surfaces + equal stubs
  manager check [--project p]       Verify project manager present and valid
  hotfix <subcommand>               Durable-debt registry (long-term fixes only; GAP-405)
  tmpscript <subcommand>            Temp-artifact lifecycle (GAP-295 control layer)
  inference status                  Local AI profile (tier, mem, engines)
  inference apply <tier>            idle|daily|snaps|heavy (host control plane)
  inference reconcile               Re-apply stored tier; start only signed snaps that fit RAM

Content Subcommands:
  content list                      List all canonical content with metadata
  content validate                  Validate all definitions against schemas
  content diff [--generator <id>] [--check] [--project p]
                                Disk vs definitions (exit 1 with --check on drift)
  content snapshot [--check|--write] [--generator <id>]  Definition ↔ committed snapshot (GAP-406)
  content sync [--generator <id>] [--dry-run]  Generate into .revealui/content (default generator)
  content export --output <path>    Export canonical + generated files to directory
  content pull [--generator <id>] [--tier oss|pro|all]  Pull rules from rules repo

Hotfix Subcommands (prefer durable root-cause fixes; register only as debt):
  hotfix check | list | store | audit [root] | sweep
  hotfix register --title T --symptom S --temporary X --durable D
  hotfix resolve <id> --pr URL | --note TEXT
  hotfix promote <id> --gap GAP-N

Tmpscript Subcommands (one-shot helpers; confirm validates then deletes):
  tmpscript check | list | store | sweep
  tmpscript register <path> --purpose "..." [--validate "cmd"]
  tmpscript confirm <id|path>

Default content generator: ${DEFAULT_CONTENT_GENERATOR_ID} → ${MANAGER_CONTENT_OUTPUT}
`);
      break;
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
