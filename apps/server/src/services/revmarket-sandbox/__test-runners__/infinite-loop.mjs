// Test fixture: runner that ignores the task and spins forever on a CPU-bound
// loop. Used by forkProvider tests to verify timeout-driven SIGTERM/SIGKILL
// escalation kills the fork.
process.on('message', (msg) => {
  if (msg?.type !== 'task') return;
  // Tight loop with periodic noop so V8 doesn't optimize the whole thing
  // away. Has no exit condition — only the parent's SIGKILL stops it.
  let counter = 0;
  while (true) {
    counter = (counter + 1) | 0;
    if (counter < 0) counter = 0;
  }
});
