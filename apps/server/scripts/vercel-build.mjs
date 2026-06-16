// Vercel build entry for the server (revealui-api project).
//
// Builds `server` AND the optional Pro packages (@revealui/services,
// @revealui/ai) when their source is present in this checkout. The Pro
// packages are declared as OPTIONAL peer dependencies so OSS / Docker builds
// can omit them, which means `turbo build --filter=server` does NOT build them
// (they are not in server's dependency graph). On the hosted Vercel build that
// left their `dist/` missing at file-trace time, so Vercel's tracer could not
// include them in the function and every Pro route (billing/checkout via
// getServices(), RAG/agents via getAiModule()) failed: a stray static import
// crashed the whole function on cold start, and the guarded dynamic loaders
// 503'd. Building the Pro packages here makes their `dist/` exist so the tracer
// pulls them into the deployed function.
//
// The public OSS repo gitignores the Pro packages, so their source is absent
// there and they are simply skipped (turbo errors on a --filter that matches no
// package, so we only add the filter when the source exists).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const filters = ['--filter=server'];
for (const pkg of ['services', 'ai']) {
  if (existsSync(resolve(repoRoot, `packages/${pkg}/src/index.ts`))) {
    filters.push(`--filter=@revealui/${pkg}`);
  }
}

console.log(`[vercel-build] turbo build ${filters.join(' ')}`);
execFileSync('pnpm', ['turbo', 'build', ...filters], {
  cwd: repoRoot,
  stdio: 'inherit',
});
