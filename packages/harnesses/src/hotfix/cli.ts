/**
 * CLI handler for `revealui-harnesses hotfix …`
 */

import { controlManifestPath } from './paths.js';
import {
  ageDays,
  auditHotfixes,
  formatAuditReport,
  formatCheckLines,
  pendingEntries,
  promoteHotfix,
  registerHotfix,
  resolveHotfix,
  sweepResolved,
} from './registry.js';
import { loadManifest } from './store.js';

function parseArgs(argv: string[]): {
  _: string[];
  title?: string;
  symptom?: string;
  temporary?: string;
  durable?: string;
  paths?: string;
  repo?: string;
  gap?: string;
  pr?: string;
  note?: string;
  id?: string;
} {
  const opts: ReturnType<typeof parseArgs> = { _: [] };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i] ?? '';
    const next = (): string => {
      i += 1;
      return argv[i] ?? '';
    };
    if (a === '--title') opts.title = next();
    else if (a === '--symptom') opts.symptom = next();
    else if (a === '--temporary') opts.temporary = next();
    else if (a === '--durable') opts.durable = next();
    else if (a === '--paths') opts.paths = next();
    else if (a === '--repo') opts.repo = next();
    else if (a === '--gap') opts.gap = next();
    else if (a === '--pr') opts.pr = next();
    else if (a === '--note') opts.note = next();
    else if (a === '--id') opts.id = next();
    else if (a.startsWith('--')) {
      throw new Error(`hotfix: unknown flag ${a}`);
    } else opts._.push(a);
    i += 1;
  }
  return opts;
}

function usage(): string {
  return `Usage (RevealUI control layer — long-term durable solutions only):
  revealui-harnesses hotfix register --title T --symptom S --temporary X --durable D [--paths p1,p2] [--repo R] [--gap GAP-N] [--id id]
  revealui-harnesses hotfix resolve  <id> --pr URL | --note TEXT
  revealui-harnesses hotfix promote  <id> --gap GAP-N
  revealui-harnesses hotfix list | check | audit [root] | sweep | store

Policy: prefer a durable root-cause fix in the owning primitive. register admits
debt; convert with resolve when the durable fix lands. Store: ${controlManifestPath()}
`;
}

/**
 * Run hotfix subcommand. Returns process exit code (0 ok, 1 error).
 * Writes to stdout/stderr.
 */
export function runHotfixCli(argv: string[]): number {
  const [cmd, ...rest] = argv;
  try {
    const opts = parseArgs(rest);
    const target = opts._[0];

    switch (cmd) {
      case 'register': {
        process.stdout.write(
          'hotfix: WARNING — register is admitted debt. Prefer durable root-cause fixes.\n',
        );
        const paths = opts.paths
          ? String(opts.paths)
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
          : [];
        const e = registerHotfix({
          title: opts.title ?? '',
          symptom: opts.symptom ?? '',
          temporary: opts.temporary ?? '',
          durable: opts.durable ?? '',
          paths,
          repo: opts.repo ?? null,
          gap: opts.gap ?? null,
          id: opts.id,
        });
        process.stdout.write(`hotfix: registered ${e.id}\n`);
        process.stdout.write(`  temporary: ${e.temporary}\n`);
        process.stdout.write(`  durable:   ${e.durable}\n`);
        process.stdout.write(
          `  marker:    // HOTFIX(${e.id}): ${e.title} → durable: ${e.durable}\n`,
        );
        process.stdout.write(
          `  when durable lands: revealui-harnesses hotfix resolve ${e.id} --pr <url>\n`,
        );
        process.stdout.write(`  store: ${controlManifestPath()}\n`);
        return 0;
      }
      case 'resolve': {
        if (!target) {
          process.stderr.write('hotfix: resolve <id> --pr <url> | --note <text>\n');
          return 1;
        }
        const e = resolveHotfix(target, { pr: opts.pr, note: opts.note });
        process.stdout.write(`hotfix: ${e.id} resolved (durable conversion recorded)\n`);
        if (e.pr) process.stdout.write(`  pr: ${e.pr}\n`);
        if (e.resolveNote) process.stdout.write(`  note: ${e.resolveNote}\n`);
        return 0;
      }
      case 'promote': {
        if (!target) {
          process.stderr.write('hotfix: promote <id> --gap GAP-NNN\n');
          return 1;
        }
        const e = promoteHotfix(target, opts.gap ?? '');
        process.stdout.write(`hotfix: ${e.id} linked to ${e.gap} (still pending until resolve)\n`);
        return 0;
      }
      case 'check': {
        for (const line of formatCheckLines()) process.stdout.write(`${line}\n`);
        return 0;
      }
      case 'list': {
        const m = loadManifest();
        if (m.entries.length === 0) {
          process.stdout.write('hotfix: no tracked hotfixes\n');
          process.stdout.write(`  store: ${controlManifestPath()}\n`);
          return 0;
        }
        for (const e of m.entries) {
          const age = ageDays(e.created).toFixed(1);
          process.stdout.write(
            `${e.status.padEnd(9)} ${e.id}  (${age}d)  ${e.title}` +
              (e.gap ? `  [${e.gap}]` : '') +
              '\n',
          );
          process.stdout.write(`          temporary: ${e.temporary}\n`);
          process.stdout.write(`          durable:   ${e.durable}\n`);
          if (e.paths.length) {
            process.stdout.write(`          paths:     ${e.paths.join(', ')}\n`);
          }
          if (e.pr) process.stdout.write(`          pr:        ${e.pr}\n`);
        }
        process.stdout.write(`  store: ${controlManifestPath()}\n`);
        return 0;
      }
      case 'audit': {
        const report = auditHotfixes(target);
        for (const line of formatAuditReport(report)) process.stdout.write(`${line}\n`);
        return 0;
      }
      case 'sweep': {
        const r = sweepResolved();
        process.stdout.write(
          `hotfix: sweep pruned ${r.pruned} old resolved entr(ies); ${r.remaining} tracked\n`,
        );
        return 0;
      }
      case 'store': {
        process.stdout.write(`${controlManifestPath()}\n`);
        process.stdout.write(`pending: ${pendingEntries().length}\n`);
        return 0;
      }
      case 'help':
      case undefined:
        process.stdout.write(usage());
        return 0;
      default:
        process.stderr.write(`hotfix: unknown command ${cmd}\n`);
        process.stderr.write(usage());
        return 1;
    }
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}
