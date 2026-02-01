#!/usr/bin/env tsx
/**
 * Skills CLI
 *
 * Manage Agent Skills for RevealUI with dual-mode output support.
 *
 * Usage:
 *   pnpm skills add <owner/repo>     # Install skill from GitHub
 *   pnpm skills add <path> --local   # Install from local directory
 *   pnpm skills list                 # List installed skills
 *   pnpm skills info <name>          # Show skill details
 *   pnpm skills remove <name>        # Uninstall a skill
 *   pnpm skills search <query>       # Search skills
 *   pnpm skills create <name>        # Create a new skill template
 *
 * Add --json flag to any command for machine-readable output.
 */

import * as path from 'node:path'
import type { ParsedArgs } from '../lib/args.js'
import { executionError, notFound, validationError } from '../lib/errors.js'
import { ok, type ScriptOutput } from '../lib/output.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

// =============================================================================
// Types for JSON output
// =============================================================================

interface SkillData {
  name: string
  description: string
  version?: string
  license?: string
  author?: string
  scope: 'local' | 'global'
  path: string
  tags?: string[]
  compatibility?: string[]
  allowedTools?: string[]
}

interface SkillListData {
  skills: SkillData[]
  count: number
}

interface SkillSearchResult {
  skill: SkillData
  score?: number
}

interface SkillSearchData {
  results: SkillSearchResult[]
  query: string
  semantic: boolean
}

interface SkillInstallData {
  installed: SkillData
  source: string
  sourceType: 'github' | 'local'
}

interface SkillCreateData {
  created: string
  path: string
}

// =============================================================================
// Dynamic import for AI package
// =============================================================================

/**
 * Dynamically import the skills module with comprehensive error handling
 *
 * Handles:
 * - Module not found (package not installed)
 * - Network errors (if module fetches from registry)
 * - Invalid module structure
 * - Import failures
 */
