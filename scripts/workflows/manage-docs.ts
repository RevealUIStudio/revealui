#!/usr/bin/env tsx
/**
 * Documentation Management Script
 *
 * Provides commands for managing documentation lifecycle:
 * - validate: Run comprehensive documentation validation
 * - organize: Reorganize docs into standard folders
 * - archive: Move stale files (>90 days) to archive
 * - plan: Planning phase of doc lifecycle
 * - create: Creation phase of doc lifecycle
 * - implement: Implementation phase of doc lifecycle
 * - reset: Reset phase of doc lifecycle (cleanup and archive)
 *
 * Usage:
 *   pnpm manage:docs validate
 *   pnpm manage:docs organize
 *   pnpm manage:docs archive [--days 90]
 *   pnpm manage:docs plan <topic>
 *   pnpm manage:docs create <topic>
 *   pnpm manage:docs implement <topic>
 *   pnpm manage:docs reset
 */

import { execSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/index.js';

const logger = createLogger({ prefix: 'DocManager' });

/**
 * Run comprehensive documentation validation
 */
async function validateDocs(): Promise<boolean> {
  logger.header('Documentation Validation');
  logger.info('Running comprehensive validation...');

  try {
    // Check if validator exists
    const validatorPath = 'scripts/validate/validate-docs-comprehensive.ts';
    if (!existsSync(validatorPath)) {
      logger.warning(`Validator not found: ${validatorPath}`);
      logger.info('Performing basic validation instead...');
      return await basicValidation();
    }

    // Run comprehensive validator
    const result = execSync(`tsx ${validatorPath}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    logger.info('Validation output:');
    console.log(result);

    logger.success('Documentation validation passed');
    return true;
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 0) {
      logger.success('Documentation validation passed');
      return true;
    }
    logger.error('Documentation validation failed');
    if (error instanceof Error && 'stdout' in error) {
      console.log(error.stdout);
    }
    return false;
  }
}

/**
 * Basic validation when comprehensive validator is not available
 */
async function basicValidation(): Promise<boolean> {
  logger.info('Running basic validation checks...');

  const checks = [
    {
      name: 'docs directory exists',
      check: () => existsSync('docs'),
    },
    {
      name: 'README.md exists',
      check: () => existsSync('README.md'),
    },
    {
      name: 'CHANGELOG.md exists',
      check: () => existsSync('CHANGELOG.md'),
    },
    {
      name: 'No broken symlinks in docs/',
      check: () => !hasBreakSymlinks('docs'),
    },
  ];

  let allPassed = true;
  for (const { name, check } of checks) {
    const passed = check();
    logger.info(`${passed ? '✅' : '❌'} ${name}`);
    if (!passed) allPassed = false;
  }

  return allPassed;
}

/**
 * Check for broken symlinks in a directory
 */
function hasBreakSymlinks(dir: string): boolean {
  if (!existsSync(dir)) return false;

  const files = readdirSync(dir, { recursive: true, withFileTypes: true });
  for (const file of files) {
    const fullPath = join(file.path, file.name);
    if (file.isSymbolicLink()) {
      try {
        lstatSync(fullPath);
      } catch {
        logger.warning(`Broken symlink: ${fullPath}`);
        return true;
      }
    }
  }
  return false;
}

/**
 * Organize documentation into standard folders
 */
async function organizeDocs(): Promise<void> {
  logger.header('Documentation Organization');
  logger.info('Reorganizing docs into standard folders...');

  // Define standard folder structure
  const folders = {
    'docs/api': 'API documentation',
    'docs/guides': 'User guides and tutorials',
    'docs/development': 'Development documentation',
    'docs/testing': 'Testing documentation',
    'docs/deployment': 'Deployment documentation',
    'docs/architecture': 'Architecture documentation',
    'docs/archive': 'Archived documentation',
    'docs/.drafts': 'Draft documentation (work in progress)',
  };

  // Ensure folders exist (recursive mkdirSync is a no-op if directory exists)
  for (const [folder, description] of Object.entries(folders)) {
    mkdirSync(folder, { recursive: true });
    logger.info(`✅ ${folder} - ${description}`);
  }

  // Create .gitkeep files in empty directories
  for (const folder of Object.keys(folders)) {
    const gitkeep = join(folder, '.gitkeep');
    const files = readdirSync(folder);
    if (files.length === 0) {
      try {
        writeFileSync(gitkeep, '# This file keeps the directory in git\n', { flag: 'wx' });
        logger.info(`Created .gitkeep in ${folder}`);
      } catch {
        // Already exists — ignore
      }
    }
  }

  logger.success('Documentation organization complete');
}

/**
 * Archive stale documentation files
 */
async function archiveDocs(daysOld = 90): Promise<void> {
  logger.header('Documentation Archival');
  logger.info(`Archiving files older than ${daysOld} days...`);

  const archiveDir = 'docs/archive';
  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
  }

  const docsDir = 'docs';
  const now = Date.now();
  const cutoff = now - daysOld * 24 * 60 * 60 * 1000;

  let archivedCount = 0;

  // Scan docs directory (excluding archive and .drafts)
  const files = readdirSync(docsDir, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (!file.isFile()) continue;

    const fullPath = join(file.path, file.name);
    const relativePath = relative(docsDir, fullPath);

    // Skip archive and drafts directories
    if (relativePath.startsWith('archive/') || relativePath.startsWith('.drafts/')) {
      continue;
    }

    // Skip .gitkeep files
    if (file.name === '.gitkeep') continue;

    // Check file age
    const stats = lstatSync(fullPath);
    if (stats.mtimeMs < cutoff) {
      const archivePath = join(archiveDir, relativePath);
      const archiveParent = join(archivePath, '..');

      // Create parent directory if needed (recursive: true is a no-op if it exists)
      mkdirSync(archiveParent, { recursive: true });

      logger.info(`Archiving: ${relativePath}`);
      renameSync(fullPath, archivePath);
      archivedCount++;
    }
  }

  if (archivedCount === 0) {
    logger.info('No files to archive');
  } else {
    logger.success(`Archived ${archivedCount} file(s)`);
  }
}

/**
 * Planning phase: Design documentation structure
 */
async function planDocs(topic: string): Promise<void> {
  logger.header('Documentation Planning Phase');
  logger.info(`Topic: ${topic}`);

  // Ensure drafts directory exists (recursive is a no-op if it exists)
  const draftsDir = 'docs/.drafts';
  mkdirSync(draftsDir, { recursive: true });

  // Create planning document
  const planFile = join(draftsDir, `${sanitizeFilename(topic)}-plan.md`);

  const planTemplate = `# Documentation Plan: ${topic}

**Created**: ${new Date().toISOString().split('T')[0]}
**Status**: Planning

## Objective

Describe what this documentation aims to achieve.

## Scope

### In Scope
- What will be covered

### Out of Scope
- What will not be covered

## Target Audience

Who is this documentation for?

## Document Structure

### Sections to Include
1. Section 1
   - Subsection 1.1
   - Subsection 1.2
2. Section 2
   - Subsection 2.1

## Content Outline

### Section 1: Title
- Key points to cover
- Examples to include
- Diagrams/visuals needed

### Section 2: Title
- Key points to cover

## Related Documentation

- Existing doc 1 that relates to this
- Existing doc 2 to reference

## Success Criteria

- [ ] Addresses all questions in scope
- [ ] Includes practical examples
- [ ] Easy to navigate
- [ ] Validated by stakeholders

## Review Checklist

- [ ] Technical accuracy
- [ ] Clear and concise writing
- [ ] Proper formatting
- [ ] Links work correctly
- [ ] Examples tested

---

**Next Step**: Fill out this plan, then proceed to Creation phase
`;

  writeFileSync(planFile, planTemplate);
  logger.success(`Plan created: ${planFile}`);
  logger.info('Fill out the plan before proceeding to Creation phase');
  logger.info(`Edit: ${planFile}`);
}

/**
 * Creation phase: Write documentation content
 */
async function createDocs(topic: string): Promise<void> {
  logger.header('Documentation Creation Phase');
  logger.info(`Topic: ${topic}`);

  const draftsDir = 'docs/.drafts';
  const planFile = join(draftsDir, `${sanitizeFilename(topic)}-plan.md`);
  const draftFile = join(draftsDir, `${sanitizeFilename(topic)}.md`);

  // Check if plan exists
  if (!existsSync(planFile)) {
    logger.warning(`Plan not found: ${planFile}`);
    logger.info('Run planning phase first');
    return;
  }

  // Create draft document from plan
  const docTemplate = `# ${topic}

**Status**: Draft
**Created**: ${new Date().toISOString().split('T')[0]}
**Last Updated**: ${new Date().toISOString().split('T')[0]}

---

## Overview

Brief overview of this document.

## Prerequisites

What readers need to know before reading this.

## Content

Main content goes here.

### Section 1

Content for section 1.

### Section 2

Content for section 2.

## Examples

Practical examples.

## Best Practices

Recommended practices.

## Common Issues

Common problems and solutions.

## Related Documentation

- [Related Doc 1](./path/to/doc1.md)
- [Related Doc 2](./path/to/doc2.md)

## References

External references if any.

---

**Next Step**: Fill out this document, then proceed to Implementation phase
`;

  try {
    writeFileSync(draftFile, docTemplate, { flag: 'wx' });
    logger.success(`Draft created: ${draftFile}`);
  } catch {
    logger.info(`Draft already exists: ${draftFile}`);
  }

  logger.info('Write the documentation content before proceeding to Implementation phase');
  logger.info(`Edit: ${draftFile}`);

  // Run validation on draft
  logger.info('Running validation on draft...');
  await validateDocs();
}

/**
 * Implementation phase: Move docs to final location
 */
async function implementDocs(topic: string): Promise<void> {
  logger.header('Documentation Implementation Phase');
  logger.info(`Topic: ${topic}`);

  const draftsDir = 'docs/.drafts';
  const draftFile = join(draftsDir, `${sanitizeFilename(topic)}.md`);

  // Check if draft exists
  if (!existsSync(draftFile)) {
    logger.error(`Draft not found: ${draftFile}`);
    logger.info('Run creation phase first');
    return;
  }

  // Determine target location based on content
  logger.info('Determining target location...');
  const targetDir = await determineTargetDirectory(draftFile);
  const targetFile = join(targetDir, `${sanitizeFilename(topic)}.md`);

  // Create target directory if needed (recursive is a no-op if it exists)
  mkdirSync(targetDir, { recursive: true });

  // Move draft to final location
  logger.info(`Moving draft to: ${targetFile}`);
  renameSync(draftFile, targetFile);

  // Clean up plan file (archive it if it exists)
  const planFile = join(draftsDir, `${sanitizeFilename(topic)}-plan.md`);
  try {
    const archivePlan = join('docs/archive', `${sanitizeFilename(topic)}-plan.md`);
    logger.info(`Archiving plan: ${archivePlan}`);
    renameSync(planFile, archivePlan);
  } catch {
    // Plan file doesn't exist — nothing to archive
  }

  logger.success(`Documentation implemented: ${targetFile}`);
  logger.info('Update CHANGELOG.md to document this addition');

  // Run validation
  logger.info('Running final validation...');
  await validateDocs();
}

/**
 * Determine target directory for documentation based on content
 */
async function determineTargetDirectory(draftFile: string): Promise<string> {
  const content = readFileSync(draftFile, 'utf8').toLowerCase();

  // Simple heuristic based on content keywords
  if (content.includes('api') || content.includes('endpoint')) {
    return 'docs/api';
  }
  if (content.includes('guide') || content.includes('tutorial') || content.includes('how to')) {
    return 'docs/guides';
  }
  if (content.includes('test') || content.includes('testing')) {
    return 'docs/testing';
  }
  if (content.includes('deploy') || content.includes('deployment')) {
    return 'docs/deployment';
  }
  if (content.includes('architecture') || content.includes('design')) {
    return 'docs/architecture';
  }
  if (content.includes('develop') || content.includes('development')) {
    return 'docs/development';
  }

  // Default to docs root
  return 'docs';
}

/**
 * Reset phase: Cleanup and archive stale docs
 */
async function resetDocs(): Promise<void> {
  logger.header('Documentation Reset Phase');
  logger.info('Cleaning up and archiving stale documentation...');

  // Archive old docs (>90 days)
  await archiveDocs(90);

  // Clean up empty .drafts
  const draftsDir = 'docs/.drafts';
  if (existsSync(draftsDir)) {
    const files = readdirSync(draftsDir).filter((f) => f !== '.gitkeep');
    if (files.length === 0) {
      logger.info('No drafts to clean up');
    } else {
      logger.info(`Found ${files.length} draft(s) in ${draftsDir}`);
      logger.warning('Review and handle remaining drafts manually');
    }
  }

  // Run final validation
  logger.info('Running final validation...');
  await validateDocs();

  logger.success('Reset phase complete');
  logger.info('Update CHANGELOG.md to document archival activities');
}

/**
 * Sanitize filename by removing special characters.
 * Replaces runs of non-alphanumeric characters with a single dash,
 * then trims leading/trailing dashes.
 */
function sanitizeFilename(name: string): string {
  const lower = name.toLowerCase();
  let result = '';
  let lastWasDash = false;

  for (let i = 0; i < lower.length; i++) {
    const c = lower.charCodeAt(i);
    const isAlphaNum =
      (c >= 48 && c <= 57) || // 0-9
      (c >= 97 && c <= 122); // a-z
    if (isAlphaNum) {
      result += lower[i];
      lastWasDash = false;
    } else if (!lastWasDash) {
      result += '-';
      lastWasDash = true;
    }
  }

  // Trim leading/trailing dashes
  let start = 0;
  let end = result.length;
  while (start < end && result[start] === '-') start++;
  while (end > start && result[end - 1] === '-') end--;
  return result.slice(start, end);
}

/**
 * Display help message
 */
function displayHelp(): void {
  console.log(`
Documentation Management Script
==============================

Commands:
  validate              Run comprehensive documentation validation
  organize              Reorganize docs into standard folders
  archive [--days N]    Archive files older than N days (default: 90)

Workflow Commands:
  plan <topic>          Planning phase - Design doc structure
  create <topic>        Creation phase - Write content in .drafts/
  implement <topic>     Implementation phase - Move to final location
  reset                 Reset phase - Archive stale docs and cleanup

Examples:
  pnpm manage:docs validate
  pnpm manage:docs organize
  pnpm manage:docs archive --days 60
  pnpm manage:docs plan "API Authentication Guide"
  pnpm manage:docs create "API Authentication Guide"
  pnpm manage:docs implement "API Authentication Guide"
  pnpm manage:docs reset

Workflow:
  1. plan <topic>       - Create planning document in docs/.drafts/
  2. create <topic>     - Create draft document from plan
  3. implement <topic>  - Move draft to appropriate docs/ subdirectory
  4. reset              - Archive old docs, cleanup
`);
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    displayHelp();
    return;
  }

  try {
    switch (command) {
      case 'validate':
        await validateDocs();
        break;

      case 'organize':
        await organizeDocs();
        break;

      case 'archive': {
        const daysIndex = args.indexOf('--days');
        const days = daysIndex >= 0 ? Number.parseInt(args[daysIndex + 1], 10) : 90;
        await archiveDocs(days);
        break;
      }

      case 'plan': {
        const topic = args.slice(1).join(' ');
        if (!topic) {
          logger.error('Topic required: pnpm manage:docs plan <topic>');
          process.exit(ErrorCode.EXECUTION_ERROR);
        }
        await planDocs(topic);
        break;
      }

      case 'create': {
        const topic = args.slice(1).join(' ');
        if (!topic) {
          logger.error('Topic required: pnpm manage:docs create <topic>');
          process.exit(ErrorCode.EXECUTION_ERROR);
        }
        await createDocs(topic);
        break;
      }

      case 'implement': {
        const topic = args.slice(1).join(' ');
        if (!topic) {
          logger.error('Topic required: pnpm manage:docs implement <topic>');
          process.exit(ErrorCode.EXECUTION_ERROR);
        }
        await implementDocs(topic);
        break;
      }

      case 'reset':
        await resetDocs();
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        displayHelp();
        process.exit(ErrorCode.EXECUTION_ERROR);
    }
  } catch (error) {
    logger.error('Command failed:', error);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Script failed:', error);
    process.exit(ErrorCode.EXECUTION_ERROR);
  });
}
