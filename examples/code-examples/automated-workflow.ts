#!/usr/bin/env tsx
/**
 * Automated Workflow Example
 *
 * Demonstrates how to create automated development workflows
 * by combining multiple CLI tools and commands.
 *
 * Workflows included:
 *   - pre-commit: Run before committing code
 *   - pre-push: Run before pushing to remote
 *   - pre-release: Run before creating a release
 *   - daily-maintenance: Run daily for code health
 *
 * Usage:
 *   tsx automated-workflow.ts <workflow-name>
 *
 * Examples:
 *   tsx automated-workflow.ts pre-commit
 *   tsx automated-workflow.ts pre-push
 *   tsx automated-workflow.ts pre-release
 *   tsx automated-workflow.ts daily-maintenance
 */

import { execSync } from 'node:child_process';

interface WorkflowStep {
  name: string;
  command: string;
  required: boolean;
  timeout?: number;
}

interface WorkflowResult {
  workflow: string;
  steps: StepResult[];
  success: boolean;
  duration: number;
}

interface StepResult {
  name: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

/**
 * Execute a shell command with timeout
 */
function executeCommand(
  command: string,
  timeout = 60000,
): { success: boolean; output: string; error?: string } {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      timeout,
      stdio: 'pipe',
    });
    return { success: true, output };
  } catch (error: unknown) {
    const err = error as { stdout?: string; message: string };
    return {
      success: false,
      output: err.stdout || '',
      error: err.message,
    };
  }
}

/**
 * Run a workflow step
 */
