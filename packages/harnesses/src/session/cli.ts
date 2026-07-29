/**
 * CLI: `revealui-harnesses session register|end|peers`
 * Always exits 0 for hook use (soft-optional daemon). Print status on stderr/stdout.
 *
 * GAP-459 S2: register and peers print a peer-context panel. When the daemon
 * is down the panel is a visible WARN (never silent empty peers).
 */

import { sessionEnd, sessionRegister } from './boundary.js';
import { renderPeerPanel } from './peer-context.js';

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

  process.stderr.write(`Usage:
  revealui-harnesses session register [--backend grok|claude-code|…] [--work-dir PATH] [--no-peers]
  revealui-harnesses session peers [--actor AGENT_ID]
  revealui-harnesses session end [--summary TEXT]

Soft-optional RevDev daemon session boundary (GAP control-layer peer adapters).
Always exits 0 so SessionStart/SessionEnd hooks never block.
GAP-459: register/peers print peer-context (WARN when coordination unavailable).
`);
}
