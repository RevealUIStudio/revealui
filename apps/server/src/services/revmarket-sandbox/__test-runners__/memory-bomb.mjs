// Test fixture: runner that allocates more heap than the memory cap allows on
// receiving a task. Used by forkProvider tests to verify --max-old-space-size
// enforcement kills the fork.
//
// Allocation pattern: an array of arrays, each inner array filled with unique
// objects so V8 cannot dedupe / optimize away. ~5MB per inner array, 200
// inner arrays → ~1GB heap pressure. With --max-old-space-size=64 the V8 old
// generation can't grow past ~64MB and the fork hits OOM (typically a
// FATAL ERROR exit, sometimes a SIGABRT).
process.on('message', (msg) => {
  if (msg?.type !== 'task') return;
  const heap = [];
  try {
    for (let i = 0; i < 200; i++) {
      // Each inner array: 500_000 unique objects. V8 stores object headers
      // + property slots on the heap, so this is ~5MB per iteration.
      const inner = [];
      for (let j = 0; j < 500_000; j++) {
        inner.push({ i, j, payload: `${i}-${j}` });
      }
      heap.push(inner);
    }
    // If V8 didn't OOM by here, the cap isn't doing its job — send a
    // misleading success so the test fails loudly rather than passing on
    // the wrong path.
    process.send?.({
      type: 'result',
      success: true,
      output: { allocated: heap.length, total: heap.length * 500_000 },
      artifacts: [],
      tokensUsed: 0,
    });
  } catch (err) {
    process.send?.({
      type: 'result',
      success: false,
      output: null,
      artifacts: [],
      tokensUsed: 0,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
