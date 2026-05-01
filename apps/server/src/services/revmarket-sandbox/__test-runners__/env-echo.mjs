// Test fixture: runner that posts back its env vars. Used to verify
// forkProvider strips parent env down to the safe minimum and never leaks
// REVEALUI_* secrets into the sandbox.
process.on('message', (msg) => {
  if (msg?.type !== 'task') return;
  process.send?.({
    type: 'result',
    success: true,
    output: { env: { ...process.env } },
    artifacts: [],
    tokensUsed: 0,
  });
  process.exit(0);
});
