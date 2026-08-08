'use strict';

/**
 * Creates one GitHub release per package tag pointing at HEAD, with the release
 * body sourced from that package's own CHANGELOG.md section for the tagged
 * version (changesets convention).
 *
 * `generate_release_notes: true` is deliberately not used: GitHub generates
 * those notes from every commit since the previous tag of the same package, so
 * for monorepo package tags the body can exceed GitHub's 125,000-character
 * release-body limit and the API rejects the creation with a 422.
 *
 * Loaded by .github/workflows/release.yml via actions/github-script. CommonJS
 * (.cjs) because github-script exposes a CommonJS `require` resolved against
 * the workspace root. No-regex (methodology M2): string operations only.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// GitHub rejects release bodies over 125,000 characters ("body is too long",
// 422); truncate below the limit with room for the truncation notice.
const MAX_BODY_CHARS = 120000;

/**
 * Parse `<npm-name>@<version>` at the last `@` so scoped names keep their
 * scope: `@revealui/core@0.10.0` -> { name: '@revealui/core', version:
 * '0.10.0' }, `create-revealui@0.5.9` -> { name: 'create-revealui', ... }.
 */
function parseTag(tag) {
  const separator = tag.lastIndexOf('@');
  if (separator <= 0 || separator === tag.length - 1) return null;
  return { name: tag.slice(0, separator), version: tag.slice(separator + 1) };
}

/**
 * Map workspace package names to their directory by reading every
 * packages/<dir>/package.json — names are never hardcoded here.
 */
function buildPackageDirMap(packagesRoot) {
  const dirByName = new Map();
  for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packagesRoot, entry.name, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (typeof manifest.name === 'string' && manifest.name.length > 0) {
      dirByName.set(manifest.name, path.join(packagesRoot, entry.name));
    }
  }
  return dirByName;
}

/**
 * Extract the body of the `## <version>` section from a changesets CHANGELOG.
 *
 * Returns:
 *   - `null` if the `## <version>` heading is absent
 *   - `''` if the heading exists but the section has no body (dependency-only bump)
 *   - the section text otherwise
 *
 * The section ends at the first line that is not changesets section content.
 * Changesets only ever emits blank lines, `###` change-type headings, `-`/`*`
 * bullets, and indented continuation lines inside a section, so any other
 * column-0 line is a boundary: the next `##` version heading, the `#` package
 * title, a `---` delimiter, or docs-frontmatter key remnants. (Changesets
 * prepends new sections by replacing the file's first newline, which used to
 * land them inside the leading frontmatter blocks package changelogs carried
 * until the 2026-06-12 cleanup; `pnpm validate:changelogs` now keeps package
 * changelogs frontmatter-free, so this boundary tolerance is belt-and-
 * suspenders rather than load-bearing.)
 */
function extractChangelogSection(changelogText, version) {
  const lines = changelogText.split('\n');
  const heading = `## ${version}`;
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === heading) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const isSectionContent =
      line.startsWith('###') ||
      line.startsWith('- ') ||
      line.startsWith('* ') ||
      line.startsWith(' ') ||
      line.startsWith('\t');
    if (!isSectionContent) {
      end = i;
      break;
    }
  }
  while (start < end && lines[start].trim() === '') start += 1;
  while (end > start && lines[end - 1].trim() === '') end -= 1;
  // Empty section is valid: changesets often emits `## x.y.z` with no body for
  // dependency-only bumps (e.g. knowledge-graph 0.1.8). Missing heading only.
  if (start >= end) return '';
  return lines.slice(start, end).join('\n');
}

/**
 * A 422 whose error list contains `already_exists` means the release was
 * already created (manual creation or a re-run) — a skip, not a failure.
 */
function isAlreadyExistsError(error) {
  if (error === null || typeof error !== 'object' || error.status !== 422) return false;
  const apiErrors = error.response?.data?.errors;
  if (!Array.isArray(apiErrors)) return false;
  return apiErrors.some(
    (apiError) => apiError !== null && typeof apiError === 'object' && apiError.code === 'already_exists',
  );
}

async function run({ github, context, core }) {
  const tags = execFileSync('git', ['tag', '--points-at', 'HEAD'], { encoding: 'utf8' })
    .split('\n')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  if (tags.length === 0) {
    core.notice(
      'No tags point at HEAD: `changeset publish` creates tags only for packages it actually publishes. ' +
        'On a re-run of an already-published release this is expected — packages are already on npm and no GitHub releases are created here.',
    );
    return;
  }
  core.info(`Tags at HEAD (${tags.length}): ${tags.join(', ')}`);

  const dirByName = buildPackageDirMap(path.join(process.cwd(), 'packages'));
  const failures = [];

  for (const tag of tags) {
    const parsed = parseTag(tag);
    if (parsed === null) {
      failures.push({ tag, reason: 'tag is not <package-name>@<version>' });
      continue;
    }
    const packageDir = dirByName.get(parsed.name);
    if (packageDir === undefined) {
      failures.push({ tag, reason: `no workspace package named "${parsed.name}" under packages/` });
      continue;
    }
    const changelogPath = path.join(packageDir, 'CHANGELOG.md');
    const relativeChangelogPath = path.relative(process.cwd(), changelogPath);
    if (!fs.existsSync(changelogPath)) {
      failures.push({ tag, reason: `missing ${relativeChangelogPath}` });
      continue;
    }
    const section = extractChangelogSection(fs.readFileSync(changelogPath, 'utf8'), parsed.version);
    if (section === null) {
      failures.push({ tag, reason: `no "## ${parsed.version}" section in ${relativeChangelogPath}` });
      continue;
    }

    // Empty body after a present heading (dependency-only bump). GitHub requires
    // a non-empty release body in practice for a useful release page.
    let body =
      section.length > 0
        ? section
        : '_No package-level changes in this release (dependency bumps only). See the package CHANGELOG.md._';
    if (body.length > MAX_BODY_CHARS) {
      core.warning(`${tag}: changelog section is ${body.length} chars; truncating to ${MAX_BODY_CHARS}.`);
      body = `${body.slice(0, MAX_BODY_CHARS)}\n\n_Truncated — see ${relativeChangelogPath} for the full entry._`;
    }

    try {
      await github.rest.repos.createRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag_name: tag,
        name: tag,
        body,
        make_latest: 'false',
      });
      core.info(`Created release ${tag} (${body.length}-char body from ${relativeChangelogPath})`);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        core.info(`Release already exists, skipping: ${tag}`);
        continue;
      }
      failures.push({ tag, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      core.error(`Release failed for ${failure.tag}: ${failure.reason}`);
    }
    core.setFailed(`${failures.length} of ${tags.length} GitHub release(s) failed; see errors above.`);
    return;
  }
  core.info(`All ${tags.length} GitHub release(s) created or already present.`);
}

module.exports = { run, parseTag, buildPackageDirMap, extractChangelogSection, isAlreadyExistsError };
