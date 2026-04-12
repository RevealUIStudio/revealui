/**
 * Vercel Skills Loader
 *
 * Bridge layer to load skills from the Vercel Skills ecosystem (skills.sh)
 * and convert them to RevealUI's format.
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { logger } from '@revealui/core/observability/logger';
import { parseSkillMd } from '../parser/index.js';
import type { SkillRegistry } from '../registry/index.js';
import type { Skill } from '../types.js';
import type {
  UpdateInfo,
  VercelCliOptions,
  VercelCommandResult,
  VercelSource,
} from './vercel-types.js';
import { parseVercelSource } from './vercel-types.js';

const execFileAsync = promisify(execFile);

/** Validate shell-unsafe characters in git arguments (R4-C1 fix) */
const SAFE_GIT_ARG = /^[a-zA-Z0-9._\-/]+$/;

function validateGitArg(value: string, name: string): void {
  if (!SAFE_GIT_ARG.test(value)) {
    throw new Error(
      `Invalid ${name}: "${value}". Only alphanumeric, dots, hyphens, underscores, and slashes allowed.`,
    );
  }
}

/**
 * Options for loading from Vercel Skills ecosystem.
 */
export interface VercelLoadOptions {
  /** Target directory for installation */
  targetDir: string;

  /** Scope: local (project) or global */
  scope: 'local' | 'global';

  /** Registry to register skill with */
  registry: SkillRegistry;

  /** Generate embedding for semantic search */
  generateEmbedding?: boolean;

  /** Force reinstall if already exists */
  force?: boolean;

  /** Specific ref/version to install */
  ref?: string;
}

/**
 * Load a skill from the Vercel Skills ecosystem.
 *
 * This function:
 * 1. Executes `npx skills add <source>` to install the skill
 * 2. Detects the installation location
 * 3. Parses the installed SKILL.md
 * 4. Registers with RevealUI's SkillRegistry
 * 5. Optionally generates embeddings for semantic search
 *
 * @param source - Vercel skill source (e.g., "vercel-labs/agent-skills/react-best-practices")
 * @param options - Load options
 * @returns Fully loaded Skill object
 */
