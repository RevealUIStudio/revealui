#!/usr/bin/env tsx

/**
 * Cohesion Engine - Ralph Integration
 * Integrates cohesion engine with Ralph iterative workflow system
 */

import { readFile, writeFile } from 'node:fs/promises'
import type { RalphState } from '../../types.ts'
import { createLogger, fileExists, getProjectRoot } from '../../utils/base.ts'
import { validateBrutalHonesty } from '../../utils/brutal-honesty.ts'
import { checkCompletion, isWorkflowActive, readStateFile } from '../../utils/orchestration.ts'

const logger = createLogger()

/**
 * Cohesion workflow stages
 */
type CohesionStage = 'analyze' | 'assess' | 'fix' | 'complete'

interface CohesionWorkflowState extends RalphState {
  stage: CohesionStage
  // biome-ignore lint/style/useNamingConvention: Stored workflow state key.
  analysis_complete: boolean
  // biome-ignore lint/style/useNamingConvention: Stored workflow state key.
  assessment_complete: boolean
  // biome-ignore lint/style/useNamingConvention: Stored workflow state key.
  fixes_applied: boolean
  // biome-ignore lint/style/useNamingConvention: Stored workflow state key.
  last_grade?: string
  // biome-ignore lint/style/useNamingConvention: Stored workflow state key.
  issues_found?: number
  // biome-ignore lint/style/useNamingConvention: Stored workflow state key.
  fixes_applied_count?: number
}

/**
 * Run cohesion analysis
 */
async function runAnalysis(): Promise<{ grade: string; issuesFound: number }> {
  const { exec } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execAsync = promisify(exec)

  logger.info('Running cohesion analysis...')
  const { stderr } = await execAsync('pnpm cohesion:analyze', {
    cwd: process.cwd(),
  })

  if (stderr && !stderr.includes('✅')) {
    // Check if it's just a warning
    const errorLines = stderr.split('\n').filter((line) => line.includes('❌'))
    if (errorLines.length > 0) {
      throw new Error(`Analysis failed: ${stderr}`)
    }
  }

  // Read analysis results
  const projectRoot = await getProjectRoot(import.meta.url)
  const { join } = await import('node:path')
  const analysisPath = join(projectRoot, '.cursor/cohesion-analysis.json')

  if (!(await fileExists(analysisPath))) {
    throw new Error('Analysis file not found')
  }

  const analysisContent = await readFile(analysisPath, 'utf-8')
  const analysis = JSON.parse(analysisContent)

  logger.success(
    `Analysis complete: ${analysis.summary.totalIssues} issues, Grade: ${analysis.summary.overallGrade}`,
  )

  return {
    grade: analysis.summary.overallGrade,
    issuesFound: analysis.summary.totalIssues,
  }
}

/**
 * Run assessment generation
 */
async function runAssessment(): Promise<void> {
  const { exec } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execAsync = promisify(exec)

  logger.info('Generating assessment document...')
  const { stderr } = await execAsync('pnpm cohesion:assess', {
    cwd: process.cwd(),
  })

  if (stderr && !stderr.includes('✅')) {
    const errorLines = stderr.split('\n').filter((line) => line.includes('❌'))
    if (errorLines.length > 0) {
      throw new Error(`Assessment generation failed: ${stderr}`)
    }
  }

  logger.success('Assessment generated')
}

/**
 * Run automated fixes (dry-run by default)
 */
async function runFixes(dryRun = true): Promise<{ fixesApplied: number }> {
  const { exec } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execAsync = promisify(exec)

  const command = dryRun ? 'pnpm cohesion:fix --dry-run' : 'pnpm cohesion:fix'

  logger.info(`Running fixes${dryRun ? ' (DRY RUN)' : ''}...`)
  const { stdout, stderr } = await execAsync(command, {
    cwd: process.cwd(),
  })

  if (stderr && !stderr.includes('✅')) {
    const errorLines = stderr.split('\n').filter((line) => line.includes('❌'))
    if (errorLines.length > 0) {
      throw new Error(`Fix execution failed: ${stderr}`)
    }
  }

  // Parse output to count fixes
  const output = stdout || ''
  const match = output.match(/Fixed:\s+(\d+)/)
  const fixesApplied = match ? Number.parseInt(match[1], 10) : 0

  logger.success(`Fixes${dryRun ? ' would be' : ''} applied: ${fixesApplied}`)

  return { fixesApplied }
}

/**
 * Main cohesion workflow
 */
