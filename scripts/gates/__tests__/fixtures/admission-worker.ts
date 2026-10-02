// Synthetic subprocess fixture: exercise the maintained gate/exec primitives.
import { runCheck, withGateAdmission } from '../../ci-gate.js';

process.availableMemory = () => 4 * 1024 ** 3;
const marker = process.argv[2];
if (!marker) throw new Error('worker fixture requires a marker path');

await withGateAdmission(async () => {
  await runCheck({
    name: 'synthetic retained worker',
    command: process.execPath,
    args: [
      '-e',
      'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
      marker,
    ],
  });
});
