import { execFileSync } from 'node:child_process';

export function auditStandaloneProductionDependencies(outDir, run = execFileSync) {
  run('npm', ['audit', '--omit=dev', '--audit-level=low'], {
    cwd: outDir,
    stdio: 'inherit',
  });
}
