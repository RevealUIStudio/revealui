// Test fixture: a child process that ignores SIGTERM.
//
// Used to prove SpawnerService escalates SIGTERM -> grace -> SIGKILL (GAP-353 D6).
// It stays alive under SIGTERM and only dies to SIGKILL (which is uncatchable),
// with a self-exit backstop so a run that never escalates cannot orphan it.
process.on('SIGTERM', () => {
  // deliberately ignore
});
setInterval(() => {}, 1000);
setTimeout(() => process.exit(0), 30_000).unref();
process.stdout.write('ready\n');
