/**
 * Compare the pull request's required result jobs and classifier to the
 * base commit. Reads file text only. Does not import or execute the head tree.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Whole files that must match the base commit byte for byte. */
export const LOCKED_FILES = [
  'scripts/ci/expensive-suite.mjs',
  'scripts/ci/required-check-result.mjs',
];

/**
 * Workflow jobs whose text must match the base commit.
 * @type {{ file: string, jobs: string[] }[]}
 */
export const LOCKED_JOBS = [
  {
    file: '.github/workflows/ci.yml',
    jobs: [
      'changes',
      'test-unit-result',
      'build-result',
      'db-migrations-result',
      'test-integration-result',
      'e2e-smoke-result',
      'e2e-accessibility-result',
      'e2e-visual-result',
      'coverage-result',
    ],
  },
  { file: '.github/workflows/docker.yml', jobs: ['changes', 'docker-images'] },
  { file: '.github/workflows/ds.yml', jobs: ['changes'] },
  { file: '.github/workflows/security.yml', jobs: ['security-gate'] },
  { file: '.github/workflows/check-client-leaks.yml', jobs: ['scan'] },
  { file: '.github/workflows/backflow-merge-method-guard.yml', jobs: ['backflow-merge-method'] },
  { file: '.github/workflows/archive-check.yml', jobs: ['archive-check'] },
];

export const REGION_BEGIN = '# trusted-judge:begin';
export const REGION_END = '# trusted-judge:end';

/**
 * @type {{ file: string, begin: string, end: string }[]}
 */
export const LOCKED_REGIONS = [
  { file: '.github/workflows/ci.yml', begin: REGION_BEGIN, end: REGION_END },
];

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeNewlines(text) {
  return text.replaceAll('\r\n', '\n');
}

/**
 * @param {string} text
 * @param {string} jobId
 * @returns {string | null}
 */
export function extractJob(text, jobId) {
  const source = normalizeNewlines(text);
  const marker = `\n  ${jobId}:\n`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  if (source.indexOf(marker, start + marker.length) >= 0) return null;
  const lines = source.slice(start + 1).split('\n');
  /** @type {string[]} */
  const kept = [lines[0] ?? ''];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.startsWith('  #')) break;
    if (isJobKey(line)) break;
    if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('#')) break;
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop();
  return kept.join('\n');
}

/**
 * A workflow job key is indented exactly two spaces and contains no spaces.
 * @param {string} line
 * @returns {boolean}
 */
function isJobKey(line) {
  if (!line.startsWith('  ') || line.startsWith('   ')) return false;
  const body = line.slice(2);
  if (!body.endsWith(':')) return false;
  const token = body.slice(0, -1);
  if (token.length === 0) return false;
  return !token.includes(' ') && !token.includes('\t') && !token.startsWith('#');
}

/**
 * @param {string} text
 * @param {string} begin
 * @param {string} end
 * @returns {string | null}
 */
export function extractRegion(text, begin, end) {
  const source = normalizeNewlines(text);
  const start = source.indexOf(begin);
  const stop = source.indexOf(end);
  if (start < 0 || stop < 0 || stop < start) return null;
  if (source.indexOf(begin, start + begin.length) >= 0) return null;
  if (source.indexOf(end, stop + end.length) >= 0) return null;
  return source.slice(start, stop + end.length);
}

/**
 * @param {string} baseText
 * @param {string} headText
 * @returns {number}
 */
function firstDiffLine(baseText, headText) {
  const baseLines = baseText.split('\n');
  const headLines = headText.split('\n');
  const count = Math.max(baseLines.length, headLines.length);
  for (let i = 0; i < count; i += 1) {
    if (baseLines[i] !== headLines[i]) return i + 1;
  }
  return 0;
}

/**
 * @param {string} root
 * @param {string} rel
 * @returns {string | null}
 */
function readRel(root, rel) {
  const full = path.join(root, rel);
  if (!existsSync(full)) return null;
  return normalizeNewlines(readFileSync(full, 'utf8'));
}

/**
 * @typedef {Object} JudgeReport
 * @property {boolean} ok
 * @property {string[]} errors
 */

/**
 * @param {string} baseRoot
 * @param {string} headRoot
 * @returns {JudgeReport}
 */