function runStep(step: WorkflowStep): StepResult {
  const startTime = Date.now();

  console.log(`\n⚡ ${step.name}...`);

  const result = executeCommand(step.command, step.timeout);
  const duration = Date.now() - startTime;

  if (result.success) {
    console.log(`   ✅ Completed in ${duration}ms`);
  } else {
    console.log(`   ❌ Failed in ${duration}ms`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  return {
    name: step.name,
    success: result.success,
    duration,
    output: result.output,
    error: result.error,
  };
}

/**
 * Run a complete workflow
 */
function runWorkflow(name: string, steps: WorkflowStep[]): WorkflowResult {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Running Workflow: ${name}`);
  console.log('='.repeat(60));

  const results: StepResult[] = [];

  for (const step of steps) {
    const result = runStep(step);
    results.push(result);

    // If step is required and failed, stop workflow
    if (step.required && !result.success) {
      console.log(`\n❌ Workflow failed at: ${step.name}`);
      break;
    }
  }

  const duration = Date.now() - startTime;
  const success = results.every((r) => r.success);

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Workflow Summary');
  console.log('='.repeat(60));
  console.log(`\nTotal Steps: ${results.length}/${steps.length}`);
  console.log(`Passed: ${results.filter((r) => r.success).length}`);
  console.log(`Failed: ${results.filter((r) => !r.success).length}`);
  console.log(`Duration: ${duration}ms\n`);

  if (success) {
    console.log('✅ Workflow completed successfully!\n');
  } else {
    console.log('❌ Workflow failed!\n');
    process.exit(1);
  }

  return {
    workflow: name,
    steps: results,
    success,
    duration,
  };
}

// ============================================================================
// Workflow Definitions
// ============================================================================

/**
 * Pre-commit workflow
 * Fast checks before committing code
 */
const PRE_COMMIT_WORKFLOW: WorkflowStep[] = [
  {
    name: 'Fix import extensions',
    command: 'pnpm maintain:fix-imports',
    required: false, // Nice to have
  },
  {
    name: 'Auto-fix linting errors',
    command: 'pnpm maintain:fix-lint',
    required: false, // Nice to have
  },
  {
    name: 'Validate package scripts',
    command: 'pnpm scripts:validate',
    required: true,
  },
  {
    name: 'Run linter',
    command: 'pnpm lint',
    required: true,
  },
  {
    name: 'Type checking',
    command: 'pnpm typecheck:all',
    required: true,
    timeout: 30000,
  },
];

/**
 * Pre-push workflow
 * More thorough checks before pushing
 */
const PRE_PUSH_WORKFLOW: WorkflowStep[] = [
  {
    name: 'Validate package scripts',
    command: 'pnpm scripts:validate --strict',
    required: true,
  },
  {
    name: 'Run linter',
    command: 'pnpm lint',
    required: true,
  },
  {
    name: 'Type checking',
    command: 'pnpm typecheck:all',
    required: true,
    timeout: 30000,
  },
  {
    name: 'Run all tests',
    command: 'pnpm test',
    required: true,
    timeout: 120000, // 2 minutes
  },
  {
    name: 'Build all packages',
    command: 'pnpm build',
    required: true,
    timeout: 180000, // 3 minutes
  },
];

/**
 * Pre-release workflow
 * Comprehensive checks before releasing
 */
const PRE_RELEASE_WORKFLOW: WorkflowStep[] = [
  {
    name: 'Clean everything',
    command: 'pnpm maintain:clean',
    required: true,
  },
  {
    name: 'Fresh install',
    command: 'pnpm install',
    required: true,
    timeout: 120000,
  },
  {
    name: 'Fix import extensions',
    command: 'pnpm maintain:fix-imports',
    required: false,
  },
  {
    name: 'Fix linting errors',
    command: 'pnpm maintain:fix-lint',
    required: false,
  },
  {
    name: 'Validate package scripts (strict)',
    command: 'pnpm scripts:validate --strict',
    required: true,
  },
  {
    name: 'Audit package scripts',
    command: 'pnpm scripts:audit',
    required: false,
  },
  {
    name: 'Run linter',
    command: 'pnpm lint',
    required: true,
  },
  {
    name: 'Type checking',
    command: 'pnpm typecheck:all',
    required: true,
    timeout: 30000,
  },
  {
    name: 'Run all tests',
    command: 'pnpm test',
    required: true,
    timeout: 120000,
  },
  {
    name: 'Run tests with coverage',
    command: 'pnpm test:coverage',
    required: false,
    timeout: 180000,
  },
  {
    name: 'Build all packages',
    command: 'pnpm build',
    required: true,
    timeout: 180000,
  },
  {
    name: 'Run integration tests',
    command: 'pnpm test:integration',
    required: false,
    timeout: 120000,
  },
];

/**
 * Daily maintenance workflow
 * Run regularly to keep codebase healthy
 */
const DAILY_MAINTENANCE_WORKFLOW: WorkflowStep[] = [
  {
    name: 'Check for updates',
    command: 'pnpm update --latest --recursive',
    required: false,
    timeout: 120000,
  },
  {
    name: 'Clean build artifacts',
    command: 'pnpm maintain:clean',
    required: true,
  },
  {
    name: 'Fix import extensions',
    command: 'pnpm maintain:fix-imports',
    required: false,
  },
  {
    name: 'Fix linting errors',
    command: 'pnpm maintain:fix-lint',
    required: false,
  },
  {
    name: 'Validate package scripts',
    command: 'pnpm scripts:validate',
    required: false,
  },
  {
    name: 'Health check',
    command: 'pnpm scripts:health',
    required: false,
  },
  {
    name: 'Analyze code quality',
    command: 'pnpm analyze:quality',
    required: false,
  },
  {
    name: 'Check for console statements',
    command: 'pnpm analyze:console',
    required: false,
  },
  {
    name: 'Type analysis',
    command: 'pnpm analyze:types',
    required: false,
  },
  {
    name: 'Fresh build',
    command: 'pnpm build',
    required: false,
    timeout: 180000,
  },
  {
    name: 'Run tests',
    command: 'pnpm test',
    required: false,
    timeout: 120000,
  },
];

// ============================================================================
// Main Execution
// ============================================================================

function main() {
  const workflowName = process.argv[2];

  if (!workflowName) {
    console.log('Usage: tsx automated-workflow.ts <workflow-name>\n');
    console.log('Available workflows:');
    console.log('  pre-commit         - Fast checks before committing');
    console.log('  pre-push           - Thorough checks before pushing');
    console.log('  pre-release        - Comprehensive checks before release');
    console.log('  daily-maintenance  - Regular code health maintenance\n');
    process.exit(1);
  }

  let workflow: WorkflowStep[];

  switch (workflowName) {
    case 'pre-commit':
      workflow = PRE_COMMIT_WORKFLOW;
      break;
    case 'pre-push':
      workflow = PRE_PUSH_WORKFLOW;
      break;
    case 'pre-release':
      workflow = PRE_RELEASE_WORKFLOW;
      break;
    case 'daily-maintenance':
      workflow = DAILY_MAINTENANCE_WORKFLOW;
      break;
    default:
      console.error(`❌ Unknown workflow: ${workflowName}`);
      process.exit(1);
  }

  runWorkflow(workflowName, workflow);
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for programmatic use
export { runStep, runWorkflow, type WorkflowResult, type WorkflowStep };
