#!/usr/bin/env tsx

/**
 * Cohesion Engine - Rev Integration
 * Integrates cohesion engine with Rev loop workflow system
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode and ScriptError for error handling
 * - scripts/types.ts - Type definitions (RevState)
 * - scripts/utils/base.ts - Base utilities (createLogger, fileExists, getProjectRoot)
 * - scripts/utils/brutal-honesty.ts - Validation (validateBrutalHonesty)
 * - scripts/utils/orchestration.ts - Workflow orchestration (checkCompletion, isWorkflowActive, readStateFile)
 * - node:fs/promises - File system operations (readFile, writeFile)
 * - node:path - Path manipulation utilities (join, dynamic import)
 * - node:child_process - Command execution (exec, dynamic import)
 * - node:util - Utilities (promisify, dynamic import)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { ErrorCode, ScriptError } from '@revealui/scripts/errors.js';
import type { RevState } from '../../types.ts';
import { createLogger, fileExists, getProjectRoot } from '../../utils/base.ts';
import { validateBrutalHonesty } from '../../utils/brutal-honesty.ts';
import { checkCompletion, isWorkflowActive, readStateFile } from '../../utils/orchestration.ts';

const logger = createLogger();

/**
 * Cohesion workflow stages
 */
type CohesionStage = 'analyze' | 'assess' | 'fix' | 'complete';

interface CohesionWorkflowState extends RevState {
  stage: CohesionStage;
  analysis_complete: boolean;
  assessment_complete: boolean;
  fixes_applied: boolean;
  last_grade?: string;
  issues_found?: number;
  fixes_applied_count?: number;
}

/**
 * Run cohesion analysis
 */
async function runAnalysis(): Promise<{ grade: string; issuesFound: number }> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  logger.info('Running cohesion analysis...');
  const { stderr } = await execAsync('pnpm cohesion:analyze', {
    cwd: process.cwd(),
  });

  if (stderr && !stderr.includes('✅')) {
    // Check if it's just a warning
    const errorLines = stderr.split('\n').filter((line) => line.includes('❌'));
    if (errorLines.length > 0) {
      throw new ScriptError(`Analysis failed: ${stderr}`, ErrorCode.EXECUTION_ERROR);
    }
  }

  // Read analysis results
  const projectRoot = await getProjectRoot(import.meta.url);
  const { join } = await import('node:path');
  const analysisPath = join(projectRoot, '.cursor/cohesion-analysis.json');

  if (!(await fileExists(analysisPath))) {
    throw new ScriptError('Analysis file not found', ErrorCode.NOT_FOUND);
  }

  const analysisContent = await readFile(analysisPath, 'utf-8');
  const analysis = JSON.parse(analysisContent);

  logger.success(
    `Analysis complete: ${analysis.summary.totalIssues} issues, Grade: ${analysis.summary.overallGrade}`,
  );

  return {
    grade: analysis.summary.overallGrade,
    issuesFound: analysis.summary.totalIssues,
  };
}

/**
 * Run assessment generation
 */
async function runAssessment(): Promise<void> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  logger.info('Generating assessment document...');
  const { stderr } = await execAsync('pnpm cohesion:assess', {
    cwd: process.cwd(),
  });

  if (stderr && !stderr.includes('✅')) {
    const errorLines = stderr.split('\n').filter((line) => line.includes('❌'));
    if (errorLines.length > 0) {
      throw new ScriptError(`Assessment generation failed: ${stderr}`, ErrorCode.EXECUTION_ERROR);
    }
  }

  logger.success('Assessment generated');
}

/**
 * Run automated fixes (dry-run by default)
 */
