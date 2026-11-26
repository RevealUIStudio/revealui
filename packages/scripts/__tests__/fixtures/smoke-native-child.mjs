/** Inert API replacement; run the real smoke CLI against an owned native child. */
import { spawn } from 'node:child_process';
import { writeSync } from 'node:fs';
import { registerHooks } from 'node:module';

const nativeChild = spawn(process.execPath, ['-e', `
  process.on('SIGTERM', () => {});
  console.log('OWNED_CHILD_READY');
  setInterval(() => {}, 1000);
`], { stdio: ['ignore', 'pipe', 'pipe'] });
const signals = [];
let closed = false;
let successAfterClose = null;
const close = new Promise((resolve) => {
  nativeChild.once('close', () => { closed = true; resolve(); });
});
const ready = new Promise((resolve, reject) => {
  nativeChild.stdout.once('data', resolve);
  nativeChild.once('error', reject);
});
const nativeKill = nativeChild.kill.bind(nativeChild);
nativeChild.kill = (signal) => {
  signals.push(signal);
  if (process.env.SMOKE_NATIVE_CASE === 'kill-false') return false;
  return nativeKill(signal);
};
globalThis.__smokeOwnedChild = nativeChild;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'node:child_process') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent('export const spawn = () => globalThis.__smokeOwnedChild;'),
      shortCircuit: true,
    };
  }
  return next(specifier, context);
} });
globalThis.fetch = async () => { await ready; return { ok: true }; };
const originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...args) => {
  if (String(chunk).startsWith('server-tsx-boot-smoke: OK')) successAfterClose = closed;
  return originalWrite(chunk, ...args);
};
let reported = false;
function report(reason) {
  if (reported) return;
  reported = true;
  writeSync(1, 'OWNED_CHILD_RECEIPT:' + JSON.stringify({ reason, closed, successAfterClose, signals }) + '\n');
}
// Capture the product's state BEFORE independent harness cleanup. Cleanup never
// contributes a product signal or turns an unconfirmed product exit into a pass.
const originalExit = process.exit.bind(process);
process.exit = (code) => {
  report('product-exit');
  if (!closed) nativeKill('SIGKILL');
  void close.then(() => originalExit(code));
};
process.once('exit', () => report('natural-exit'));
const watchdog = setTimeout(() => {
  report('fixture-timeout');
  if (!closed) nativeKill('SIGKILL');
  void close.then(() => originalExit(98));
}, 15_000);
watchdog.unref();