export function compareLockedSurfaces(baseRoot, headRoot) {
  /** @type {string[]} */
  const errors = [];

  for (const rel of LOCKED_FILES) {
    const baseText = readRel(baseRoot, rel);
    const headText = readRel(headRoot, rel);
    if (baseText === null) errors.push(`base is missing ${rel}`);
    if (headText === null) errors.push(`head is missing ${rel}`);
    if (baseText === null || headText === null) continue;
    if (baseText !== headText) {
      errors.push(`${rel} differs from the base commit at line ${firstDiffLine(baseText, headText)}`);
    }
  }

  for (const entry of LOCKED_JOBS) {
    const baseText = readRel(baseRoot, entry.file);
    const headText = readRel(headRoot, entry.file);
    if (baseText === null) errors.push(`base is missing ${entry.file}`);
    if (headText === null) errors.push(`head is missing ${entry.file}`);
    if (baseText === null || headText === null) continue;
    for (const jobId of entry.jobs) {
      const baseJob = extractJob(baseText, jobId);
      const headJob = extractJob(headText, jobId);
      const label = `${entry.file} job ${jobId}`;
      if (baseJob === null) errors.push(`base is missing ${label}`);
      if (headJob === null) errors.push(`head is missing ${label}`);
      if (baseJob === null || headJob === null) continue;
      if (baseJob !== headJob) {
        errors.push(`${label} differs from the base commit at line ${firstDiffLine(baseJob, headJob)}`);
      }
    }
  }

  for (const region of LOCKED_REGIONS) {
    const baseText = readRel(baseRoot, region.file);
    const headText = readRel(headRoot, region.file);
    const label = `${region.file} ${region.begin}`;
    if (baseText === null || headText === null) {
      errors.push(`missing file for ${label}`);
      continue;
    }
    const baseRegion = extractRegion(baseText, region.begin, region.end);
    const headRegion = extractRegion(headText, region.begin, region.end);
    if (baseRegion === null) errors.push(`base is missing ${label}`);
    if (headRegion === null) errors.push(`head is missing ${label}`);
    if (baseRegion === null || headRegion === null) continue;
    if (baseRegion !== headRegion) {
      errors.push(`${label} differs from the base commit at line ${firstDiffLine(baseRegion, headRegion)}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {string} repo
 * @param {string} sha
 * @param {string} rel
 * @param {string} token
 * @returns {Promise<string>}
 */
async function fetchHeadFile(repo, sha, rel, token) {
  const url = `https://api.github.com/repos/${repo}/contents/${rel}?ref=${encodeURIComponent(sha)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.raw',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'revealui-trusted-gate-judge',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`head file ${rel} returned ${response.status}`);
  }
  return response.text();
}

/**
 * @param {string} repo
 * @param {string} sha
 * @param {string} token
 * @returns {Promise<string>}
 */
export async function materializeHead(repo, sha, token) {
  const dir = mkdtempSync(path.join(tmpdir(), 'trusted-gate-head-'));
  /** @type {string[]} */
  const files = [...LOCKED_FILES];
  for (const entry of LOCKED_JOBS) {
    if (!files.includes(entry.file)) files.push(entry.file);
  }
  for (const region of LOCKED_REGIONS) {
    if (!files.includes(region.file)) files.push(region.file);
  }
  for (const rel of files) {
    const text = await fetchHeadFile(repo, sha, rel, token);
    const dest = path.join(dir, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, text);
  }
  return dir;
}

async function main() {
  const baseFlag = process.argv.indexOf('--base');
  const headFlag = process.argv.indexOf('--head');
  const baseRoot = baseFlag >= 0 ? process.argv[baseFlag + 1] : '';
  const headArg = headFlag >= 0 ? process.argv[headFlag + 1] : '';
  if (!baseRoot) {
    process.stderr.write('missing --base <checkout>\n');
    process.exit(2);
  }

  let headRoot = headArg;
  if (!headRoot) {
    const sha = process.env.HEAD_SHA ?? '';
    const repo = process.env.REPO ?? '';
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';
    if (!sha || !repo || !token) {
      process.stderr.write('missing --head or HEAD_SHA, REPO, and GH_TOKEN\n');
      process.exit(2);
    }
    headRoot = await materializeHead(repo, sha, token);
  }

  const report = compareLockedSurfaces(path.resolve(baseRoot), path.resolve(headRoot));
  if (!report.ok) {
    for (const error of report.errors) process.stderr.write(`${error}\n`);
    process.exit(1);
  }
  process.stdout.write('trusted gate judge: head matches base\n');
}

const thisFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedFile === thisFile) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
