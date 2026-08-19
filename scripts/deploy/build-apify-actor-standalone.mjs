#!/usr/bin/env node
/**
 * Standalone publish build for the governed-agent-run Apify actor (GAP-431).
 *
 * packages/apify-actor-governed-run stays a normal `workspace:*` package for
 * local dev + the vitest suite. This script produces a SEPARATE, self-
 * contained output directory whose Docker build needs only its own directory
 * as build context -- `@revealui/*` runtime deps install from the PUBLIC npm
 * registry, never `workspace:*`. That output directory is what
 * `apify push --dir` targets.
 *
 * Version pins are NOT uniform: `@revealui/security` + `@revealui/ai` are the
 * guardrail-2-sensitive signing/agent-loop surface, so they are pinned to the
 * REVIEWED_VERSIONS constants below (authoritative, bumped only by a reviewed
 * PR editing this file) with a warn-only drift check against the registry.
 * `apify` + `zod` are third-party and resolve to whatever npm reports as
 * latest at build time (see `resolveVersion`), same as before.
 *
 * Why a build step instead of hand-maintaining a second package.json: the
 * `@revealui/security` / `@revealui/ai` versions drift as those packages
 * publish, and hand-editing two Dockerfiles + two package.jsons in lockstep
 * is exactly the kind of drift the fleet's `extend-before-create` /
 * `code-over-docs` conventions exist to prevent. This script re-derives the
 * standalone artifact from the source package on every run.
 *
 * Usage:
 *   pnpm build:apify
 *   node scripts/deploy/build-apify-actor-standalone.mjs
 *
 * Output: packages/apify-actor-governed-run/.apify-build/
 *   dist/            compiled actor (tsup output, unchanged)
 *   package.json     standalone; @revealui/security + @revealui/ai pinned to
 *                    the reviewed versions, apify + zod pinned to latest npm
 *   Dockerfile        single-directory-context Docker build
 *   .dockerignore
 *   README.md         copied from the source package
 *   .actor/           copied from the source package (actor.json, input_schema.json)
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const pkgDir = path.join(repoRoot, 'packages', 'apify-actor-governed-run');
const outDir = path.join(pkgDir, '.apify-build');

// REVIEWED pins for the two first-party, guardrail-2-sensitive dependencies:
// @revealui/security (Ed25519 receipt signing) and @revealui/ai (agent-loop
// LLM client). These are the ONLY source of truth for what the standalone
// actor ships -- they must match the versions guardrail-2 actually reviewed
// (revealui#2202, #2206, this PR). Do NOT resolve these from `npm view`:
// that floats to whatever is latest on the public registry at build time, so
// the moment either package publishes a new version, an unreviewed build of
// the signing surface would silently reach `apify push` with no CI gate and
// no guardrail-2 verdict in between -- exactly the review this gate exists to
// require. Bumping a pin here is a deliberate, reviewed code change to this
// file, not a side effect of the registry moving. See the drift check below,
// which only WARNS when the registry has moved past the pin; it never
// changes what gets shipped.
const REVIEWED_VERSIONS = {
  '@revealui/security': '0.6.0',
  '@revealui/ai': '0.9.0',
};

// Fallback pins for the two THIRD-PARTY deps (not on the guardrail-2
// sensitive-path list), used only if the live `npm view` lookup below fails
// (e.g. no network). Last verified against the public npm registry 2026-07-26.
const FALLBACK_VERSIONS = {
  apify: '3.7.2',
  zod: '4.4.3',
};

function resolveVersion(pkgName) {
  try {
    const version = execFileSync('npm', ['view', pkgName, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (!version) throw new Error('empty version returned');
    return version;
  } catch (err) {
    const fallback = FALLBACK_VERSIONS[pkgName];
    if (!fallback) throw new Error(`npm view ${pkgName} version failed and no fallback pin exists: ${err.message}`);
    console.warn(
      `[build-apify-actor] npm view ${pkgName} version failed (${err.message}); using fallback pin ${fallback}`,
    );
    return fallback;
  }
}

// Warn-only drift check for a REVIEWED_VERSIONS pin: tells the operator when
// the registry has moved past what this build ships, without ever letting
// that movement change the shipped version. Never throws -- a failed lookup
// (no network, registry hiccup) is not a reason to block the build.
function warnIfPinIsStale(pkgName, pinnedVersion) {
  let latest;
  try {
    latest = execFileSync('npm', ['view', pkgName, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    console.warn(`[build-apify-actor] drift check for ${pkgName} skipped (npm view failed: ${err.message})`);
    return;
  }
  if (latest && latest !== pinnedVersion) {
    console.warn(
      `[build-apify-actor] npm has ${pkgName}@${latest} but this build pins the guardrail-2-reviewed ` +
        `${pinnedVersion}; bump the pin in a reviewed PR to adopt ${latest}.`,
    );
  }
}

console.log('[build-apify-actor] 1/6 compiling actor source (tsup)...');
execFileSync('pnpm', ['--filter', '@revealui/apify-actor-governed-run', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

console.log('[build-apify-actor] 2/6 resetting output dir...');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(path.join(outDir, '.actor'), { recursive: true });

console.log('[build-apify-actor] 3/6 copying compiled output + static files...');
cpSync(path.join(pkgDir, 'dist'), path.join(outDir, 'dist'), { recursive: true });
// Apify extracts the Store listing from the pushed root README.md, so the
// PUBLIC, §4.2-clean listing (packages/.../.actor/README.md) must land at the
// artifact root — NOT the package root README.md, which is internal developer
// notes (internal repo refs, guardrail-2 status, "unpublished"). Shipping the
// dev README as the listing leaked internal detail to the public Store page.
// Copy the clean listing to both the artifact root and .actor/ so whichever
// path Apify resolves, it is the clean one.
cpSync(path.join(pkgDir, '.actor', 'README.md'), path.join(outDir, 'README.md'));
cpSync(path.join(pkgDir, '.actor', 'README.md'), path.join(outDir, '.actor', 'README.md'));
cpSync(
  path.join(pkgDir, '.actor', 'input_schema.json'),
  path.join(outDir, '.actor', 'input_schema.json'),
);
cpSync(
  path.join(pkgDir, '.actor', 'output_schema.json'),
  path.join(outDir, '.actor', 'output_schema.json'),
);

// actor.json's "dockerfile": "../Dockerfile" / "readme": "../README.md" are
// relative to .actor/, and the output layout preserves that (outDir/.actor/
// next to outDir/Dockerfile + outDir/README.md), so the file copies as-is.
const sourceActorJson = JSON.parse(readFileSync(path.join(pkgDir, '.actor', 'actor.json'), 'utf8'));
writeFileSync(path.join(outDir, '.actor', 'actor.json'), `${JSON.stringify(sourceActorJson, null, 2)}\n`);

console.log('[build-apify-actor] 4/6 checking first-party pins for drift + writing standalone package.json...');
warnIfPinIsStale('@revealui/security', REVIEWED_VERSIONS['@revealui/security']);
warnIfPinIsStale('@revealui/ai', REVIEWED_VERSIONS['@revealui/ai']);
const securityVersion = REVIEWED_VERSIONS['@revealui/security'];
const aiVersion = REVIEWED_VERSIONS['@revealui/ai'];
const apifyVersion = resolveVersion('apify');
const zodVersion = resolveVersion('zod');

const standalonePackageJson = {
  name: '@revealui/apify-actor-governed-run',
  version: sourceActorJson.version === '0.1' ? '0.1.0' : sourceActorJson.version,
  private: true,
  description:
    'Apify pay-per-event actor: runs an AI agent task and returns a cryptographically signed, ' +
    'offline-verifiable receipt of every action (GAP-431). Standalone publish build -- generated by ' +
    'scripts/deploy/build-apify-actor-standalone.mjs in RevealUIStudio/revealui; do not hand-edit.',
  type: 'module',
  engines: { node: '>=24.13.0' },
  scripts: { start: 'node dist/main.js' },
  // @revealui/security and @revealui/ai are pinned EXACT to REVIEWED_VERSIONS
  // above (first-party, guardrail-2-reviewed integration -- see that constant
  // for why they never resolve from `npm view`). apify + zod are third-party
  // and use a normal caret range against whatever npm reports as latest.
  dependencies: {
    '@revealui/security': securityVersion,
    apify: `^${apifyVersion}`,
    zod: `^${zodVersion}`,
  },
  // Matches the source package: run-task mode needs @revealui/ai (lazily
  // imported, src/agent/load-llm-client.ts); verify-receipt mode does not.
  optionalDependencies: {
    '@revealui/ai': aiVersion,
  },
};
writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(standalonePackageJson, null, 2)}\n`);

// Generate a lockfile against the standalone package.json so the Docker
// build can use `npm ci` (exact, reproducible install) instead of
// `npm install` (re-resolves apify/zod within their caret ranges on every
// image build). The lockfile is emitted into the gitignored .apify-build/
// output, not committed -- it is regenerated from the pins above every run,
// same as the rest of this directory.
console.log('[build-apify-actor] 5/6 generating lockfile for reproducible installs...');
execFileSync('npm', ['install', '--package-lock-only', '--omit=dev'], {
  cwd: outDir,
  stdio: 'inherit',
});

console.log('[build-apify-actor] 6/6 writing standalone Dockerfile + .dockerignore...');
const dockerfile = `# syntax=docker/dockerfile:1
#
# STANDALONE build -- this directory is the entire Docker build context.
# Generated by scripts/deploy/build-apify-actor-standalone.mjs
# (RevealUIStudio/revealui); do not hand-edit this file, edit the template in
# that script instead. Runtime deps (@revealui/security, @revealui/ai)
# install from the PUBLIC npm registry, pinned to exact published versions --
# never workspace:*, no monorepo context required. package-lock.json is
# generated alongside package.json every build, so npm ci here is an exact,
# reproducible install (including apify/zod's transitive tree), not a re-
# resolve against their caret ranges.

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY dist ./dist

RUN addgroup --system --gid 1001 apify && \\
    adduser --system --uid 1001 actor && \\
    chown -R actor:apify /app
USER actor

CMD ["node", "dist/main.js"]
`;
writeFileSync(path.join(outDir, 'Dockerfile'), dockerfile);

const dockerignore = `node_modules
npm-debug.log*
*.log
.git
.env
.env.*
`;
writeFileSync(path.join(outDir, '.dockerignore'), dockerignore);

console.log(`[build-apify-actor] done -- standalone output at ${path.relative(repoRoot, outDir)}`);
console.log(`[build-apify-actor] publish with: apify push --dir ${path.relative(repoRoot, outDir)}`);