export async function loadFromVercelSkills(
  source: string,
  options: VercelLoadOptions,
): Promise<Skill> {
  const parsed = parseVercelSource(source);

  // Determine skill name from path or repo name
  const skillName = parsed.path ? path.basename(parsed.path) : parsed.repo;

  const targetPath = path.join(options.targetDir, skillName);

  // Check if already exists
  if (fs.existsSync(targetPath)) {
    if (options.force) {
      fs.rmSync(targetPath, { recursive: true });
    } else {
      throw new Error(`Skill "${skillName}" already exists. Use --force to overwrite.`);
    }
  }

  // Ensure target directory exists
  if (!fs.existsSync(options.targetDir)) {
    fs.mkdirSync(options.targetDir, { recursive: true });
  }

  // Try npx skills first, fallback to direct git clone
  let installPath: string | undefined;

  try {
    const result = await installViaVercelCli(source, {
      dir: options.targetDir,
      force: options.force,
      ref: options.ref ?? parsed.ref,
      global: options.scope === 'global',
    });

    if (result.success && result.installPath) {
      installPath = result.installPath;
    }
  } catch (error) {
    logger.warn('Vercel CLI installation failed, falling back to git clone', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback to direct git clone if npx skills failed
  if (!installPath) {
    installPath = await fallbackGitClone(parsed, targetPath);
  }

  // Find and validate SKILL.md
  const skillMdPath = path.join(installPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    // Clean up failed install
    fs.rmSync(installPath, { recursive: true });
    throw new Error(`No SKILL.md found in ${source}`);
  }

  // Parse and validate
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const parsedSkill = parseSkillMd(content);

  // Create skill object with Vercel source tracking
  const skill: Skill = {
    metadata: parsedSkill.metadata,
    instructions: parsedSkill.instructions,
    sourcePath: installPath,
    scope: options.scope,
    source: 'vercel',
    sourceIdentifier: source,
    installedAt: new Date().toISOString(),
  };

  // Register with registry
  if (options.registry.has(skill.metadata.name)) {
    options.registry.unregister(skill.metadata.name);
  }
  options.registry.register(skill);

  // Load fully (with resources and optionally embedding)
  return (
    (await options.registry.loadSkill(skill.metadata.name, options.generateEmbedding)) ?? skill
  );
}

/**
 * Install a skill using the Vercel Skills CLI (npx skills).
 *
 * @param source - Skill source identifier
 * @param options - CLI options
 * @returns Command execution result
 */
async function installViaVercelCli(
  source: string,
  options: VercelCliOptions,
): Promise<VercelCommandResult> {
  const args: string[] = ['skills', 'add', source];

  if (options.global) {
    args.push('--global');
  }

  if (options.dir) {
    args.push('--dir', options.dir);
  }

  if (options.force) {
    args.push('--force');
  }

  if (options.ref) {
    args.push('--ref', options.ref);
  }

  try {
    const { stdout, stderr } = await execFileAsync('npx', args, {
      cwd: options.dir,
      timeout: 60000, // 60 second timeout
    });

    // Parse output to detect installation path
    const installPath = extractInstallPath(stdout, options.dir ?? process.cwd(), source);

    return {
      success: true,
      stdout,
      stderr,
      installPath,
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? 'Unknown error',
    };
  }
}

/**
 * Extract the installation path from npx skills output.
 *
 * @param output - Command stdout
 * @param baseDir - Base directory where skill was installed
 * @param source - Original source string
 * @returns Detected installation path
 */
function extractInstallPath(output: string, baseDir: string, source: string): string | undefined {
  // Try to parse the output to find installation location
  // Common patterns:
  // - "Installed skill to: /path/to/skill"
  // - "✓ Installed skill-name"

  const installMatch = output.match(/(?:Installed|installed).*?(?:to:?\s+)?([^\n]+)/i);
  if (installMatch?.[1]) {
    const detectedPath = installMatch[1].trim();
    if (fs.existsSync(detectedPath)) {
      return detectedPath;
    }
  }

  // Fallback: try to construct path from source
  const parsed = parseVercelSource(source);
  const skillName = parsed.path ? path.basename(parsed.path) : parsed.repo;
  const constructedPath = path.join(baseDir, skillName);

  if (fs.existsSync(constructedPath)) {
    return constructedPath;
  }

  return undefined;
}

/**
 * Fallback: Clone directly from GitHub if npx skills fails.
 *
 * @param source - Parsed Vercel source
 * @param targetPath - Target installation path
 * @returns Installation path
 */
async function fallbackGitClone(source: VercelSource, targetPath: string): Promise<string> {
  validateGitArg(source.owner, 'owner');
  validateGitArg(source.repo, 'repo');
  const repoUrl = `https://github.com/${source.owner}/${source.repo}.git`;

  if (source.path) {
    // Use sparse checkout for subdirectory
    await sparseClone(repoUrl, targetPath, source.path, source.ref);
  } else {
    // Clone entire repo
    await fullClone(repoUrl, targetPath, source.ref);
  }

  return targetPath;
}

/**
 * Perform a sparse checkout for a specific path.
 */
async function sparseClone(
  repoUrl: string,
  targetPath: string,
  subPath: string,
  ref?: string,
): Promise<void> {
  validateGitArg(subPath, 'subPath');
  if (ref) validateGitArg(ref, 'ref');

  const tempDir = `${targetPath}.tmp`;

  try {
    await execFileAsync('git', [
      'clone',
      '--depth',
      '1',
      '--filter=blob:none',
      '--sparse',
      repoUrl,
      tempDir,
    ]);
    await execFileAsync('git', ['-C', tempDir, 'sparse-checkout', 'set', subPath]);

    if (ref) {
      await execFileAsync('git', ['-C', tempDir, 'fetch', '--depth', '1', 'origin', ref]);
      await execFileAsync('git', ['-C', tempDir, 'checkout', ref]);
    }

    const sourcePath = path.join(tempDir, subPath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Path "${subPath}" not found in repository`);
    }

    fs.renameSync(sourcePath, targetPath);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  }
}

/**
 * Perform a full shallow clone.
 */
async function fullClone(repoUrl: string, targetPath: string, ref?: string): Promise<void> {
  if (ref) validateGitArg(ref, 'ref');

  const args = ['clone', '--depth', '1'];
  if (ref) {
    args.push('--branch', ref);
  }
  args.push(repoUrl, targetPath);

  await execFileAsync('git', args);

  // Remove .git directory to save space
  const gitDir = path.join(targetPath, '.git');
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true });
  }
}

/**
 * Check for updates to an installed Vercel skill.
 *
 * @param skillName - Name of the installed skill
 * @param registry - Skill registry
 * @returns Update information
 */
export async function checkVercelSkillUpdates(
  skillName: string,
  registry: SkillRegistry,
): Promise<UpdateInfo> {
  const skill = registry.get(skillName);
  if (!skill) {
    throw new Error(`Skill "${skillName}" is not installed`);
  }

  if (skill.source !== 'vercel') {
    throw new Error(`Skill "${skillName}" is not a Vercel skill`);
  }

  if (!skill.sourceIdentifier) {
    throw new Error(`Skill "${skillName}" does not have source identifier`);
  }

  // For now, we'll use a simple approach:
  // 1. Check if the GitHub repo has newer commits
  // 2. Compare version in SKILL.md if available

  try {
    const parsed = parseVercelSource(skill.sourceIdentifier);
    const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;

    const currentVersion = skill.metadata.version ?? 'unknown';

    // Version comparison requires fetching and parsing the remote SKILL.md,
    // which is not yet implemented. Return false to avoid misleading prompts.
    return {
      available: false,
      currentVersion,
      changelog: `Check ${repoUrl} for changes`,
    };
  } catch (error) {
    logger.error(
      'Error checking for updates',
      error instanceof Error ? error : new Error(String(error)),
    );
    return {
      available: false,
      currentVersion: skill.metadata.version,
    };
  }
}

/**
 * Update an installed Vercel skill to the latest version.
 *
 * @param skillName - Name of the skill to update
 * @param registry - Skill registry
 * @returns Updated skill object
 */
export async function updateVercelSkill(
  skillName: string,
  registry: SkillRegistry,
): Promise<Skill> {
  const skill = registry.get(skillName);
  if (!skill) {
    throw new Error(`Skill "${skillName}" is not installed`);
  }

  if (skill.source !== 'vercel') {
    throw new Error(`Skill "${skillName}" is not a Vercel skill`);
  }

  if (!skill.sourceIdentifier) {
    throw new Error(`Skill "${skillName}" does not have source identifier`);
  }

  // Reinstall with force flag
  const options: VercelLoadOptions = {
    targetDir: path.dirname(skill.sourcePath),
    scope: skill.scope,
    registry,
    generateEmbedding: !!skill.embedding,
    force: true,
  };

  return loadFromVercelSkills(skill.sourceIdentifier, options);
}

/**
 * Check if npx skills CLI is available.
 *
 * @returns True if available, false otherwise
 */
export async function isVercelCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('npx', ['skills', '--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
