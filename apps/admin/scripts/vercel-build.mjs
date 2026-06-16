// Vercel build entry for the admin app (revealui-admin project).
//
// Mirrors apps/server/scripts/vercel-build.mjs. @revealui/ai and
// @revealui/services are optional peer dependencies, so they are NOT in admin's
// turbo dependency graph: `turbo build --filter=admin` never builds them. The
// admin Next.js build imports them via guarded dynamic `import(...).catch()`,
// but webpack still must RESOLVE those specifiers at build time to create the
// chunks. With the Pro packages' `dist/` missing, that resolution fails with
// "Module not found: Can't resolve '@revealui/ai/embeddings'" (and ~15 more),
// hard-failing the admin deploy (broken since the Pro packages went optional).
//
// Build the Pro packages here when their source is present (hosted repo) so
// their `dist/` exists and webpack resolves the imports. The public OSS repo
// gitignores them, so their source is absent and they are skipped (turbo errors
// on a --filter that matches no package, so we only add it when source exists).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const filters = ['--filter=admin'];
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