async function runFixes(dryRun = true): Promise<{ fixesApplied: number }> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  const command = dryRun ? 'pnpm cohesion:fix --dry-run' : 'pnpm cohesion:fix';

  logger.info(`Running fixes${dryRun ? ' (DRY RUN)' : ''}...`);
  const { stdout, stderr } = await execAsync(command, {
    cwd: process.cwd(),
  });

  if (stderr && !stderr.includes('✅')) {
    const errorLines = stderr.split('\n').filter((line) => line.includes('❌'));
    if (errorLines.length > 0) {
      throw new ScriptError(`Fix execution failed: ${stderr}`, ErrorCode.EXECUTION_ERROR);
    }
  }

  // Parse output to count fixes
  const output = stdout || '';
  let fixesApplied = 0;
  const fixedPrefix = 'Fixed:';
  const fixedIdx = output.indexOf(fixedPrefix);
  if (fixedIdx !== -1) {
    const afterFixed = output.substring(fixedIdx + fixedPrefix.length).trimStart();
    // Extract leading digits
    let numStr = '';
    for (const ch of afterFixed) {
      if (ch >= '0' && ch <= '9') {
        numStr += ch;
      } else {
        break;
      }
    }
    if (numStr.length > 0) {
      fixesApplied = Number.parseInt(numStr, 10);
    }
  }

  logger.success(`Fixes${dryRun ? ' would be' : ''} applied: ${fixesApplied}`);

  return { fixesApplied };
}

/**
 * Main cohesion workflow
 */
