#!/usr/bin/env node
/**
 * GAP-170 fix — skip manually-bumped packages from the canary publish step.
 *
 * Run between `pnpm changeset version --snapshot canary` and
 * `pnpm changeset publish --tag canary` in `.github/workflows/release-canary.yml`.
 *
 * Why this exists:
 *   `pnpm changeset version --snapshot canary` only rewrites the versions of
 *   packages with a pending `.changeset/*.md` entry, giving them a
 *   `0.0.0-canary-<ts>` suffix. Packages whose `package.json` was bumped
 *   manually (e.g. a hotfix patch from 0.4.0 -> 0.4.1 with no changeset)
 *   keep their actual semver version. The subsequent
 *   `pnpm changeset publish --tag canary` publishes ALL non-private
 *   packages whose version is not yet on the registry — including those
 *   manual bumps — under the `canary` dist-tag. That mis-tag silently
 *   breaks `latest` resolution for consumers (`npm install <pkg>` returns
 *   the prior `latest`, not the bump).
 *
 * What we do:
 *   Walk every workspace package. If its version is missing the
 *   `-canary-` suffix that snapshot-mode would have inserted, mark the
 *   package as `private: true` (in-place edit of `package.json`) so
 *   `changeset publish` skips it. The manual bump still publishes via
 *   `release.yml` on the eventual main push, landing under `latest` as
 *   intended.
 *
 *   The mutation is CI-only — these workspaces are clones, never
 *   committed back to git.
 *
 * Output: one log line per package skipped, plus a summary count.
 *   Exit code is always 0 (no fatal conditions); read stderr for unexpected
 *   parse failures.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** @typedef {{ name: string; path?: string; private?: boolean }} PnpmListEntry */

const CANARY_SUFFIX_PATTERN = /-canary-/;

function listWorkspaces() {
  const raw = execSync('pnpm -r ls --json --depth -1', { encoding: 'utf8' });
  /** @type {PnpmListEntry[]} */
  const entries = JSON.parse(raw);
  return entries.filter((e) => e.path);
}

function main() {
  const workspaces = listWorkspaces();
  const skipped = [];
  const kept = [];

  for (const ws of workspaces) {
    const pkgJsonPath = join(ws.path, 'package.json');
    let pkgJson;
    try {
      pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    } catch (err) {
      console.error(`[GAP-170] failed to parse ${pkgJsonPath}:`, err.message);
      continue;
    }

    if (pkgJson.private) continue;
    if (!pkgJson.version) continue;

    if (CANARY_SUFFIX_PATTERN.test(pkgJson.version)) {
      kept.push(`${pkgJson.name}@${pkgJson.version}`);
      continue;
    }

    pkgJson.private = true;
    writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
    skipped.push(`${pkgJson.name}@${pkgJson.version}`);
    console.log(`[GAP-170] skipping ${pkgJson.name}@${pkgJson.version} (no -canary- suffix; manual bump)`);
  }

  console.log('');
  console.log(`[GAP-170] ${skipped.length} package(s) marked private to skip canary publish`);
  console.log(`[GAP-170] ${kept.length} package(s) keeping canary publish:`);
  for (const k of kept) console.log(`[GAP-170]   ${k}`);
}

main();
