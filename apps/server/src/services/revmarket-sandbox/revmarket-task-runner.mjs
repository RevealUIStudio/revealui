/**
 * RevMarket fork-target runner (GAP-161).
 *
 * Spawned by `forkProvider()` in `fork-provider.ts`. Receives one task message
 * over IPC, runs the matching agent skill, posts the result back, and exits.
 *
 * Written as plain ESM JavaScript (`.mjs`) so it can be `child_process.fork`'d
 * directly by Node in both dev (tsx-driven parent) and prod (compiled-JS parent)
 * without depending on a TypeScript build for the fork target itself. Wire-format
 * messages are stable (see RunnerInboundMessage / RunnerOutboundMessage in
 * `types.ts`).
 *
 * Phase B contract:
 *   - Today, agent skills don't yet have runtime code. This runner returns a
 *     structured stub identical to the previous in-process placeholder
 *     (revmarket-executor.ts pre-GAP-161). When real agent code lands (Phase C+),
 *     this is the integration point: replace `runStub` with a dispatcher that
 *     loads the agent module by ID and invokes the skill.
 *   - Runner errors are caught and surfaced as `{ success: false, error }`.
 *   - Runner top-level throws crash the fork; parent's exit handler turns
 *     that into a `failed` task.
 *
 * Sandbox-side hygiene:
 *   - cwd is set by the parent to a per-task tmpdir.
 *   - env is stripped to PATH/HOME/NODE_ENV/REVMARKET_*.
 *   - --max-old-space-size enforces the memory cap.
 */

if (process.env.REVMARKET_SANDBOX !== '1') {
  // Belt-and-suspenders: refuse to run if not invoked by the sandbox parent.
  // Stops accidental direct invocation that would skip the env-stripping +
  // memory cap setup.
  console.error('revmarket-task-runner must be spawned by forkProvider; refusing direct invoke');
  process.exit(2);
}

process.on('message', async (msg) => {
  if (!msg || typeof msg !== 'object' || msg.type !== 'task') {
    sendResult({
      success: false,
      output: null,
      artifacts: [],
      tokensUsed: 0,
      error: `Unexpected message shape: ${JSON.stringify(msg).slice(0, 200)}`,
    });
    process.exit(1);
    return;
  }

  try {
    const result = await runStub(msg);
    sendResult(result);
    process.exit(0);
  } catch (err) {
    sendResult({
      success: false,
      output: null,
      artifacts: [],
      tokensUsed: 0,
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
});

// Fail loud if the parent never sends a task within a generous bound. Belt-and-
// suspenders against the parent dying mid-handshake; the parent's own timeout
// will normally fire first.
setTimeout(() => {
  console.error('revmarket-task-runner: no task received within 60s, exiting');
  process.exit(3);
}, 60_000).unref();

/**
 * Stub agent execution — mirrors the placeholder behavior from the pre-GAP-161
 * `runAgentTask` in revmarket-executor.ts. Real agent dispatch will replace
 * this body when agent runtime code lands.
 */
async function runStub(task) {
  return {
    success: true,
    output: {
      taskId: task.taskId,
      skillName: task.skillName,
      status: 'executed',
      message: 'Task processed by RevMarket sandbox runner',
    },
    artifacts: [],
    tokensUsed: 0,
  };
}

function sendResult(payload) {
  if (typeof process.send !== 'function') {
    // Not running under fork IPC — nothing to send to. Print to stderr so
    // it's visible if the runner is ever launched manually for debugging.
    console.error('revmarket-task-runner: no IPC channel; result discarded:', payload);
    return;
  }
  process.send({ type: 'result', ...payload });
}
