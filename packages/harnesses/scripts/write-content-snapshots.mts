/**
 * Refresh committed generator content snapshots (GAP-406).
 * Run: pnpm --filter @revealui/harnesses content:snapshot:write
 */
import { writeAllContentSnapshots } from '../src/content/snapshot.ts';

const paths = writeAllContentSnapshots();
for (const p of paths) {
  process.stdout.write(`wrote ${p}\n`);
}
