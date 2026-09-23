#!/usr/bin/env tsx
/**
 * VS Code agent-plugin marketplace package (GAP-475).
 *
 * Checks the committed listing bundle and can write a local tarball.
 * Publisher credentials and marketplace publish stay with the owner.
 * This script refuses `--publish` and `publish`.
 *
 * Usage:
 *   pnpm validate:vscode-marketplace
 *   pnpm package:vscode-plugin
 *
 * Exit codes:
 *   0 = package matches the hook contract and contains no token or live URL
 *   1 = package drift
 *   2 = refused publish / login
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildVSCodePluginManifest } from '../../packages/harnesses/src/content/generators/vscode.js';
import { vscodeMarketplaceMcpTemplate } from '../../packages/harnesses/src/protocol/config-normalizer.js';

const ROOT = path.resolve(import.meta.dirname, '../..');

export const PLUGIN_DIR_REL = 'deployment/vscode/plugin';
export const MARKETPLACE_REL = 'deployment/vscode/marketplace.json';
/** Live discovery path. Empty until the owner copies the catalog here. */
export const DISCOVERY_CATALOG_REL = '.github/plugin/marketplace.json';
export const OWNER_PUBLISH_REL = 'docs/distribution/VSCODE-MARKETPLACE-OWNER-PUBLISH.md';
export const RUNBOOK_REL = 'docs/runbooks/GAP-381-D-C-VSCODE-MARKETPLACE.md';

export const PLUGIN_FILES = ['plugin.json', '.mcp.json', 'README.md', 'LICENSE'] as const;

export const README_PHRASES = [
  'chat.pluginLocations',
  'revealui-harnesses hook vscode',
  'device token',
  'not a live Visual Studio Marketplace listing',
  'Publisher credentials stay with the owner',
] as const;

export const OWNER_DOC_PHRASES = [
  'GAP-475',
  'must not create publisher credentials',
  'must not publish',
  'Local VS Code',
  'Copilot',
  '.github/plugin/marketplace.json',
  'deployment/vscode/plugin',
] as const;

export const RUNBOOK_PHRASES = ['GAP-475', 'deployment/vscode/plugin', '0.1.0'] as const;

const SECRET_MARKERS = ['rvui_dev_', 'ghp_', 'github_pat_', 'xoxb-', 'AKIA'] as const;

const PUBLISH_ARGS = new Set(['--publish', 'publish', '--login', 'login']);

export function publishRefusal(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (PUBLISH_ARGS.has(arg)) {
      return 'Refusing to publish or log in. Publisher credentials and marketplace publish are owner steps (GAP-475).';
    }
  }
  return null;
}

export function findLeakedSecrets(value: unknown, pointer = ''): string[] {
  const hits: string[] = [];
  walkSecrets(value, pointer, hits);
  return hits;
}