async function cohesionWorkflow(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url)

  // Check if Ralph workflow is active
  if (!(await isWorkflowActive(projectRoot))) {
    logger.error('No active Ralph workflow found')
    logger.info('Run "pnpm ralph:start" first to begin a workflow')
    process.exit(1)
  }

  // Read state
  const stateFile = await readStateFile(projectRoot)
  const state = stateFile.frontmatter

  // Load cohesion workflow state
  const { join } = await import('node:path')
  const cohesionStatePath = join(projectRoot, '.cursor/cohesion-ralph-state.json')
  let cohesionState: Partial<CohesionWorkflowState> = {}

  if (await fileExists(cohesionStatePath)) {
    try {
      const cohesionStateContent = await readFile(cohesionStatePath, 'utf-8')
      cohesionState = JSON.parse(cohesionStateContent)
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  logger.header(`Cohesion Engine - Ralph Workflow (Iteration ${state.iteration})`)

  try {
    // Stage 1: Analyze
    if (!cohesionState.analysis_complete) {
      logger.info('Stage: Analysis')
      const { grade, issuesFound } = await runAnalysis()

      cohesionState.analysis_complete = true
      cohesionState.last_grade = grade
      cohesionState.issues_found = issuesFound
      cohesionState.stage = 'assess'

      await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2))
      logger.success('Analysis stage complete')
    }

    // Stage 2: Assess
    if (cohesionState.analysis_complete && !cohesionState.assessment_complete) {
      logger.info('Stage: Assessment')
      await runAssessment()

      // Validate brutal honesty
      logger.info('Validating brutal honesty...')
      const { join } = await import('node:path')
      const assessmentPath = join(projectRoot, 'DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md')
      if (await fileExists(assessmentPath)) {
        const assessmentContent = await readFile(assessmentPath, 'utf-8')
        const validation = validateBrutalHonesty(assessmentContent)
        if (validation.valid) {
          logger.success(`Brutal honesty validation passed (${validation.score}/100)`)
        } else {
          logger.warning(`Brutal honesty validation failed (${validation.score}/100)`)
          logger.warning(`Violations: ${validation.violations.length}`)
          for (const violation of validation.violations.slice(0, 3)) {
            logger.warning(`  - ${violation}`)
          }
        }
      }

      cohesionState.assessment_complete = true
      cohesionState.stage = 'fix'

      await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2))
      logger.success('Assessment stage complete')
    }

    // Stage 3: Fix (dry-run first)
    if (cohesionState.assessment_complete && !cohesionState.fixes_applied) {
      logger.info('Stage: Fixes (Dry Run)')
      const { fixesApplied } = await runFixes(true)

      if (fixesApplied > 0) {
        logger.warning(`Found ${fixesApplied} fixable issues`)
        logger.info('Review the dry-run output above')
        logger.info('To apply fixes, run: pnpm cohesion:fix')
        logger.info('Or continue with Ralph workflow after manual review')
      } else {
        cohesionState.fixes_applied = true
        cohesionState.fixes_applied_count = 0
        cohesionState.stage = 'complete'
        await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2))
      }
    }

    // Check completion
    if (state.completion_promise) {
      const completed = await checkCompletion(projectRoot, state.completion_promise)
      if (completed) {
        logger.success('Workflow completed!')
        cohesionState.stage = 'complete'
        await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2))
        process.exit(0)
      }
    }

    // Save state
    await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2))

    // Summary
    logger.header('Workflow Status')
    logger.info(`Stage: ${cohesionState.stage || 'analyze'}`)
    logger.info(`Grade: ${cohesionState.last_grade || 'N/A'}`)
    logger.info(`Issues Found: ${cohesionState.issues_found || 0}`)
    logger.info(`Fixes Applied: ${cohesionState.fixes_applied_count || 0}`)
    logger.info(`Iteration: ${state.iteration}`)

    if (cohesionState.stage === 'complete') {
      logger.success('All stages complete!')
    } else {
      logger.info(
        'Run "pnpm cohesion:ralph workflow" again to continue, or "pnpm ralph:continue" to proceed',
      )
    }
  } catch (error) {
    logger.error(`Workflow error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    logger.info(`
Cohesion Engine - Ralph Integration

USAGE:
  pnpm cohesion:ralph [COMMAND]

COMMANDS:
  workflow              Run cohesion workflow as Ralph iteration
  status                Show current workflow status
  continue              Continue workflow to next stage
  complete              Mark workflow as complete

EXAMPLES:
  pnpm cohesion:ralph workflow
  pnpm cohesion:ralph status

This command integrates the cohesion engine with the Ralph iterative workflow system.
`)
    process.exit(0)
  }

  const command = args[0] || 'workflow'

  switch (command) {
    case 'workflow':
      await cohesionWorkflow()
      break
    case 'status':
      await showStatus()
      break
    default:
      logger.error(`Unknown command: ${command}`)
      logger.info('Run with --help for usage information')
      process.exit(1)
  }
}

/**
 * Show workflow status
 */
async function showStatus(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const { join } = await import('node:path')
  const cohesionStatePath = join(projectRoot, '.cursor/cohesion-ralph-state.json')

  if (!(await isWorkflowActive(projectRoot))) {
    logger.warning('No active Ralph workflow')
    return
  }

  const stateFile = await readStateFile(projectRoot)
  const state = stateFile.frontmatter

  // Load cohesion state
  let cohesionState: Partial<CohesionWorkflowState> = {}
  if (await fileExists(cohesionStatePath)) {
    try {
      const cohesionStateContent = await readFile(cohesionStatePath, 'utf-8')
      cohesionState = JSON.parse(cohesionStateContent)
    } catch {
      // Ignore parse errors
    }
  }

  logger.header('Cohesion Workflow Status')
  logger.info(`Stage: ${cohesionState.stage || 'analyze'}`)
  logger.info(`Iteration: ${state.iteration}`)
  logger.info(`Analysis Complete: ${cohesionState.analysis_complete ? '✅' : '❌'}`)
  logger.info(`Assessment Complete: ${cohesionState.assessment_complete ? '✅' : '❌'}`)
  logger.info(`Fixes Applied: ${cohesionState.fixes_applied ? '✅' : '❌'}`)

  if (cohesionState.last_grade) {
    logger.info(`Last Grade: ${cohesionState.last_grade}`)
  }
  if (cohesionState.issues_found !== undefined) {
    logger.info(`Issues Found: ${cohesionState.issues_found}`)
  }
  if (cohesionState.fixes_applied_count !== undefined) {
    logger.info(`Fixes Applied Count: ${cohesionState.fixes_applied_count}`)
  }
}

/**
 * Main function
 */
async function mainWrapper() {
  try {
    await main()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

mainWrapper()
