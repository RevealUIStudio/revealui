#!/usr/bin/env node

/**
 * revealui-harnesses  -  CLI daemon and RPC client for AI harness coordination.
 *
 * Commands:
 *   start [--project <path>]         Detect harnesses, register in workboard, start RPC server
 *   status                           List available harnesses via RPC
 *   list                             List harnesses in TSV format
 *   sync <harnessId> <push|pull>     Sync harness config to/from SSD
 *   coordinate [--print]             Print current workboard state
 *   coordinate --init <path>         Register this session in the workboard and start daemon
 *
 * License: Pro tier required (isFeatureEnabled("harnesses"))
 */

import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  buildManifest,
  diffContent,
  generateContent,
  listContent,
  listGenerators,
  validateManifest,
} from './content/index.js';
import { HarnessCoordinator } from './coordinator.js';
import { checkHarnessesLicense } from './index.js';
import { WorkboardManager } from './workboard/workboard-manager.js';

const DATA_DIR = join(homedir(), '.local', 'share', 'revealui');
const DEFAULT_SOCKET = join(DATA_DIR, 'harness.sock');
const PID_FILE = join(DATA_DIR, 'harness.pid');
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
  const projectRoot = process.cwd();
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
      const generatorId = genIdx >= 0 ? (args[genIdx + 1] ?? 'claude-code') : 'claude-code';
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
      }
      break;
    }

    case 'sync': {
      const genIdx = args.indexOf('--generator');
      const generatorId = genIdx >= 0 ? (args[genIdx + 1] ?? 'claude-code') : 'claude-code';
      const dryRun = args.includes('--dry-run');
      const files = generateContent(generatorId, manifest, ctx);

      if (dryRun) {
        process.stdout.write(`Dry run — would write ${files.length} files:\n`);
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
        process.stdout.write(`✓ Wrote ${written} files via ${generatorId} generator\n`);
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
      const generatorId = genIdx >= 0 ? (args[genIdx + 1] ?? 'claude-code') : 'claude-code';
      const tierIdx = args.indexOf('--tier');
      const tierFilter = tierIdx >= 0 ? (args[tierIdx + 1] ?? 'oss') : 'oss';

      if (!['oss', 'pro', 'all'].includes(tierFilter)) {
        process.stderr.write(`Invalid tier: ${tierFilter}. Use: oss, pro, all\n`);
        process.exit(1);
      }

      // Pro tier requires a valid license
      const needsLicense = tierFilter === 'pro' || tierFilter === 'all';
      if (needsLicense) {
        const licensed = await checkHarnessesLicense();
        if (!licensed) {
          process.stderr.write(
            'Pro rules require a valid license key. Visit https://revealui.com/pricing\n',
          );
          process.exit(1);
        }
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

async function main() {
  // Developer tooling commands  -  no license required
  // content: canonical content management
  // start/coordinate/health: daemon coordination (multi-agent developer workflow)
  const unlicensedCommands = new Set(['content', 'start', 'coordinate', 'health']);
  if (command === 'content') {
    const [subcommand] = args;
    const contentArgs = args.slice(1);
    await handleContentCommand(subcommand, contentArgs);
    return;
  }

  if (!(unlicensedCommands.has(command ?? '') || (await checkHarnessesLicense()))) {
    process.stderr.write(
      '⚠  @revealui/harnesses requires a Pro license. Visit https://revealui.com/pricing\n',
    );
    process.exit(2);
  }

  switch (command) {
    case 'start': {
      const projectIdx = args.indexOf('--project');
      const projectRoot =
        projectIdx >= 0 ? (args[projectIdx + 1] ?? DEFAULT_PROJECT) : DEFAULT_PROJECT;

      const httpPortIdx = args.indexOf('--http-port');
      const httpPort = httpPortIdx >= 0 ? Number(args[httpPortIdx + 1]) : undefined;
      const httpHostIdx = args.indexOf('--http-host');
      const httpHost = httpHostIdx >= 0 ? (args[httpHostIdx + 1] ?? '0.0.0.0') : undefined;
      const httpStaticIdx = args.indexOf('--http-static');
      const httpStaticDir = httpStaticIdx >= 0 ? args[httpStaticIdx + 1] : undefined;

      const coordinator = new HarnessCoordinator({
        projectRoot,
        task: 'Harness coordination active',
        httpPort,
        httpHost,
        httpStaticDir,
      });

      await coordinator.start();

      // Write PID file for external process management
      mkdirSync(dirname(PID_FILE), { recursive: true });
      writeFileSync(PID_FILE, String(process.pid), 'utf8');

      const ids = await coordinator.getRegistry().listAvailable();
      process.stdout.write(`✓ Detected harnesses: ${ids.length > 0 ? ids.join(', ') : 'none'}\n`);
      process.stdout.write(`✓ RPC server listening on ${DEFAULT_SOCKET}\n`);
      process.stdout.write(`✓ PID ${process.pid} written to ${PID_FILE}\n`);
      process.stdout.write(`✓ Session registered in workboard\n`);

      if (httpPort) {
        const gateway = coordinator.getHttpGateway();
        process.stdout.write(`✓ HTTP gateway listening on ${httpHost ?? '0.0.0.0'}:${httpPort}\n`);
        if (gateway) {
          process.stdout.write(`✓ Pairing code: ${gateway.getPairingCode()}\n`);
        }
      }

      const shutdown = async () => {
        await coordinator.stop();
        try {
          unlinkSync(PID_FILE);
        } catch {
          /* already removed */
        }
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      break;
    }

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
      if (args.includes('--init')) {
        const pathIdx = args.indexOf('--init');
        const projectRoot = args[pathIdx + 1] ?? DEFAULT_PROJECT;
        const coordinator = new HarnessCoordinator({ projectRoot, task: 'Coordinate harnesses' });
        await coordinator.start();
        const workboard = coordinator.getWorkboard();
        const conflicts = workboard.checkConflicts('', []);
        process.stdout.write(
          `✓ Session registered. Conflicts: ${conflicts.clean ? 'none' : conflicts.conflicts.length}\n`,
        );
        await coordinator.stop();
      } else {
        // --print: dump current workboard to stdout
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
      }
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

    default:
      process.stdout.write(`revealui-harnesses — AI harness coordination for RevealUI

Commands:
  start [--project <path>]          Start daemon (detects harnesses, registers session)
  status                            List available harnesses (requires daemon)
  list                              List harnesses in TSV format (requires daemon)
  sync <id> <push|pull>             Sync harness config to/from SSD (requires daemon)
  health                            Run health check (requires daemon)
  coordinate [--project <path>]     Print workboard state
  coordinate --init [<path>]        Register + start daemon
  content <subcommand>              Manage canonical content definitions

Content Subcommands:
  content list                      List all canonical content with metadata
  content validate                  Validate all definitions against schemas
  content diff [--generator <id>]   Show what would change vs current files
  content sync [--generator <id>] [--dry-run]  Generate and write files
  content export --output <path>    Export canonical + generated files to directory
  content pull [--generator <id>] [--tier oss|pro|all]  Pull rules from rules repo
`);
      break;
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