function walkSecrets(value: unknown, pointer: string, hits: string[]): void {
  if (typeof value === 'string') {
    for (const marker of SECRET_MARKERS) {
      if (value.includes(marker)) {
        hits.push(`${pointer} contains ${marker}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      walkSecrets(value[index], `${pointer}/${index}`, hits);
    }
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      walkSecrets(child, `${pointer}/${key}`, hits);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(repoRoot: string, relPath: string): { value: unknown; error: string | null } {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) {
    return { value: null, error: `missing ${relPath}` };
  }
  try {
    return { value: JSON.parse(fs.readFileSync(abs, 'utf8')) as unknown, error: null };
  } catch {
    return { value: null, error: `${relPath} is not valid JSON` };
  }
}

function missingPhrases(text: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => !text.includes(phrase));
}

export function collectIssues(repoRoot: string = ROOT): string[] {
  const issues: string[] = [];
  const pluginDir = path.join(repoRoot, PLUGIN_DIR_REL);

  if (!fs.existsSync(pluginDir)) {
    issues.push(`missing ${PLUGIN_DIR_REL}`);
    return issues;
  }

  const allowed = new Set<string>(PLUGIN_FILES);
  const present = new Set(fs.readdirSync(pluginDir));
  for (const name of PLUGIN_FILES) {
    if (!present.has(name)) {
      issues.push(`${PLUGIN_DIR_REL} missing ${name}`);
    }
  }
  for (const name of present) {
    if (!allowed.has(name)) {
      issues.push(`${PLUGIN_DIR_REL} has unexpected file ${name}`);
    }
  }

  const generated = buildVSCodePluginManifest();
  const pluginParsed = readJson(repoRoot, `${PLUGIN_DIR_REL}/plugin.json`);
  if (pluginParsed.error) {
    issues.push(pluginParsed.error);
  } else if (!isRecord(pluginParsed.value)) {
    issues.push('plugin.json must be an object');
  } else {
    const plugin = pluginParsed.value;
    issues.push(...findLeakedSecrets(plugin, 'plugin.json'));
    if (plugin.name !== generated.name) issues.push('plugin.json name must match the generator');
    if (plugin.description !== generated.description) {
      issues.push('plugin.json description must match the generator');
    }
    if (plugin.version !== generated.version) {
      issues.push('plugin.json version must match the generator');
    }
    if (plugin.mcpServers !== generated.mcpServers) {
      issues.push('plugin.json mcpServers must be the .mcp.json path reference');
    }
    if (JSON.stringify(plugin.hooks) !== JSON.stringify(generated.hooks)) {
      issues.push('plugin.json hooks must match the generator command contract');
    }
    if (!isRecord(plugin.author) || plugin.author.name !== 'RevealUI Studio') {
      issues.push('plugin.json author.name must be RevealUI Studio');
    }
    if (!isRecord(plugin.author) || plugin.author.url !== 'https://revealui.com') {
      issues.push('plugin.json author.url must be https://revealui.com');
    }
    if (plugin.homepage !== 'https://revealui.com') {
      issues.push('plugin.json homepage must be https://revealui.com');
    }
    if (plugin.repository !== 'https://github.com/RevealUIStudio/revealui') {
      issues.push('plugin.json repository must be the RevealUI monorepo');
    }
    if (plugin.license !== 'FSL-1.1-MIT') {
      issues.push('plugin.json license must be FSL-1.1-MIT');
    }
    if (!(Array.isArray(plugin.keywords) && plugin.keywords.includes('revealui'))) {
      issues.push('plugin.json keywords must include revealui');
    }
  }

  const mcpParsed = readJson(repoRoot, `${PLUGIN_DIR_REL}/.mcp.json`);
  const template = vscodeMarketplaceMcpTemplate();
  if (mcpParsed.error) {
    issues.push(mcpParsed.error);
  } else {
    issues.push(...findLeakedSecrets(mcpParsed.value, '.mcp.json'));
    if (JSON.stringify(mcpParsed.value) !== JSON.stringify(template)) {
      issues.push('.mcp.json must match vscodeMarketplaceMcpTemplate()');
    }
    const url = template.servers.revealui?.url ?? '';
    if (url.includes('://')) {
      issues.push('.mcp.json server url must be an input reference');
    }
    const authorization = template.servers.revealui?.headers.Authorization ?? '';
    if (authorization !== `Bearer \${input:revealui-mcp-token}`) {
      issues.push('.mcp.json Authorization must be the token input reference');
    }
    const tokenInput = template.inputs.find((input) => input.id === 'revealui-mcp-token');
    if (tokenInput?.password !== true) {
      issues.push('.mcp.json token input must set password true');
    }
  }

  if (fs.existsSync(path.join(repoRoot, DISCOVERY_CATALOG_REL))) {
    issues.push(
      `${DISCOVERY_CATALOG_REL} is the live catalog path. Copy ${MARKETPLACE_REL} there only when the owner publishes.`,
    );
  }

  const marketParsed = readJson(repoRoot, MARKETPLACE_REL);
  if (marketParsed.error) {
    issues.push(marketParsed.error);
  } else if (!isRecord(marketParsed.value)) {
    issues.push('marketplace.json must be an object');
  } else {
    const market = marketParsed.value;
    issues.push(...findLeakedSecrets(market, 'marketplace.json'));
    if (market.name !== 'revealui') issues.push('marketplace.json name must be revealui');
    if (!isRecord(market.owner) || market.owner.name !== 'RevealUI Studio') {
      issues.push('marketplace.json owner.name must be RevealUI Studio');
    }
    if (!isRecord(market.owner) || market.owner.email !== 'support@revealui.com') {
      issues.push('marketplace.json owner.email must be support@revealui.com');
    }
    if (!isRecord(market.metadata) || market.metadata.version !== generated.version) {
      issues.push('marketplace.json metadata.version must match plugin.json');
    }
    if (!Array.isArray(market.plugins) || market.plugins.length !== 1) {
      issues.push('marketplace.json must list exactly one plugin');
    } else if (!isRecord(market.plugins[0])) {
      issues.push('marketplace.json plugin entry must be an object');
    } else {
      const entry = market.plugins[0];
      if (entry.name !== generated.name) issues.push('catalog plugin name must be revealui');
      if (entry.version !== generated.version) {
        issues.push('catalog plugin version must match plugin.json');
      }
      if (entry.source !== `./${PLUGIN_DIR_REL}`) {
        issues.push(`catalog source must be ./${PLUGIN_DIR_REL}`);
      }
      if (typeof entry.source === 'string') {
        const sourceDir = path.resolve(repoRoot, entry.source);
        if (!fs.existsSync(path.join(sourceDir, 'plugin.json'))) {
          issues.push('catalog source must resolve to a plugin.json');
        }
      }
    }
  }

  for (const [relPath, phrases] of [
    [`${PLUGIN_DIR_REL}/README.md`, README_PHRASES],
    [OWNER_PUBLISH_REL, OWNER_DOC_PHRASES],
    [RUNBOOK_REL, RUNBOOK_PHRASES],
  ] as const) {
    const abs = path.join(repoRoot, relPath);
    if (!fs.existsSync(abs)) {
      issues.push(`missing ${relPath}`);
      continue;
    }
    const missing = missingPhrases(fs.readFileSync(abs, 'utf8'), phrases);
    if (missing.length > 0) {
      issues.push(`${relPath} missing phrase(s): ${missing.join(', ')}`);
    }
  }

  const workflowsDir = path.join(repoRoot, '.github/workflows');
  if (fs.existsSync(workflowsDir)) {
    for (const name of fs.readdirSync(workflowsDir)) {
      const text = fs.readFileSync(path.join(workflowsDir, name), 'utf8');
      if (text.includes('vsce')) {
        issues.push(`.github/workflows/${name} must not invoke vsce`);
      }
    }
  }

  return issues;
}

export function packVsCodePlugin(repoRoot: string = ROOT, outDir?: string): string {
  const issues = collectIssues(repoRoot);
  if (issues.length > 0) {
    throw new Error(issues.join('\n'));
  }
  const version = buildVSCodePluginManifest().version;
  const destinationDir = outDir ?? path.join(repoRoot, 'deployment/vscode/dist');
  fs.mkdirSync(destinationDir, { recursive: true });
  const outPath = path.join(destinationDir, `revealui-vscode-plugin-${version}.tar.gz`);
  execFileSync(
    'tar',
    ['-czf', outPath, '-C', path.join(repoRoot, PLUGIN_DIR_REL), ...PLUGIN_FILES],
    { stdio: 'pipe' },
  );
  return outPath;
}

export function main(
  argv: readonly string[] = process.argv.slice(2),
  repoRoot: string = ROOT,
): number {
  const refusal = publishRefusal(argv);
  if (refusal) {
    console.error(refusal);
    return 2;
  }

  const issues = collectIssues(repoRoot);
  if (issues.length > 0) {
    console.error('VS Code marketplace package (GAP-475):');
    for (const issue of issues) {
      console.error(`    ${issue}`);
    }
    return 1;
  }

  if (argv.includes('--pack')) {
    const packed = packVsCodePlugin(repoRoot);
    console.log(`VS Code marketplace package tarball: ${packed}`);
    return 0;
  }

  console.log(
    'VS Code marketplace package: listing bundle matches the hook contract; publish stays with the owner',
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