async function getSkillsModule() {
  try {
    const mod = await import('../../packages/ai/src/skills/index.js')

    // Validate module has expected exports
    if (!mod || typeof mod !== 'object') {
      throw executionError('Skills module loaded but has invalid structure', undefined, undefined, {
        hint: 'The skills module may be corrupted. Try reinstalling dependencies.',
      })
    }

    // Verify critical functions exist
    const requiredExports = ['listSkills', 'getSkill', 'addSkill', 'removeSkill']
    const missingExports = requiredExports.filter((exp) => !(exp in mod))

    if (missingExports.length > 0) {
      throw executionError('Skills module is missing required exports', undefined, undefined, {
        hint: `Missing: ${missingExports.join(', ')}. Try reinstalling @revealui/ai package.`,
        missingExports,
      })
    }

    return mod
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // Module not found - most common case
      if (
        'code' in error &&
        (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND')
      ) {
        throw executionError('Skills package not found', undefined, error, {
          hint: 'Run `pnpm install` to install dependencies, or ensure @revealui/ai is built.',
          code: error.code,
        })
      }

      // Network errors (if module uses dynamic imports from CDN)
      if ('code' in error && (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')) {
        throw executionError('Network error while loading skills module', undefined, error, {
          hint: 'Check your internet connection and try again.',
          code: error.code,
        })
      }

      // Syntax errors in the module
      if (error.name === 'SyntaxError') {
        throw executionError('Skills module has syntax errors', undefined, error, {
          hint: 'The skills module may be corrupted. Try rebuilding: pnpm --filter @revealui/ai build',
        })
      }

      // Import resolution errors
      if (error.message.includes('Cannot find module')) {
        throw executionError('Skills module dependencies not found', undefined, error, {
          hint: 'Run `pnpm install` and ensure all dependencies are installed.',
        })
      }
    }

    // Rethrow if it's already a ScriptError
    throw error
  }
}

// =============================================================================
// Skills CLI
// =============================================================================

class SkillsCLI extends BaseCLI {
  name = 'skills'
  description = 'Manage Agent Skills for RevealUI'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'list',
        description: 'List installed skills',
        args: [],
        handler: (args) => this.list(args),
      },
      {
        name: 'info',
        description: 'Show skill details',
        args: [],
        handler: (args) => this.info(args),
      },
      {
        name: 'add',
        description: 'Install a skill from GitHub or local directory',
        args: [
          { name: 'local', type: 'boolean', description: 'Install from local directory' },
          { name: 'global', type: 'boolean', description: 'Install globally' },
          { name: 'force', type: 'boolean', description: 'Overwrite existing' },
        ],
        handler: (args) => this.add(args),
      },
      {
        name: 'remove',
        description: 'Uninstall a skill',
        confirmPrompt: 'Are you sure you want to remove this skill?',
        args: [],
        handler: (args) => this.remove(args),
      },
      {
        name: 'search',
        description: 'Search skills by keyword or semantic similarity',
        args: [{ name: 'semantic', type: 'boolean', description: 'Use embedding-based search' }],
        handler: (args) => this.search(args),
      },
      {
        name: 'create',
        description: 'Create a new skill template',
        args: [{ name: 'global', type: 'boolean', description: 'Create in global location' }],
        handler: (args) => this.create(args),
      },
    ]
  }

  // ===========================================================================
  // Commands
  // ===========================================================================

  private async list(_args: ParsedArgs): Promise<ScriptOutput<SkillListData>> {
    const skills = await getSkillsModule()
    const registry = new skills.SkillRegistry({
      projectRoot: process.cwd(),
    })

    await registry.loadAllMetadata()
    const metadata = registry.getAllMetadata()

    const data: SkillListData = {
      skills: metadata.map((meta) => ({
        name: meta.name,
        description: meta.description,
        version: meta.version,
        scope: 'local' as const, // Metadata doesn't include scope directly
        path: '',
        tags: meta.tags,
      })),
      count: metadata.length,
    }

    // Human-mode output
    if (!this.output.isJsonMode()) {
      if (metadata.length === 0) {
        this.output.progress('No skills installed')
        this.output.progress('')
        this.output.progress('Install skills with:')
        this.output.progress('  pnpm skills add <owner/repo>')
        this.output.progress('  pnpm skills add <path> --local')
      } else {
        this.output.header('Installed Skills')

        for (const meta of metadata) {
          console.log(`  ${meta.name}`)
          console.log(`    ${meta.description}`)
          if (meta.tags?.length) {
            console.log(`    Tags: ${meta.tags.join(', ')}`)
          }
          console.log()
        }

        this.output.progress(`Total: ${metadata.length} skill(s)`)
      }
    }

    return ok(data)
  }

  private async info(_args: ParsedArgs): Promise<ScriptOutput<SkillData>> {
    const name = this.requirePositional(0, 'skill name')

    const skills = await getSkillsModule()
    const registry = new skills.SkillRegistry({
      projectRoot: process.cwd(),
    })

    await registry.loadAllMetadata()
    const skill = await registry.loadSkill(name)

    if (!skill) {
      throw notFound('Skill', name)
    }

    const data: SkillData = {
      name: skill.metadata.name,
      description: skill.metadata.description,
      version: skill.metadata.version,
      license: skill.metadata.license,
      author: skill.metadata.author,
      scope: skill.scope as 'local' | 'global',
      path: skill.sourcePath,
      tags: skill.metadata.tags,
      compatibility: skill.metadata.compatibility,
      allowedTools: skill.metadata.allowedTools,
    }

    // Human-mode output
    if (!this.output.isJsonMode()) {
      this.output.header(`Skill: ${skill.metadata.name}`)
      console.log()
      console.log(`Description: ${skill.metadata.description}`)
      console.log(`Version: ${skill.metadata.version ?? 'Not specified'}`)
      console.log(`License: ${skill.metadata.license ?? 'Not specified'}`)
      console.log(`Author: ${skill.metadata.author ?? 'Not specified'}`)
      console.log(`Scope: ${skill.scope}`)
      console.log(`Path: ${skill.sourcePath}`)

      if (skill.metadata.tags?.length) {
        console.log(`Tags: ${skill.metadata.tags.join(', ')}`)
      }

      if (skill.metadata.compatibility?.length) {
        console.log(`Compatibility: ${skill.metadata.compatibility.join(', ')}`)
      }

      if (skill.metadata.allowedTools?.length) {
        console.log(`Allowed Tools: ${skill.metadata.allowedTools.join(', ')}`)
      }

      if (skill.resources?.length) {
        console.log()
        console.log('Resources:')
        for (const resource of skill.resources) {
          console.log(`  - ${resource.path} (${resource.type})`)
        }
      }

      console.log()
      this.output.divider()
      console.log()
      console.log('Instructions:')
      console.log()

      const maxLines = 30
      const lines = skill.instructions.split('\n')
      if (lines.length > maxLines) {
        console.log(lines.slice(0, maxLines).join('\n'))
        console.log(`\n... (${lines.length - maxLines} more lines)`)
      } else {
        console.log(skill.instructions)
      }
    }

    return ok(data)
  }

  private async add(_args: ParsedArgs): Promise<ScriptOutput<SkillInstallData>> {
    const source = this.requirePositional(0, 'source (owner/repo or path)')

    const skills = await getSkillsModule()
    const isLocal = this.getFlag('local', false)
    const isGlobal = this.getFlag('global', false)
    const force = this.getFlag('force', false)

    const scope = isGlobal ? 'global' : 'local'
    const registry = new skills.SkillRegistry({
      projectRoot: process.cwd(),
    })

    const targetDir = registry.getSkillDirectory('', scope).replace(/\/$/, '')

    let skill: Awaited<ReturnType<typeof skills.loadFromLocal>>

    if (isLocal) {
      this.output.progress(`Installing from local path: ${source}`)

      skill = await skills.loadFromLocal(source, {
        targetDir,
        scope,
        registry,
        copy: true,
        force,
        generateEmbedding: false,
      })
    } else {
      this.output.progress(`Installing from GitHub: ${source}`)

      const isValid = await skills.validateGitHubSource(source)
      if (!isValid) {
        throw executionError(`Could not access GitHub repository: ${source}`)
      }

      skill = await skills.loadFromGitHub(source, {
        targetDir,
        scope,
        registry,
        force,
        generateEmbedding: false,
      })
    }

    const data: SkillInstallData = {
      installed: {
        name: skill.metadata.name,
        description: skill.metadata.description,
        version: skill.metadata.version,
        scope: skill.scope as 'local' | 'global',
        path: skill.sourcePath,
        tags: skill.metadata.tags,
      },
      source,
      sourceType: isLocal ? 'local' : 'github',
    }

    this.output.progress(`Installed skill: ${skill.metadata.name}`)
    this.output.progress(`  Description: ${skill.metadata.description}`)
    this.output.progress(`  Location: ${skill.sourcePath}`)

    return ok(data)
  }

  private async remove(_args: ParsedArgs): Promise<ScriptOutput<{ removed: string }>> {
    const name = this.requirePositional(0, 'skill name')

    const skills = await getSkillsModule()
    const registry = new skills.SkillRegistry({
      projectRoot: process.cwd(),
    })

    await registry.loadAllMetadata()
    const skill = await registry.loadSkill(name)

    if (!skill) {
      throw notFound('Skill', name)
    }

    const removed = skills.removeSkill(skill.metadata.name, registry)
    if (!removed) {
      throw executionError(`Failed to remove skill: ${name}`)
    }

    this.output.progress(`Removed skill: ${skill.metadata.name}`)
    return ok({ removed: skill.metadata.name })
  }

  private async search(_args: ParsedArgs): Promise<ScriptOutput<SkillSearchData>> {
    const query = this.requirePositional(0, 'search query')
    const useSemantic = this.getFlag('semantic', false)

    const skills = await getSkillsModule()
    const registry = new skills.SkillRegistry({
      projectRoot: process.cwd(),
    })

    await registry.loadAllSkills(useSemantic)

    let results: SkillSearchResult[]

    if (useSemantic) {
      this.output.progress('Searching with semantic similarity...')
      const semanticResults = await registry.searchByEmbedding(query, 0.5, 10)
      results = semanticResults.map(({ skill, score }) => ({
        skill: {
          name: skill.metadata.name,
          description: skill.metadata.description,
          version: skill.metadata.version,
          scope: skill.scope as 'local' | 'global',
          path: skill.sourcePath,
          tags: skill.metadata.tags,
        },
        score,
      }))
    } else {
      const keywordResults = registry.searchByKeyword(query)
      results = keywordResults.map((skill) => ({
        skill: {
          name: skill.metadata.name,
          description: skill.metadata.description,
          version: skill.metadata.version,
          scope: skill.scope as 'local' | 'global',
          path: skill.sourcePath,
          tags: skill.metadata.tags,
        },
      }))
    }

    const data: SkillSearchData = {
      results,
      query,
      semantic: useSemantic,
    }

    // Human-mode output
    if (!this.output.isJsonMode()) {
      if (results.length === 0) {
        this.output.progress('No matching skills found')
      } else {
        this.output.header('Search Results')
        for (const { skill, score } of results) {
          if (score !== undefined) {
            console.log(`  ${skill.name} (${(score * 100).toFixed(1)}% match)`)
          } else {
            console.log(`  ${skill.name}`)
          }
          console.log(`    ${skill.description}`)
          console.log()
        }
      }
    }

    return ok(data, { count: results.length })
  }

  private async create(_args: ParsedArgs): Promise<ScriptOutput<SkillCreateData>> {
    const name = this.requirePositional(0, 'skill name')

    // Validate name format
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw validationError(
        'Skill name must be kebab-case (lowercase letters, numbers, hyphens)',
        'name',
      )
    }

    const isGlobal = this.getFlag('global', false)
    const skills = await getSkillsModule()
    const registry = new skills.SkillRegistry({
      projectRoot: process.cwd(),
    })

    const scope = isGlobal ? 'global' : 'local'
    const targetDir = registry.getSkillDirectory('', scope).replace(/\/$/, '')

    const skillDir = await skills.createSkill(name, targetDir, {
      createScripts: true,
      createReferences: true,
    })

    const data: SkillCreateData = {
      created: name,
      path: skillDir,
    }

    // Human-mode output
    if (!this.output.isJsonMode()) {
      this.output.progress(`Created skill template: ${name}`)
      this.output.progress(`Location: ${skillDir}`)
      this.output.progress('')
      this.output.progress('Next steps:')
      this.output.progress(`  1. Edit ${path.join(skillDir, 'SKILL.md')} with your instructions`)
      this.output.progress('  2. Add any scripts to the scripts/ directory')
      this.output.progress('  3. Add reference docs to the references/ directory')
    }

    return ok(data)
  }
}

// =============================================================================
// Entry Point
// =============================================================================

runCLI(SkillsCLI)
