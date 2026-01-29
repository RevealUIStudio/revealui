#!/usr/bin/env tsx
/**
 * Skills CLI
 *
 * Manage Agent Skills for RevealUI.
 *
 * Usage:
 *   pnpm skills add <owner/repo>     # Install skill from GitHub
 *   pnpm skills add <path> --local   # Install from local directory
 *   pnpm skills list                 # List installed skills
 *   pnpm skills info <name>          # Show skill details
 *   pnpm skills remove <name>        # Uninstall a skill
 *   pnpm skills search <query>       # Search skills
 *   pnpm skills create <name>        # Create a new skill template
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { createLogger } from '../lib/index.js'

// Dynamic imports for AI package (may not be built yet)
async function getSkillsModule() {
  const mod = await import('../../packages/ai/src/skills/index.js')
  return mod
}

const logger = createLogger({ prefix: 'Skills' })

async function main() {
  const command = process.argv[2]

  if (!command || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  try {
    switch (command) {
      case 'add':
        await addSkill()
        break
      case 'list':
        await listSkills()
        break
      case 'info':
        await showInfo()
        break
      case 'remove':
        await removeSkill()
        break
      case 'search':
        await searchSkills()
        break
      case 'create':
        await createSkill()
        break
      default:
        logger.error(`Unknown command: ${command}`)
        showHelp()
        process.exit(1)
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function addSkill() {
  const source = process.argv[3]
  if (!source) {
    logger.error('Source required')
    logger.info('Usage: pnpm skills add <owner/repo> [--global] [--force]')
    logger.info('       pnpm skills add <path> --local [--global] [--force]')
    process.exit(1)
  }

  const skills = await getSkillsModule()
  const isLocal = process.argv.includes('--local')
  const isGlobal = process.argv.includes('--global')
  const force = process.argv.includes('--force')

  const scope = isGlobal ? 'global' : 'local'
  const registry = new skills.SkillRegistry({
    projectRoot: process.cwd(),
  })

  const targetDir = registry.getSkillDirectory('', scope).replace(/\/$/, '')

  if (isLocal) {
    // Install from local directory
    logger.info(`Installing from local path: ${source}`)

    const skill = await skills.loadFromLocal(source, {
      targetDir,
      scope,
      registry,
      copy: true,
      force,
      generateEmbedding: false,
    })

    logger.success(`Installed skill: ${skill.metadata.name}`)
    logger.info(`  Description: ${skill.metadata.description}`)
    logger.info(`  Location: ${skill.sourcePath}`)
  } else {
    // Install from GitHub
    logger.info(`Installing from GitHub: ${source}`)

    // Validate source exists
    const isValid = await skills.validateGitHubSource(source)
    if (!isValid) {
      throw new Error(`Could not access GitHub repository: ${source}`)
    }

    const skill = await skills.loadFromGitHub(source, {
      targetDir,
      scope,
      registry,
      force,
      generateEmbedding: false,
    })

    logger.success(`Installed skill: ${skill.metadata.name}`)
    logger.info(`  Description: ${skill.metadata.description}`)
    logger.info(`  Location: ${skill.sourcePath}`)
  }
}

async function listSkills() {
  const skills = await getSkillsModule()
  const registry = new skills.SkillRegistry({
    projectRoot: process.cwd(),
  })

  await registry.loadAllMetadata()
  const metadata = registry.getAllMetadata()

  if (metadata.length === 0) {
    logger.info('No skills installed')
    logger.info('')
    logger.info('Install skills with:')
    logger.info('  pnpm skills add <owner/repo>')
    logger.info('  pnpm skills add <path> --local')
    return
  }

  logger.header('Installed Skills')

  for (const meta of metadata) {
    console.log(`  ${meta.name}`)
    console.log(`    ${meta.description}`)
    if (meta.tags?.length) {
      console.log(`    Tags: ${meta.tags.join(', ')}`)
    }
    console.log()
  }

  logger.info(`Total: ${metadata.length} skill(s)`)
}

async function showInfo() {
  const name = process.argv[3]
  if (!name) {
    logger.error('Skill name required')
    logger.info('Usage: pnpm skills info <name>')
    process.exit(1)
  }

  const skills = await getSkillsModule()
  const registry = new skills.SkillRegistry({
    projectRoot: process.cwd(),
  })

  const skill = await registry.loadSkill(name)
  if (!skill) {
    logger.error(`Skill not found: ${name}`)
    process.exit(1)
  }

  logger.header(`Skill: ${skill.metadata.name}`)
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
  logger.divider()
  console.log()
  console.log('Instructions:')
  console.log()
  // Truncate very long instructions for display
  const maxLines = 30
  const lines = skill.instructions.split('\n')
  if (lines.length > maxLines) {
    console.log(lines.slice(0, maxLines).join('\n'))
    console.log(`\n... (${lines.length - maxLines} more lines)`)
  } else {
    console.log(skill.instructions)
  }
}

async function removeSkill() {
  const name = process.argv[3]
  if (!name) {
    logger.error('Skill name required')
    logger.info('Usage: pnpm skills remove <name>')
    process.exit(1)
  }

  const skills = await getSkillsModule()
  const registry = new skills.SkillRegistry({
    projectRoot: process.cwd(),
  })

  // Load the skill first so it's in the registry
  const skill = await registry.loadSkill(name)
  if (!skill) {
    logger.error(`Skill not found: ${name}`)
    process.exit(1)
  }

  const removed = skills.removeSkill(name, registry)
  if (!removed) {
    logger.error(`Failed to remove skill: ${name}`)
    process.exit(1)
  }

  logger.success(`Removed skill: ${name}`)
}

async function searchSkills() {
  const query = process.argv[3]
  if (!query) {
    logger.error('Search query required')
    logger.info('Usage: pnpm skills search <query>')
    process.exit(1)
  }

  const useSemantic = process.argv.includes('--semantic')

  const skills = await getSkillsModule()
  const registry = new skills.SkillRegistry({
    projectRoot: process.cwd(),
  })

  await registry.loadAllSkills(useSemantic)

  if (useSemantic) {
    logger.info('Searching with semantic similarity...')
    const results = await registry.searchByEmbedding(query, 0.5, 10)

    if (results.length === 0) {
      logger.info('No matching skills found')
      return
    }

    logger.header('Search Results')
    for (const { skill, score } of results) {
      console.log(`  ${skill.metadata.name} (${(score * 100).toFixed(1)}% match)`)
      console.log(`    ${skill.metadata.description}`)
      console.log()
    }
  } else {
    const results = registry.searchByKeyword(query)

    if (results.length === 0) {
      logger.info('No matching skills found')
      return
    }

    logger.header('Search Results')
    for (const skill of results) {
      console.log(`  ${skill.metadata.name}`)
      console.log(`    ${skill.metadata.description}`)
      console.log()
    }
  }
}

async function createSkill() {
  const name = process.argv[3]
  if (!name) {
    logger.error('Skill name required')
    logger.info('Usage: pnpm skills create <name> [--global]')
    process.exit(1)
  }

  // Validate name format
  if (!/^[a-z0-9-]+$/.test(name)) {
    logger.error('Skill name must be kebab-case (lowercase letters, numbers, hyphens)')
    process.exit(1)
  }

  const isGlobal = process.argv.includes('--global')
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

  logger.success(`Created skill template: ${name}`)
  logger.info(`Location: ${skillDir}`)
  logger.info('')
  logger.info('Next steps:')
  logger.info(`  1. Edit ${path.join(skillDir, 'SKILL.md')} with your instructions`)
  logger.info('  2. Add any scripts to the scripts/ directory')
  logger.info('  3. Add reference docs to the references/ directory')
}

function showHelp() {
  console.log(`
Skills CLI - Manage Agent Skills for RevealUI

Usage:
  pnpm skills <command> [options]

Commands:
  add <source>       Install a skill
  list               List installed skills
  info <name>        Show skill details
  remove <name>      Uninstall a skill
  search <query>     Search skills by keyword
  create <name>      Create a new skill template

Add Options:
  --local            Install from local directory instead of GitHub
  --global           Install globally (~/.revealui/skills/)
  --force            Overwrite existing installation

Search Options:
  --semantic         Use embedding-based semantic search

Examples:
  pnpm skills add vercel-labs/agent-skills
  pnpm skills add vercel-labs/agent-skills/skills/react-best-practices
  pnpm skills add ./my-skill --local
  pnpm skills add owner/repo --global --force
  pnpm skills list
  pnpm skills info react-best-practices
  pnpm skills remove react-best-practices
  pnpm skills search "react component"
  pnpm skills search "database optimization" --semantic
  pnpm skills create my-new-skill

Skill Locations:
  Project-local: .revealui/skills/
  Global: ~/.revealui/skills/

Note: Project-local skills take precedence over global skills.
`)
}

main().catch((error) => {
  logger.error(error.message)
  process.exit(1)
})
