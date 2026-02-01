/**
 * GitHub Skill Loader
 *
 * Install skills from GitHub repositories.
 */

import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { parseSkillMd } from '../parser/index.js'
import type { SkillRegistry } from '../registry/index.js'
import type { Skill } from '../types.js'

const execAsync = promisify(exec)

/**
 * GitHub skill source specification.
 *
 * Formats:
 * - owner/repo - Clone entire repo
 * - owner/repo/path/to/skill - Clone specific path
 */
export interface GitHubSource {
  owner: string
  repo: string
  path?: string
  ref?: string // Branch, tag, or commit
}

/**
 * Parse a GitHub source string into components.
 *
 * @example
 * parseGitHubSource("vercel-labs/agent-skills")
 * // { owner: "vercel-labs", repo: "agent-skills" }
 *
 * parseGitHubSource("vercel-labs/agent-skills/skills/react-best-practices")
 * // { owner: "vercel-labs", repo: "agent-skills", path: "skills/react-best-practices" }
 */
export function parseGitHubSource(source: string): GitHubSource {
  // Handle @ref suffix for specific branch/tag
  let ref: string | undefined
  let sourcePath = source

  if (source.includes('@')) {
    const atIndex = source.lastIndexOf('@')
    ref = source.slice(atIndex + 1)
    sourcePath = source.slice(0, atIndex)
  }

  const parts = sourcePath.split('/')

  if (parts.length < 2) {
    throw new Error(`Invalid GitHub source: ${source}. Expected format: owner/repo[/path][@ref]`)
  }

  const owner = parts[0]
  const repo = parts[1]
  const pathParts = parts.slice(2)

  if (!owner || !repo) {
    throw new Error(`Invalid GitHub source: ${source}. Expected format: owner/repo[/path][@ref]`)
  }

  return {
    owner,
    repo,
    path: pathParts.length > 0 ? pathParts.join('/') : undefined,
    ref,
  }
}

/**
 * Options for loading from GitHub.
 */
export interface GitHubLoadOptions {
  /** Target directory for installation */
  targetDir: string

  /** Scope: local (project) or global */
  scope: 'local' | 'global'

  /** Registry to register skill with */
  registry: SkillRegistry

  /** Generate embedding for semantic search */
  generateEmbedding?: boolean

  /** Force reinstall if already exists */
  force?: boolean
}

/**
 * Load a skill from a GitHub repository.
 *
 * Uses git sparse checkout for efficiency when loading from a subdirectory.
 */
export async function loadFromGitHub(source: string, options: GitHubLoadOptions): Promise<Skill> {
  const parsed = parseGitHubSource(source)
  const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`

  // Determine skill name from path or repo name
  const skillName = parsed.path ? path.basename(parsed.path) : parsed.repo

  const targetPath = path.join(options.targetDir, skillName)

  // Check if already exists
  if (fs.existsSync(targetPath)) {
    if (options.force) {
      fs.rmSync(targetPath, { recursive: true })
    } else {
      throw new Error(`Skill "${skillName}" already exists. Use --force to overwrite.`)
    }
  }

  // Ensure target directory exists
  if (!fs.existsSync(options.targetDir)) {
    fs.mkdirSync(options.targetDir, { recursive: true })
  }

  if (parsed.path) {
    // Use sparse checkout for subdirectory
    await sparseClone(repoUrl, targetPath, parsed.path, parsed.ref)
  } else {
    // Clone entire repo
    await fullClone(repoUrl, targetPath, parsed.ref)
  }

  // Find and validate SKILL.md
  const skillMdPath = path.join(targetPath, 'SKILL.md')
  if (!fs.existsSync(skillMdPath)) {
    // Clean up failed install
    fs.rmSync(targetPath, { recursive: true })
    throw new Error(`No SKILL.md found in ${source}`)
  }

  // Parse and validate
  const content = fs.readFileSync(skillMdPath, 'utf-8')
  const parsedSkill = parseSkillMd(content)

  // Create skill object
  const skill: Skill = {
    metadata: parsedSkill.metadata,
    instructions: parsedSkill.instructions,
    sourcePath: targetPath,
    scope: options.scope,
    installedAt: new Date().toISOString(),
  }

  // Register with registry
  if (options.registry.has(skill.metadata.name)) {
    options.registry.unregister(skill.metadata.name)
  }
  options.registry.register(skill)

  // Load fully (with resources and optionally embedding)
  return (await options.registry.loadSkill(skill.metadata.name, options.generateEmbedding)) ?? skill
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
  // Create a temp directory for the sparse checkout
  const tempDir = `${targetPath}.tmp`

  try {
    // Initialize sparse checkout
    await execAsync(`git clone --depth 1 --filter=blob:none --sparse ${repoUrl} ${tempDir}`)

    // Configure sparse checkout
    await execAsync(`git -C ${tempDir} sparse-checkout set ${subPath}`)

    // Checkout specific ref if provided
    if (ref) {
      await execAsync(`git -C ${tempDir} fetch --depth 1 origin ${ref}`)
      await execAsync(`git -C ${tempDir} checkout ${ref}`)
    }

    // Move the skill directory to target
    const sourcePath = path.join(tempDir, subPath)
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Path "${subPath}" not found in repository`)
    }

    fs.renameSync(sourcePath, targetPath)
  } finally {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  }
}

/**
 * Perform a full shallow clone.
 */
async function fullClone(repoUrl: string, targetPath: string, ref?: string): Promise<void> {
  const refArg = ref ? `--branch ${ref}` : ''
  await execAsync(`git clone --depth 1 ${refArg} ${repoUrl} ${targetPath}`)

  // Remove .git directory to save space
  const gitDir = path.join(targetPath, '.git')
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true })
  }
}

/**
 * Update an installed skill from GitHub.
 */
export async function updateFromGitHub(
  skillName: string,
  registry: SkillRegistry,
): Promise<Skill | undefined> {
  const skill = registry.get(skillName)
  if (!skill) {
    throw new Error(`Skill "${skillName}" is not installed`)
  }

  // For now, we don't track the original source URL
  // This would require storing metadata about where the skill came from
  throw new Error('Update not yet implemented. Please reinstall with --force.')
}

/**
 * Check if a GitHub source is valid and accessible.
 */
export async function validateGitHubSource(source: string): Promise<boolean> {
  try {
    const parsed = parseGitHubSource(source)
    const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`

    // Use git ls-remote to check if repo exists
    await execAsync(`git ls-remote --exit-code ${repoUrl} HEAD`)
    return true
  } catch {
    return false
  }
}
