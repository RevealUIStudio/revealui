/**
 * CLI: `revealui-harnesses session register|end|peers`
 * Always exits 0 for hook use (soft-optional daemon). Print status on stderr/stdout.
 *
 * GAP-459 S2: register and peers print a peer-context panel. When the daemon
 * is down the panel is a visible WARN (never silent empty peers).
 */

import { sessionEnd, sessionRegister } from './boundary.js';
import { renderPeerPanel } from './peer-context.js';
import { DEFAULT_HEARTBEAT_STALE_SECONDS, sessionReap } from './reap.js';

function printResult(
  label: string,
  result: { ok: boolean; skipped: boolean; agentId?: string; reason?: string },
): void {
  const status = result.ok ? 'ok' : result.skipped ? 'skip' : 'fail';
  const bits = [`[session ${label}] ${status}`];
  if (result.agentId) bits.push(`agentId=${result.agentId}`);
  if (result.reason) bits.push(result.reason);
  process.stderr.write(`${bits.join(' ')}\n`);
}

function nextArg(rest: string[], i: number): string | undefined {
  return rest[i + 1];
}

async function printPeerPanel(actorAgentId?: string): Promise<void> {
  const panel = await renderPeerPanel({ actorAgentId });
  // SessionStart surfaces: stderr is reliable across Claude + Grok hooks.
  process.stderr.write(panel);
}

export async function runSessionCli(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand === 'register') {
    let backend = 'grok';
    let workDir = process.cwd();
    let skipPeers = false;
    for (let i = 0; i < rest.length; i++) {
      const nxt = nextArg(rest, i);
      if (rest[i] === '--backend' && nxt) {
        backend = nxt;
        i++;
      } else if (rest[i] === '--work-dir' && nxt) {
        workDir = nxt;
        i++;
      } else if (rest[i] === '--no-peers') {
        skipPeers = true;
      }
    }
    const result = await sessionRegister({ backend, workDir });
    printResult('register', result);
    if (!skipPeers) {
      await printPeerPanel(result.agentId);
    }
    return;
  }

  if (subcommand === 'peers') {
    let actorAgentId: string | undefined;
    for (let i = 0; i < rest.length; i++) {
      const nxt = nextArg(rest, i);
      if (rest[i] === '--actor' && nxt) {
        actorAgentId = nxt;
        i++;
      }
    }
    // Prefer explicit --actor, else this process's cached register id so
    // context.snapshot can label self without a false "unavailable" fallback.
    if (!actorAgentId) {
      const { readDaemonSessionCache } = await import('./identity-cache.js');
      actorAgentId = readDaemonSessionCache(process.ppid) ?? undefined;
    }
    await printPeerPanel(actorAgentId);
    return;
  }

  if (subcommand === 'end') {
    let exitSummary = 'hook-session-end';
    for (let i = 0; i < rest.length; i++) {
      const nxt = nextArg(rest, i);
      if (rest[i] === '--summary' && nxt) {
        exitSummary = nxt;
        i++;
      }
    }
    const result = await sessionEnd({ exitSummary });
    printResult('end', result);
    return;
  }

  if (subcommand === 'reap') {
    let heartbeatStaleSeconds = DEFAULT_HEARTBEAT_STALE_SECONDS;
    let staleDays = 7;
    let hardDeleteDays = 30;
    let dryRun = false;
    let backend = 'grok';
    for (let i = 0; i < rest.length; i++) {
      const nxt = nextArg(rest, i);
      if (rest[i] === '--heartbeat-seconds' && nxt) {
        heartbeatStaleSeconds = Number(nxt);
        i++;
      } else if (rest[i] === '--stale-days' && nxt) {
        staleDays = Number(nxt);
        i++;
      } else if (rest[i] === '--hard-delete-days' && nxt) {
        hardDeleteDays = Number(nxt);
        i++;
      } else if (rest[i] === '--backend' && nxt) {
        backend = nxt;
        i++;
      } else if (rest[i] === '--dry-run') {
        dryRun = true;
      }
    }
    const result = await sessionReap({
      heartbeatStaleSeconds,
      staleDays,
      hardDeleteDays,
      dryRun,
      backend,
    });
    const status = result.ok ? 'ok' : result.skipped ? 'skip' : 'fail';
    process.stderr.write(
      `[session reap] ${status} candidates=${result.candidates} archived=${result.archived}` +
        (result.aged !== undefined ? ` aged=${result.aged}` : '') +
        (result.deleted !== undefined ? ` deleted=${result.deleted}` : '') +
        (result.heartbeatStaleSeconds !== undefined
          ? ` heartbeatSeconds=${result.heartbeatStaleSeconds}`
          : '') +
        (result.reason ? ` ${result.reason}` : '') +
        '\n',
    );
    return;
  }

  process.stderr.write(`Usage:
  revealui-harnesses session register [--backend grok|claude-code|…] [--work-dir PATH] [--no-peers]
  revealui-harnesses session peers [--actor AGENT_ID]
  revealui-harnesses session end [--summary TEXT]
  revealui-harnesses session reap [--heartbeat-seconds N] [--stale-days N] [--hard-delete-days N] [--dry-run]

Soft-optional RevDev daemon session boundary (GAP control-layer peer adapters).
Always exits 0 so SessionStart/SessionEnd hooks never block.
GAP-459: register/peers print peer-context; end archives; reap ends abandoned rows.
`);
}
