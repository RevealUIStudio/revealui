import { controlManifestPath } from './paths.js';
import {
  confirmTmpscript,
  formatCheckLines,
  registerTmpscript,
  sweepTmpscript,
} from './registry.js';
import { importManifest, loadManifest } from './store.js';
import type { TmpscriptStoreOptions } from './types.js';

const usage = `Usage: revealui-harnesses tmpscript
  register <path> --purpose <description>
  confirm <id|path> --sha256 <digest> --evidence <outcome-reference>
  import <manifest-path>
  list | check | sweep | store

Inspection and sweep never write state. Confirm records evidence and retains the file.
No command executes stored validation text or removes artifacts. Retirement belongs to
an owning tool with fresh consumer, preservation and source checks. Legacy imports are
explicit and held for reconciliation. Never use age as removal authority.
`;
export function runTmpscriptCli(argv: string[], options?: TmpscriptStoreOptions): number {
  try {
    const [command, ...args] = argv;
    const flags = new Map<string, string>();
    const positional: string[] = [];
    const allowed =
      command === 'register'
        ? ['--purpose']
        : command === 'confirm'
          ? ['--sha256', '--evidence']
          : [];
    const argumentsIterator = args.values();
    for (const arg of argumentsIterator) {
      if (!arg.startsWith('--')) {
        positional.push(arg);
        continue;
      }
      if (!allowed.includes(arg) || flags.has(arg))
        throw new Error('tmpscript: unknown or repeated flag');
      const value = argumentsIterator.next().value;
      if (!value || value.startsWith('--')) throw new Error('tmpscript: missing flag value');
      flags.set(arg, value);
    }
    const target = positional[0];
    const needsTarget = ['register', 'confirm', 'import'].includes(command ?? '');
    if (positional.length !== (needsTarget ? 1 : 0))
      throw new Error('tmpscript: unexpected or missing argument');
    switch (command) {
      case 'register': {
        if (!target) throw new Error('tmpscript: path required');
        const e = registerTmpscript({ path: target, purpose: flags.get('--purpose') }, options);
        process.stdout.write(`tmpscript: registered ${JSON.stringify(e.id)}; source retained\n`);
        break;
      }
      case 'confirm': {
        if (!target) throw new Error('tmpscript: id required');
        const e = confirmTmpscript(target, {
          ...options,
          expectedSha256: flags.get('--sha256'),
          evidence: flags.get('--evidence'),
        });
        process.stdout.write(
          `tmpscript: ${JSON.stringify(e.id)} completion recorded; source retained\n`,
        );
        break;
      }
      case 'import': {
        if (!target) throw new Error('tmpscript: source manifest required');
        const m = importManifest(target, options);
        process.stdout.write(
          `tmpscript: ${m.entries.length} entries imported on hold; originals retained\n`,
        );
        break;
      }
      case 'check':
        for (const line of formatCheckLines(loadManifest(options)))
          process.stdout.write(`${line}\n`);
        break;
      case 'list': {
        const m = loadManifest(options);
        if (m.importRequired)
          process.stdout.write('tmpscript: explicit legacy import required; all entries held\n');
        for (const e of m.entries) {
          // Existing session checks recognize a leading pending token. Held legacy
          // records must remain visible to those callers rather than appear complete.
          const label = e.status === 'held' ? 'pending' : e.status;
          process.stdout.write(
            `${label.padEnd(9)} ${JSON.stringify(e.id)}  state=${e.status}; source retained\n`,
          );
        }
        if (!m.entries.length) process.stdout.write('tmpscript: no tracked artifacts\n');
        break;
      }
      case 'sweep':
        process.stdout.write(`${JSON.stringify(sweepTmpscript(options), null, 2)}\n`);
        break;
      case 'store': {
        const m = loadManifest(options);
        process.stdout.write(
          `${options?.controlPath ?? controlManifestPath()}\nimport required: ${Boolean(m.importRequired)}\n`,
        );
        break;
      }
      case 'help':
      case undefined:
        process.stdout.write(usage);
        break;
      default:
        throw new Error('tmpscript: unknown command');
    }
    return 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'tmpscript: operation failed'}\n`,
    );
    return 1;
  }
}
