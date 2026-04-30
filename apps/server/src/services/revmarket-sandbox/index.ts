/**
 * RevMarket sandbox provider — public surface (GAP-161).
 *
 * - `forkProvider()` — Option A — `child_process.fork` per task. Default.
 * - `noSandboxProvider()` — opt-in trusted execution (forge / dev).
 *
 * Future Option D (containers / Vercel sandbox / Daytona) and Option E (WASM)
 * plug in here without touching the executor.
 *
 * Provider selection lives in the executor's config (`configureExecutor`) so
 * deployments can pick at boot time.
 */

export { type ForkProviderOptions, forkProvider } from './fork-provider.js';
export { type NoSandboxProviderOptions, noSandboxProvider } from './no-sandbox-provider.js';
export type {
  RunnerInboundMessage,
  RunnerOutboundMessage,
  SandboxProvider,
  SandboxResult,
  SandboxRunOptions,
} from './types.js';
