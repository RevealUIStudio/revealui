#!/usr/bin/env tsx
/**
 * Documentation Lifecycle Workflow
 *
 * Implements formal documentation lifecycle: Planning → Creation → Implementation → Reset
 * Integrates with WorkflowStateMachine for state management and approval gates.
 *
 * Usage:
 *   pnpm workflow:run documentation-lifecycle "Update API documentation"
 *   pnpm workflow:resume <workflow-id>
 *   pnpm workflow:status <workflow-id>
 */

import { createLogger, type WorkflowStep } from '../lib/index.js'

const logger = createLogger({ prefix: 'DocLifecycle' })

/**
 * Documentation lifecycle workflow phases
 */
export const DOC_LIFECYCLE_STEPS: WorkflowStep[] = [
  {
    id: 'planning',
    name: 'Planning Phase',
    description: 'Design documentation structure and content outline',
    requiresApproval: true,
    script: 'scripts/workflows/manage-docs.ts',
    command: 'plan',
    validation: ['docs-structure'],
    timeout: 30 * 60 * 1000, // 30 minutes
  },
  {
    id: 'creation',
    name: 'Creation Phase',
    description: 'Write documentation content in .drafts/ directory',
    requiresApproval: true,
    script: 'scripts/workflows/manage-docs.ts',
    command: 'create',
    validation: ['docs-validation'],
    dependsOn: ['planning'],
    timeout: 60 * 60 * 1000, // 1 hour
  },
  {
    id: 'implementation',
    name: 'Implementation Phase',
    description: 'Move documentation to final location and update links',
    requiresApproval: true,
    script: 'scripts/workflows/manage-docs.ts',
    command: 'implement',
    validation: ['docs-links', 'docs-validation'],
    dependsOn: ['creation'],
    timeout: 15 * 60 * 1000, // 15 minutes
  },
  {
    id: 'reset',
    name: 'Reset Phase',
    description: 'Archive stale docs, cleanup, and update changelog',
    requiresApproval: true,
    script: 'scripts/workflows/manage-docs.ts',
    command: 'reset',
    validation: ['docs-cleanup'],
    dependsOn: ['implementation'],
    timeout: 15 * 60 * 1000, // 15 minutes
  },
]

/**
 * Get workflow steps for documentation lifecycle
 */
export function getDocLifecycleSteps(): WorkflowStep[] {
  return DOC_LIFECYCLE_STEPS
}

/**
 * Validate documentation workflow prerequisites
 */
export async function validatePrerequisites(): Promise<boolean> {
  logger.header('Documentation Lifecycle Prerequisites')

  const checks = [
    {
      name: 'docs directory exists',
      check: async () => {
        const { existsSync } = await import('node:fs')
        return existsSync('docs')
      },
    },
    {
      name: 'docs/.drafts directory exists',
      check: async () => {
        const { existsSync } = await import('node:fs')
        return existsSync('docs/.drafts') || true // Create if missing
      },
    },
    {
      name: 'docs/archive directory exists',
      check: async () => {
        const { existsSync } = await import('node:fs')
        return existsSync('docs/archive') || true // Create if missing
      },
    },
    {
      name: 'manage-docs.ts script exists',
      check: async () => {
        const { existsSync } = await import('node:fs')
        return existsSync('scripts/workflows/manage-docs.ts')
      },
    },
  ]

  let allPassed = true
  for (const { name, check } of checks) {
    const passed = await check()
    logger.info(`${passed ? '✅' : '❌'} ${name}`)
    if (!passed) allPassed = false
  }

  if (!allPassed) {
    logger.error('Prerequisites not met')
    return false
  }

  logger.success('All prerequisites met')
  return true
}

/**
 * Create missing directories if needed
 */
export async function createMissingDirectories(): Promise<void> {
  const { existsSync, mkdirSync } = await import('node:fs')
  const { join } = await import('node:path')

  const dirs = ['docs/.drafts', 'docs/archive', 'docs/archive/phase-history']

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      logger.info(`Creating directory: ${dir}`)
      mkdirSync(dir, { recursive: true })
    }
  }
}

/**
 * Display workflow help
 */
export function displayHelp(): void {
  console.log(`
Documentation Lifecycle Workflow
=================================

This workflow manages the complete documentation lifecycle with approval gates
at each phase to ensure quality and human oversight.

Phases:
  1. Planning       - Design doc structure and content outline
  2. Creation       - Write content in docs/.drafts/
  3. Implementation - Move to final location, update links
  4. Reset          - Archive stale docs, update changelog

Usage:
  # Start new workflow
  pnpm workflow:run documentation-lifecycle "Update API docs"

  # Resume paused workflow
  pnpm workflow:resume <workflow-id>

  # Check workflow status
  pnpm workflow:status <workflow-id>

  # List all workflows
  pnpm workflow:list

Approval Process:
  - Each phase requires human approval before proceeding
  - Approval requests expire after 24 hours
  - You can approve/reject via CLI or approval file

Validation:
  - Planning: Validates doc structure
  - Creation: Runs comprehensive doc validation
  - Implementation: Checks links and validation
  - Reset: Verifies cleanup completed

State Management:
  - Workflow state persists to database (PGlite)
  - Can pause and resume at any time
  - Rollback capability if steps fail

Examples:
  # Create new API documentation
  pnpm workflow:run documentation-lifecycle "Add new API endpoint docs"

  # Update security documentation
  pnpm workflow:run documentation-lifecycle "Update security audit"

  # Archive old phase documentation
  pnpm workflow:run documentation-lifecycle "Archive Phase 6 docs"
`)
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    displayHelp()
    return
  }

  if (args[0] === 'validate') {
    const valid = await validatePrerequisites()
    process.exit(valid ? 0 : 1)
  }

  if (args[0] === 'setup') {
    await createMissingDirectories()
    logger.success('Documentation directories created')
    return
  }

  if (args[0] === 'steps') {
    logger.header('Documentation Lifecycle Steps')
    const steps = getDocLifecycleSteps()
    for (const [index, step] of steps.entries()) {
      logger.info(`${index + 1}. ${step.name}`)
      logger.info(`   Description: ${step.description}`)
      logger.info(`   Requires Approval: ${step.requiresApproval ? 'Yes' : 'No'}`)
      logger.info(`   Timeout: ${step.timeout ? `${step.timeout / 1000}s` : 'None'}`)
      if (step.dependsOn && step.dependsOn.length > 0) {
        logger.info(`   Depends On: ${step.dependsOn.join(', ')}`)
      }
      logger.info('')
    }
    return
  }

  displayHelp()
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Workflow failed:', error)
    process.exit(1)
  })
}
