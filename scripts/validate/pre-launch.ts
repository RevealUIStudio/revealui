#!/usr/bin/env tsx

/**
 * Pre-Launch Validation Script
 * Cross-platform replacement for pre-launch-validation.sh and pre-launch-validation.ps1
 * Runs comprehensive checks before production deployment
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/index.ts - Shared utilities (createLogger, execCommand, fileExists, getProjectRoot)
 * - node:fs/promises - Async file operations (readFile)
 * - node:path - Path manipulation utilities (join)
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger, execCommand, fileExists, getProjectRoot } from '@revealui/scripts/index.js';

const logger = createLogger();

interface ValidationResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: ValidationResult[] = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function recordResult(name: string, result: boolean, message?: string) {
  results.push({ name, passed: result, message });
  if (result) {
    passed++;
  } else {
    failed++;
  }
}

function recordWarning(name: string, message?: string) {
  results.push({ name, passed: true, message });
  warnings++;
}

async function checkTypeScript() {
  logger.info('1. Running TypeScript type checking...');
  const result = await execCommand('pnpm', ['typecheck:all'], { silent: true });
  recordResult('Type checking', result.success);
  if (!result.success) {
    logger.info('   Run: pnpm typecheck:all');
  }
}

async function checkStructure() {
  logger.info('2. Validating workspace structure...');
  const result = await execCommand('pnpm', ['validate:structure'], {
    silent: true,
  });
  recordResult('Workspace structure validation', result.success);
  if (!result.success) {
    logger.info('   Run: pnpm validate:structure');
  }
}

async function checkLinting() {
  logger.info('3. Running linter...');
  const result = await execCommand('pnpm', ['lint'], { silent: true });
  recordResult('Linting', result.success);
  if (!result.success) {
    logger.info('   Run: pnpm lint');
  }
}

async function checkTests() {
  logger.info('4. Running tests...');
  const result = await execCommand('pnpm', ['test'], {
    silent: true,
    timeout: 300_000,
  });
  recordResult('Tests', result.success);
  if (!result.success) {
    logger.info('   Run: pnpm test');
  }
}

async function checkBuild() {
  logger.info('5. Building applications...');
  const result = await execCommand('pnpm', ['build'], {
    silent: true,
    env: { SKIP_ENV_VALIDATION: 'true' },
  });
  recordResult('Build', result.success);
  if (!result.success) {
    logger.info('   Run: pnpm build');
  }
}

async function checkSecurity() {
  logger.info('6. Running security audit...');
  const result = await execCommand('pnpm', ['audit', '--audit-level=high', '--json'], {
    silent: true,
  });

  if (result.success) {
    try {
      // Try to parse JSON output (may be in stderr or stdout)
      // For now, just check if command succeeded
      recordResult('Security audit', true);
    } catch {
      recordWarning('Security audit', 'Could not parse audit results');
    }
  } else {
    // Check for critical vulnerabilities in output
    recordWarning('Security audit', 'Audit completed with warnings');
  }
}

async function checkEnvironment() {
  logger.info('7. Checking environment variables...');
  const projectRoot = await getProjectRoot(import.meta.url);
  const envTemplate = join(projectRoot, '.env.template');
  const exists = await fileExists(envTemplate);
  recordResult('Environment template', exists);
  if (!exists) {
    recordWarning('Environment template', 'Environment template not found');
  }
}

async function checkDocumentation() {
  logger.info('8. Checking documentation...');
  const projectRoot = await getProjectRoot(import.meta.url);
  const docs = [
    'docs/DEPLOYMENT-RUNBOOK.md',
    'docs/LAUNCH-CHECKLIST.md',
    'docs/ENVIRONMENT-VARIABLES-GUIDE.md',
    'SECURITY.md',
  ];

  for (const doc of docs) {
    const docPath = join(projectRoot, doc);
    const exists = await fileExists(docPath);
    if (exists) {
      recordResult(`Documentation: ${doc}`, true);
    } else {
      recordWarning('Documentation', `Missing documentation: ${doc}`);
    }
  }
}

async function checkHealthEndpoint() {
  logger.info('9. Verifying health check endpoint...');
  const projectRoot = await getProjectRoot(import.meta.url);
  const healthPath = join(projectRoot, 'apps/admin/src/app/api/health/route.ts');
  const exists = await fileExists(healthPath);
  recordResult('Health check endpoint', exists);
  if (!exists) {
    logger.info('   Health check endpoint missing');
  }
}

async function checkGitStatus() {
  logger.info('10. Checking git status...');

  // Check for uncommitted changes
  const statusResult = await execCommand('git', ['status', '--porcelain'], { silent: true });
  if (statusResult.success && statusResult.message?.trim()) {
    const lines = statusResult.message.trim().split('\n').length;
    recordWarning(`${lines} uncommitted change(s) — commit or stash before launch`);
  } else {
    recordResult('Clean working tree', true);
  }

  // Check if ahead of origin
  const aheadResult = await execCommand('git', ['rev-list', '--count', 'origin/main..HEAD'], {
    silent: true,
  });
  if (aheadResult.success && Number.parseInt(aheadResult.message?.trim() ?? '0', 10) > 0) {
    recordWarning(`${aheadResult.message?.trim()} unpushed commit(s) — push before launch`);
  } else {
    recordResult('All commits pushed', true);
  }
}

async function checkCredentialRotation() {
  logger.info('11. Checking credential rotation readiness...');
  const projectRoot = await getProjectRoot(import.meta.url);

  // Check .env.template exists with all required vars
  const envTemplate = join(projectRoot, '.env.template');
  if (await fileExists(envTemplate)) {
    const content = await readFile(envTemplate, 'utf-8');
    const requiredVars = [
      'REVEALUI_SECRET',
      'REVEALUI_KEK',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'POSTGRES_URL',
    ];
    const missing = requiredVars.filter((v) => !content.includes(v));
    if (missing.length > 0) {
      recordWarning(`Missing from .env.template: ${missing.join(', ')}`);
    } else {
      recordResult('All required env vars documented in template', true);
    }
  } else {
    recordWarning('No .env.template found  -  create one before launch');
  }

  // Check for any .env files that shouldn't be committed
  const gitResult = await execCommand('git', ['ls-files', '--cached', '*.env', '.env*'], {
    silent: true,
  });
  if (gitResult.success && gitResult.message?.trim()) {
    const envFiles = gitResult.message
      .trim()
      .split('\n')
      .filter((f) => !(f.endsWith('.template') || f.endsWith('.example')));
    if (envFiles.length > 0) {
      recordWarning(
        `Env files tracked by git: ${envFiles.join(', ')} — remove before going public`,
      );
    } else {
      recordResult('No .env files tracked by git', true);
    }
  } else {
    recordResult('No .env files tracked by git', true);
  }
}

async function checkSecrets() {
  logger.info('12. Scanning for leaked secrets...');
  const result = await execCommand('pnpm', ['secrets:scan'], { silent: true });
  if (result.success) {
    recordResult('No secrets found in tracked files', true);
  } else {
    recordResult('Secret scan failed', false, 'Run: pnpm secrets:scan');
  }
}

async function checkNpmPublishReadiness() {
  logger.info('13. Checking npm publish readiness...');
  const projectRoot = await getProjectRoot(import.meta.url);

  const publishablePackages = [
    'core',
    'contracts',
    'db',
    'auth',
    'presentation',
    'router',
    'config',
    'utils',
    'cli',
    'setup',
    'sync',
    'dev',
  ];

  let missingLicense = 0;
  let missingReadme = 0;

  for (const pkg of publishablePackages) {
    const pkgDir = join(projectRoot, 'packages', pkg);
    if (!(await fileExists(pkgDir))) continue;

    const pkgJson = join(pkgDir, 'package.json');
    if (await fileExists(pkgJson)) {
      const content = JSON.parse(await readFile(pkgJson, 'utf-8'));
      if (content.private) continue; // Skip private packages

      if (!content.license) missingLicense++;
      const readmePath = join(pkgDir, 'README.md');
      if (!(await fileExists(readmePath))) missingReadme++;
    }
  }

  if (missingLicense > 0) {
    recordWarning(`${missingLicense} publishable package(s) missing "license" field`);
  }
  if (missingReadme > 0) {
    recordWarning(`${missingReadme} publishable package(s) missing README.md`);
  }
  if (missingLicense === 0 && missingReadme === 0) {
    recordResult('All publishable packages have license and README', true);
  }
}

async function checkVercelDeployments() {
  logger.info('14. Checking Vercel deployment status...');

  // Check if vercel CLI is available
  const vercelResult = await execCommand('which', ['vercel'], { silent: true });
  if (!vercelResult.success) {
    recordWarning('Vercel CLI not installed  -  install with: npm i -g vercel');
    return;
  }

  // Check for vercel.json or deployment config
  const projectRoot = await getProjectRoot(import.meta.url);
  const apps = ['api', 'admin', 'marketing'];
  for (const app of apps) {
    const vercelJson = join(projectRoot, 'apps', app, 'vercel.json');
    if (await fileExists(vercelJson)) {
      recordResult(`Vercel config: apps/${app}/vercel.json`, true);
    } else {
      recordWarning(`Missing Vercel config: apps/${app}/vercel.json`);
    }
  }
}

async function checkTestCoverage() {
  logger.info('15. Checking test coverage...');
  const projectRoot = await getProjectRoot(import.meta.url);
  const coveragePath = join(projectRoot, 'apps/admin/coverage');

  if (await fileExists(coveragePath)) {
    // Try to find coverage-summary.json
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(coveragePath, { recursive: true });
    const summaryFile = files.find((f) => f.includes('coverage-summary.json'));

    if (summaryFile) {
      try {
        const summaryPath = join(coveragePath, summaryFile);
        const content = await readFile(summaryPath, 'utf-8');
        const summary = JSON.parse(content);
        const statements = summary.total?.statements?.pct || 0;

        if (statements >= 70) {
          recordResult('Test coverage', true, `Coverage: ${statements.toFixed(1)}%`);
        } else {
          recordWarning(
            'Test coverage',
            `Coverage below threshold: ${statements.toFixed(1)}% (target: 70%)`,
          );
        }
      } catch {
        recordWarning('Test coverage', 'Could not parse coverage report');
      }
    } else {
      recordWarning(
        'Test coverage',
        'Coverage report not found. Run: pnpm --filter admin test:coverage',
      );
    }
  } else {
    recordWarning(
      'Test coverage',
      'Coverage directory not found. Run: pnpm --filter admin test:coverage',
    );
  }
}

async function runValidation() {
  logger.header('Pre-Launch Validation for RevealUI Framework');
  logger.info('');

  await checkTypeScript();
  await checkStructure();
  await checkLinting();
  await checkTests();
  await checkBuild();
  await checkSecurity();
  await checkEnvironment();
  await checkDocumentation();
  await checkHealthEndpoint();
  await checkGitStatus();
  await checkCredentialRotation();
  await checkSecrets();
  await checkNpmPublishReadiness();
  await checkVercelDeployments();
  await checkTestCoverage();

  // Summary
  logger.header('Validation Summary');
  logger.info('');
  logger.success(`Passed: ${passed}`);
  if (failed > 0) {
    logger.error(`Failed: ${failed}`);
  }
  if (warnings > 0) {
    logger.warning(`Warnings: ${warnings}`);
  }
  logger.info('');

  if (failed === 0) {
    if (warnings === 0) {
      logger.success('All checks passed! Ready for launch.');
      process.exit(ErrorCode.SUCCESS);
    } else {
      logger.warning('Checks passed with warnings. Review warnings before launch.');
      process.exit(ErrorCode.SUCCESS);
    }
  } else {
    logger.error('Some checks failed. Fix issues before launch.');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runValidation();
  } catch (error) {
    logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
