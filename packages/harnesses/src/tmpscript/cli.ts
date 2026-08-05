/**
 * CLI handler for `revealui-harnesses tmpscript …`
 */

import { controlManifestPath } from './paths.js';
import {
  ageDays,
  confirmTmpscript,
  formatCheckLines,
  pendingEntries,
  registerTmpscript,
  sweepTmpscript,
} from './registry.js';
import { loadManifest } from './store.js';

function parseArgs(argv: string[]): {
  _: string[];
  purpose?: string;
  validate?: string;
} {
  const opts: ReturnType<typeof parseArgs> = { _: [] };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i] ?? '';
    const next = (): string => {
      i += 1;
      return argv[i] ?? '';
    };
    if (a === '--purpose') opts.purpose = next();
    else if (a === '--validate') opts.validate = next();
    else if (a.startsWith('--')) {
      throw new Error(`tmpscript: unknown flag ${a}`);
    } else opts._.push(a);
    i += 1;
  }
  return opts;
}

function usage(): string {
  return `Usage (RevealUI control layer — temp-artifact lifecycle, GAP-295):
  revealui-harnesses tmpscript register <path> --purpose "..." [--validate "cmd"]
  revealui-harnesses tmpscript confirm  <id|path>
  revealui-harnesses tmpscript list | check | sweep | store

confirm runs --validate (if set; must exit 0) then deletes the file.
check is warn-only (session-boundary hooks). Store: ${controlManifestPath()}
`;
}

/**
 * Run tmpscript subcommand. Returns process exit code (0 ok, 1 error).
 */
export function runTmpscriptCli(argv: string[]): number {
  const [cmd, ...rest] = argv;
  try {
    const opts = parseArgs(rest);
    const target = opts._[0];

    switch (cmd) {
      case 'register': {
        if (!target) {
          process.stderr.write(
            'usage: tmpscript register <path> --purpose "..." [--validate "cmd"]\n',
          );
          return 1;
        }
        const e = registerTmpscript({
          path: target,
          purpose: opts.purpose,
          validate: opts.validate ?? null,
        });
        process.stdout.write(`tmpscript: registered ${e.id} (${e.path})\n`);
        process.stdout.write(
          `tmpscript: after it has served its purpose run: revealui-harnesses tmpscript confirm ${e.id}\n`,
        );
        process.stdout.write(`tmpscript: store: ${controlManifestPath()}\n`);
        return 0;
      }
      case 'confirm': {
        if (!target) {
          process.stderr.write('usage: tmpscript confirm <id|path>\n');
          return 1;
        }
        const e = confirmTmpscript(target);
        process.stdout.write(`tmpscript: ${e.id} confirmed + cleaned\n`);
        if (e.path) process.stdout.write(`  path: ${e.path}\n`);
        return 0;
      }
      case 'check': {
        for (const line of formatCheckLines()) process.stdout.write(`${line}\n`);
        return 0;
      }
      case 'list': {
        const m = loadManifest();
        if (m.entries.length === 0) {
          process.stdout.write('tmpscript: no tracked temp scripts\n');
          process.stdout.write(`  store: ${controlManifestPath()}\n`);
          return 0;
        }
        for (const e of m.entries) {
          const age = ageDays(e.created).toFixed(1);
          process.stdout.write(
            `${e.status.padEnd(9)} ${e.id}  (${age}d)  ${e.path}\n` +
              `          purpose: ${e.purpose}` +
              (e.validate ? `\n          validate: ${e.validate}` : '') +
              '\n',
          );
        }
        process.stdout.write(`  store: ${controlManifestPath()}\n`);
        return 0;
      }
      case 'sweep': {
        const r = sweepTmpscript();
        process.stdout.write(
          `tmpscript: sweep done — ${r.removedFiles} file(s) removed, ${r.prunedEntries} old entr(ies) pruned, ${r.remaining} tracked\n`,
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
        process.stderr.write(`tmpscript: unknown command ${cmd}\n`);
        process.stderr.write(usage());
        return 1;
    }
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}
