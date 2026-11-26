import { availableParallelism } from 'node:os';

const WORKER_MEMORY_BYTES = 1024 * 1024 * 1024 * 1.25;

/** Available process memory includes supported runtime/container limits. */
export function phaseConcurrency(
  checkCount: number,
  resources = {
    memoryBytes: process.availableMemory(),
    cpus: availableParallelism(),
    requested: process.env.REVEALUI_GATE_CONCURRENCY,
  },
): number {
  if (
    !Number.isInteger(checkCount) ||
    checkCount < 0 ||
    !Number.isInteger(resources.cpus) ||
    resources.cpus < 1 ||
    !Number.isFinite(resources.memoryBytes) ||
    resources.memoryBytes < 0
  ) {
    throw new Error('CI gate admission rejected: invalid resource measurement.');
  }
  if (checkCount === 0) return 0;
  const byMemory = Math.floor(resources.memoryBytes / WORKER_MEMORY_BYTES);
  if (byMemory < 1) {
    throw new Error('CI gate admission rejected: less than 1.25 GiB of available process memory.');
  }
  let requested = checkCount;
  const raw = resources.requested;
  if (raw !== undefined && raw !== '') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error('REVEALUI_GATE_CONCURRENCY must be a positive integer.');
    }
    requested = parsed;
  }
  return Math.min(checkCount, requested, resources.cpus, byMemory);
}
