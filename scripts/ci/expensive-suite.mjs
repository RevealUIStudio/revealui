/**
 * Wave 2 CI path classifier — docs / markdown / marketing-copy vs full suite.
 *
 * Used by `.github/workflows/ci.yml` and `.github/workflows/ds.yml`. Zero deps
 * so the `changes` job can run it after a shallow checkout with no pnpm install.
 *
 * Cheap (skip unit / integration / build / in-CI E2E / drizzle apply /
 * server-tsx-boot) only when EVERY changed path is copy/docs. Any other path
 * — including apps/admin, apps/server, packages/**, lockfile, workflows,
 * Dockerfiles, e2e — keeps the full suite.
 */
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} file
 * @returns {boolean}
 */
export function isCheapCopyPath(file) {
  if (file.length === 0) return false;
  if (file.endsWith('.md') || file.endsWith('.mdx')) return true;
  if (file === 'docs' || file.startsWith('docs/')) return true;
  if (file.startsWith('apps/docs/public/docs-pro/')) return true;
  if (file.startsWith('apps/marketing/app/content/__tests__/')) return false;
  if (file.startsWith('apps/marketing/app/content/')) return true;
  return false;
}

/**
 * @param {string[]} files
 * @returns {boolean}
 */
export function shouldRunFullSuite(files) {
  if (files.length === 0) return true;
  return files.some((file) => !isCheapCopyPath(file));
}

/**
 * @param {string} file
 * @returns {boolean}
 */
export function isDsWorkflowPath(file) {
  return file === '.github/workflows/ds.yml';
}

/**
 * Showcase visual + showcase a11y (docs host, tokens, presentation).
 * @param {string} file
 * @returns {boolean}
 */
export function isShowcaseVisualPath(file) {
  if (isDsWorkflowPath(file)) return true;
  if (file.startsWith('packages/tokens/')) return true;
  if (file.startsWith('packages/presentation/')) return true;
  if (file === 'apps/docs' || file.startsWith('apps/docs/')) return true;
  if (file.startsWith('design-system/')) return true;
  if (file === 'e2e/showcase-visual.e2e.ts') return true;
  if (file === 'e2e/showcase-a11y.e2e.ts') return true;
  if (file === 'e2e/showcase-matrix.e2e.ts') return true;
  return false;
}

/**
 * Marketing axe / Lighthouse job in ds.yml.
 * @param {string} file
 * @returns {boolean}
 */
export function isMarketingA11yPath(file) {
  if (isDsWorkflowPath(file)) return true;
  if (file === 'apps/marketing' || file.startsWith('apps/marketing/')) return true;
  if (file === 'e2e/marketing-a11y.e2e.ts') return true;
  return false;
}

/**
 * @param {string[]} files
 * @returns {{ showcase: boolean, marketing: boolean, tokens: boolean, presentation: boolean, adherence: boolean }}
 */
export function classifyDsPaths(files) {
  const workflow = files.some((file) => isDsWorkflowPath(file));
  const showcase = workflow || files.some((file) => isShowcaseVisualPath(file));
  const marketing = workflow || files.some((file) => isMarketingA11yPath(file));
  const tokens =
    workflow || files.some((file) => file === 'packages/tokens' || file.startsWith('packages/tokens/'));
  const presentation =
    workflow ||
    files.some((file) => file === 'packages/presentation' || file.startsWith('packages/presentation/'));
  return {
    showcase,
    marketing,
    tokens,
    presentation,
    adherence: showcase || marketing,
  };
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function parseChangedFiles(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * @param {string[]} files
 * @returns {string}
 */
export function formatCiOutputs(files) {
  return `full_suite=${shouldRunFullSuite(files)}\n`;
}

/**
 * @param {string[]} files
 * @returns {string}
 */
export function formatDsOutputs(files) {
  const classified = classifyDsPaths(files);
  return [
    `showcase=${classified.showcase}`,
    `marketing=${classified.marketing}`,
    `tokens=${classified.tokens}`,
    `presentation=${classified.presentation}`,
    `adherence=${classified.adherence}`,
  ].join('\n');
}

async function readStdin() {
  const lines = [];
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    lines.push(line);
  }
  return lines.join('\n');
}

async function main() {
  const mode = process.argv.includes('--ds') ? 'ds' : 'ci';
  const raw = await readStdin();
  const files = parseChangedFiles(raw);
  const output = mode === 'ds' ? formatDsOutputs(files) : formatCiOutputs(files);
  process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
}

const thisFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedFile === thisFile) {
  await main();
}