async function cohesionWorkflow(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url);

  // Check if Rev workflow is active
  if (!(await isWorkflowActive(projectRoot))) {
    logger.error('No active Rev workflow found');
    logger.info('Run "pnpm rev:start" first to begin a workflow');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  // Read state
  const stateFile = await readStateFile(projectRoot);
  const state = stateFile.frontmatter;

  // Load cohesion workflow state
  const { join } = await import('node:path');
  const cohesionStatePath = join(projectRoot, '.cursor/cohesion-rev-state.json');
  let cohesionState: Partial<CohesionWorkflowState> = {};

  if (await fileExists(cohesionStatePath)) {
    try {
      const cohesionStateContent = await readFile(cohesionStatePath, 'utf-8');
      cohesionState = JSON.parse(cohesionStateContent);
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  logger.header(`Cohesion Engine - Rev Workflow (Iteration ${state.iteration})`);

  try {
    // Stage 1: Analyze
    if (!cohesionState.analysis_complete) {
      logger.info('Stage: Analysis');
      const { grade, issuesFound } = await runAnalysis();

      cohesionState.analysis_complete = true;
      cohesionState.last_grade = grade;
      cohesionState.issues_found = issuesFound;
      cohesionState.stage = 'assess';

      await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2));
      logger.success('Analysis stage complete');
    }

    // Stage 2: Assess
    if (cohesionState.analysis_complete && !cohesionState.assessment_complete) {
      logger.info('Stage: Assessment');
      await runAssessment();

      // Validate brutal honesty
      logger.info('Validating brutal honesty...');
      const { join } = await import('node:path');
      const assessmentPath = join(projectRoot, 'DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md');
      if (await fileExists(assessmentPath)) {
        const assessmentContent = await readFile(assessmentPath, 'utf-8');
        const validation = validateBrutalHonesty(assessmentContent);
        if (validation.valid) {
          logger.success(`Brutal honesty validation passed (${validation.score}/100)`);
        } else {
          logger.warning(`Brutal honesty validation failed (${validation.score}/100)`);
          logger.warning(`Violations: ${validation.violations.length}`);
          for (const violation of validation.violations.slice(0, 3)) {
            logger.warning(`  - ${violation}`);
          }
        }
      }

      cohesionState.assessment_complete = true;
      cohesionState.stage = 'fix';

      await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2));
      logger.success('Assessment stage complete');
    }

    // Stage 3: Fix (dry-run first)
    if (cohesionState.assessment_complete && !cohesionState.fixes_applied) {
      logger.info('Stage: Fixes (Dry Run)');
      const { fixesApplied } = await runFixes(true);

      if (fixesApplied > 0) {
        logger.warning(`Found ${fixesApplied} fixable issues`);
        logger.info('Review the dry-run output above');
        logger.info('To apply fixes, run: pnpm cohesion:fix');
        logger.info('Or continue with Rev workflow after manual review');
      } else {
        cohesionState.fixes_applied = true;
        cohesionState.fixes_applied_count = 0;
        cohesionState.stage = 'complete';
        await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2));
      }
    }

    // Check completion
    if (state.completion_promise) {
      const completed = await checkCompletion(projectRoot, state.completion_promise);
      if (completed) {
        logger.success('Workflow completed!');
        cohesionState.stage = 'complete';
        await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2));
        process.exit(ErrorCode.SUCCESS);
      }
    }

    // Save state
    await writeFile(cohesionStatePath, JSON.stringify(cohesionState, null, 2));

    // Summary
    logger.header('Workflow Status');
    logger.info(`Stage: ${cohesionState.stage || 'analyze'}`);
    logger.info(`Grade: ${cohesionState.last_grade || 'N/A'}`);
    logger.info(`Issues Found: ${cohesionState.issues_found || 0}`);
    logger.info(`Fixes Applied: ${cohesionState.fixes_applied_count || 0}`);
    logger.info(`Iteration: ${state.iteration}`);

    if (cohesionState.stage === 'complete') {
      logger.success('All stages complete!');
    } else {
      logger.info(
        'Run "pnpm cohesion:rev workflow" again to continue, or "pnpm rev:continue" to proceed',
      );
    }
  } catch (error) {
    logger.error(`Workflow error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    logger.info(`
Cohesion Engine - Rev Integration

USAGE:
  pnpm cohesion:rev [COMMAND]

COMMANDS:
  workflow              Run cohesion workflow as Rev iteration
  status                Show current workflow status
  continue              Continue workflow to next stage
  complete              Mark workflow as complete

EXAMPLES:
  pnpm cohesion:rev workflow
  pnpm cohesion:rev status

This command integrates the cohesion engine with the Rev loop workflow system.
`);
    process.exit(ErrorCode.SUCCESS);
  }

  const command = args[0] || 'workflow';

  switch (command) {
    case 'workflow':
      await cohesionWorkflow();
      break;
    case 'status':
      await showStatus();
      break;
    default:
      logger.error(`Unknown command: ${command}`);
      logger.info('Run with --help for usage information');
      process.exit(ErrorCode.CONFIG_ERROR);
  }
}

/**
 * Show workflow status
 */
async function showStatus(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url);
  const { join } = await import('node:path');
  const cohesionStatePath = join(projectRoot, '.cursor/cohesion-rev-state.json');

  if (!(await isWorkflowActive(projectRoot))) {
    logger.warning('No active Rev workflow');
    return;
  }

  const stateFile = await readStateFile(projectRoot);
  const state = stateFile.frontmatter;

  // Load cohesion state
  let cohesionState: Partial<CohesionWorkflowState> = {};
  if (await fileExists(cohesionStatePath)) {
    try {
      const cohesionStateContent = await readFile(cohesionStatePath, 'utf-8');
      cohesionState = JSON.parse(cohesionStateContent);
    } catch {
      // Ignore parse errors
    }
  }

  logger.header('Cohesion Workflow Status');
  logger.info(`Stage: ${cohesionState.stage || 'analyze'}`);
  logger.info(`Iteration: ${state.iteration}`);
  logger.info(`Analysis Complete: ${cohesionState.analysis_complete ? '✅' : '❌'}`);
  logger.info(`Assessment Complete: ${cohesionState.assessment_complete ? '✅' : '❌'}`);
  logger.info(`Fixes Applied: ${cohesionState.fixes_applied ? '✅' : '❌'}`);

  if (cohesionState.last_grade) {
    logger.info(`Last Grade: ${cohesionState.last_grade}`);
  }
  if (cohesionState.issues_found !== undefined) {
    logger.info(`Issues Found: ${cohesionState.issues_found}`);
  }
  if (cohesionState.fixes_applied_count !== undefined) {
    logger.info(`Fixes Applied Count: ${cohesionState.fixes_applied_count}`);
  }
}

/**
 * Main function
 */
async function mainWrapper() {
  try {
    await main();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

mainWrapper();
