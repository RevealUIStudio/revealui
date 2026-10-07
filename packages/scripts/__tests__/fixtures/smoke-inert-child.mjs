/** Execute the actual smoke CLI with an inert process and synthetic health. */
import { EventEmitter } from 'node:events';
import { writeSync } from 'node:fs';
import { registerHooks } from 'node:module';

const child = new EventEmitter();
child.stdout = new EventEmitter();
child.stderr = new EventEmitter();
child.exitCode = null;
child.signalCode = null;
child.killed = false;
const signals = [];
let closed = false;
let fetchAborted = false;
const cancelPending = process.env.SMOKE_TEST_CASE === 'cancel-pending';
const errorPending = process.env.SMOKE_TEST_CASE === 'error-pending';
const exitPending = process.env.SMOKE_TEST_CASE === 'exit-pending';
const closePending = process.env.SMOKE_TEST_CASE === 'close-pending';
const cancelCleanup = process.env.SMOKE_TEST_CASE === 'cancel-cleanup';
const cancelPoll = process.env.SMOKE_TEST_CASE === 'cancel-poll';
const disposeListeners = process.env.SMOKE_TEST_CASE === 'dispose-listeners';
const disposeTimers = process.env.SMOKE_TEST_CASE === 'dispose-timers';
const readyCleanup = disposeListeners || disposeTimers;
const activeTimers = new Map();
const borrowedListeners = [];
if (readyCleanup) {
  for (const [target, event, label] of [[child, 'error', 'child:error'], [child, 'exit', 'child:exit'], [child, 'close', 'child:close'], [child.stdout, 'data', 'stdout:data'], [child.stderr, 'data', 'stderr:data']]) {
    const listener = () => {};
    target.on(event, listener);
    borrowedListeners.push({ target, event, listener, label });
  }
}
let pollCompleted = false;
let pollCancelled = false;
let pollTimer;
const cleanupCase = (process.env.SMOKE_TEST_CASE || '').startsWith('cleanup-');
const cleanupBootError = cleanupCase && process.env.SMOKE_TEST_CASE.includes('-error-');
const pendingHealth = cancelPending || errorPending || exitPending || closePending || process.env.SMOKE_TEST_CASE === 'deadline-pending';
child.kill = (signal) => {
  signals.push(signal);
  if (cleanupCase) {
    if (process.env.SMOKE_TEST_CASE.endsWith('-false')) return false;
    if (process.env.SMOKE_TEST_CASE.endsWith('-throw')) throw new Error(`synthetic ${signal} failure`);
    child.killed = true;
    return true;
  }
  child.killed = true;
  if (pendingHealth || cancelPoll || readyCleanup) queueMicrotask(() => {
    child.signalCode = signal;
    child.emit('exit', null, signal);
    closed = true;
    child.emit('close', null, signal);
  });
  if (cancelCleanup) {
    realTimeout(() => process.kill(process.pid, 'SIGINT'), 10);
    realTimeout(() => {
      child.signalCode = signal;
      child.emit('exit', null, signal);
      closed = true;
      child.emit('close', null, signal);
    }, 20);
  }
  return true;
};
globalThis.__smokeSpawn = () => {
  if (process.env.SMOKE_TEST_CASE === 'spawn-throw') throw new Error('synthetic synchronous spawn failure');
  if (cleanupCase) {
    if (cleanupBootError) queueMicrotask(() => child.emit('error', new Error('synthetic primary boot failure')));
    return child;
  }
  if (pendingHealth || cancelCleanup || cancelPoll || readyCleanup) return child;
  queueMicrotask(() => {
    if (['spawn-error', 'spawn-error-ready'].includes(process.env.SMOKE_TEST_CASE)) {
      child.emit('error', new Error('synthetic child spawn failure'));
      closed = true;
      child.emit('close', -2, null);
      return;
    }
    child.signalCode = 'SIGTERM';
    child.emit('exit', null, 'SIGTERM');
    closed = true;
    child.emit('close', null, 'SIGTERM');
  });
  return child;
};
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'node:child_process') return {
    url: 'data:text/javascript,' + encodeURIComponent('export const spawn = (...args) => globalThis.__smokeSpawn(...args);'),
    shortCircuit: true,
  };
  return next(specifier, context);
} });
const realTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = (callback, milliseconds, ...args) => {
  if (cancelPoll && milliseconds === 500) {
    pollTimer = realTimeout(() => { pollCompleted = true; callback(...args); }, 500);
    realTimeout(() => process.kill(process.pid, 'SIGTERM'), 10);
    return pollTimer;
  }
  const timer = realTimeout(
    () => { activeTimers.delete(timer); callback(...args); },
    disposeTimers && milliseconds === 2000 ? 500 :
    pendingHealth && milliseconds === 2000 ? 100 :
    cancelPoll && milliseconds === 90_000 ? 1000 :
      ((cancelPending || errorPending || exitPending || closePending) && milliseconds === 90_000) || cancelCleanup
        ? Math.min(milliseconds, 100) : Math.min(milliseconds, 5),
  );
  if (disposeTimers) activeTimers.set(timer, milliseconds);
  return timer;
};
globalThis.clearTimeout = (timer) => {
  activeTimers.delete(timer);
  if (cancelPoll && timer === pollTimer && !pollCompleted) pollCancelled = true;
  return realClearTimeout(timer);
};
if (disposeTimers) {
  // Route the intrinsic timeout through the same observed timer boundary as
  // explicit request timers; both implementations must release actual work.
  AbortSignal.timeout = (milliseconds) => {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new DOMException('synthetic request timeout', 'TimeoutError')), milliseconds);
    timer.unref();
    return timeout.signal;
  };
}
let time = 0;
Date.now = () => { time += 10_000; return time; };
globalThis.fetch = async (url, options) => {
  if (cancelCleanup) return { ok: true };
  if (readyCleanup) return { ok: true };
  if (cancelPoll) return { ok: false };
  if (cleanupCase) return { ok: true };
  if (pendingHealth) return new Promise((resolve, reject) => {
    // A real pending fetch owns a socket handle. Keep this inert substitute
    // alive until cancellation so Node can dispatch the queued OS signal.
    const watchdog = realTimeout(() => process.exit(97), 1000);
    options.signal.addEventListener('abort', () => {
      clearTimeout(watchdog);
      fetchAborted = true;
      reject(options.signal.reason);
    }, { once: true });
    if (cancelPending) realTimeout(() => process.kill(process.pid, 'SIGTERM'), 10);
    if (errorPending) realTimeout(() => {
      child.emit('error', new Error('synthetic child failure during health'));
      closed = true;
      child.emit('close', -2, null);
    }, 10);
    if (exitPending) realTimeout(() => {
      child.signalCode = 'SIGTERM';
      child.emit('exit', null, 'SIGTERM');
      closed = true;
      child.emit('close', null, 'SIGTERM');
    }, 10);
    if (closePending) realTimeout(() => {
      closed = true;
      child.emit('close', 0, null);
    }, 10);
  });
  if (process.env.SMOKE_TEST_CASE === 'spawn-error-ready') return { ok: true };
  throw new Error('synthetic API is not ready');
};
function report() {
  const remainingOwnedListeners = borrowedListeners.flatMap(({ target, event, listener, label }) =>
    target.listeners(event).some((candidate) => candidate !== listener) ? [label] : [],
  );
  const borrowedListenersPreserved = borrowedListeners.every(({ target, event, listener }) => target.listeners(event).includes(listener));
  const activeTimerDurations = [...activeTimers.values()];
  const remainingProcessSignals = ['SIGINT', 'SIGTERM'].filter((event) => process.listenerCount(event) > 0);
  writeSync(1, 'INERT_CHILD_RECEIPT:' + JSON.stringify({ closed, signals, fetchAborted, pollCompleted, pollCancelled, remainingOwnedListeners, borrowedListenersPreserved, activeTimerDurations, remainingProcessSignals }) + '\n');
}
process.once('exit', report);
