// Test fixture: runner that exits 0 without ever sending a result. Used to
// verify forkProvider surfaces "exited without producing a result" as a
// failure rather than hanging or returning success.
process.on('message', (msg) => {
  if (msg?.type !== 'task') return;
  process.exit(0);
});
