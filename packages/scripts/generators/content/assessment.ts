/**
 * Documentation Assessment
 *
 * Performs documentation quality assessment including:
 * - Missing documentation detection
 * - Broken link checking
 * - API documentation coverage
 * - JSDoc coverage analysis
 *
 * Extracted from generate-content.ts for better modularity.
 *
 * @dependencies
 * - node:fs/promises - File system operations (mkdir, readFile, readdir, writeFile)
 * - node:path - Path utilities (dirname, join, relative)
 * - scripts/lib/index.js - Logger, file utilities, project root, directory scanning
 *
 * @example
 * ```typescript
 * import { runAssessmentWorkflow } from './assessment.js'
 *
 * const assessment = await runAssessmentWorkflow()
 * console.log(`Overall score: ${assessment.overall}`)
 * ```
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createLogger, fileExists, getProjectRoot, scanDirectoryAll } from '../../index.js';

const logger = createLogger({ prefix: 'Assessment' });

// =============================================================================
// Types
// =============================================================================

export interface AssessmentResult {
  category: string;
  score: number;
  issues: string[];
  recommendations: string[];
}

export interface DocumentationAssessment {
  overall: number | null;
  results: AssessmentResult[];
  missingDocs: string[];
  brokenLinks: string[];
  timestamp: Date;
  disclaimer: string;
  requiresHumanReview: boolean;
  reviewDate: string | null;
  reviewedBy: string | null;
}

// =============================================================================
// Main Workflow
// =============================================================================

/**
 * Run complete documentation assessment workflow
 *
 * @param options - Assessment options
 * @returns Documentation assessment
 *
 * @example
 * ```typescript
 * const assessment = await runAssessmentWorkflow()
 * ```
 */
export async function runAssessmentWorkflow(
  options: { projectRoot?: string; outputPath?: string } = {},
): Promise<DocumentationAssessment> {
  logger.header('Running Documentation Assessment Workflow');

  const projectRoot = options.projectRoot || (await getProjectRoot(import.meta.url));
  const outputPath = options.outputPath || join(projectRoot, 'docs', 'assessment-report.json');

  const assessment: DocumentationAssessment = {
    overall: null,
    results: [],
    missingDocs: [],
    brokenLinks: [],
    timestamp: new Date(),
    disclaimer: '⚠️ AUTOMATED ANALYSIS ONLY - NOT VERIFIED BY HUMANS',
    requiresHumanReview: true,
    reviewDate: null,
    reviewedBy: null,
  };

  // 1. Check for missing documentation
  logger.info('Checking for missing documentation...');
  const missingDocs = await checkMissingDocs(projectRoot);
  assessment.missingDocs = missingDocs;

  if (missingDocs.length > 0) {
    assessment.results.push({
      category: 'Missing Documentation',
      score: Math.max(0, 100 - missingDocs.length * 10),
      issues: missingDocs.map((f) => `Missing README: ${f}`),
      recommendations: ['Add README.md files to undocumented packages'],
    });
    logger.warn(`Found ${missingDocs.length} packages without README`);
  } else {
    assessment.results.push({
      category: 'Missing Documentation',
      score: 100,
      issues: [],
      recommendations: [],
    });
    logger.success('All packages have README files');
  }

  // 2. Check link validity
  logger.info('Checking documentation links...');
  const brokenLinks = await checkBrokenLinks(projectRoot);
  assessment.brokenLinks = brokenLinks;

  if (brokenLinks.length > 0) {
    assessment.results.push({
      category: 'Link Validation',
      score: Math.max(0, 100 - brokenLinks.length * 5),
      issues: brokenLinks.map((l) => `Broken link: ${l}`),
      recommendations: ['Fix or remove broken links in documentation'],
    });
    logger.warn(`Found ${brokenLinks.length} broken links`);
  } else {
    assessment.results.push({
      category: 'Link Validation',
      score: 100,
      issues: [],
      recommendations: [],
    });
    logger.success('All documentation links are valid');
  }

  // 3. Check API documentation coverage
  logger.info('Checking API documentation coverage...');
  const apiCoverage = await checkAPICoverage(projectRoot);
  assessment.results.push(apiCoverage);

  if (apiCoverage.score < 100) {
    logger.warn(`API documentation coverage: ${apiCoverage.score}%`);
  } else {
    logger.success('API documentation coverage: 100%');
  }

  // 4. Check JSDoc coverage
  logger.info('Checking JSDoc coverage...');
  const jsdocCoverage = await checkJSDocCoverage(projectRoot);
  assessment.results.push(jsdocCoverage);

  if (jsdocCoverage.score < 80) {
    logger.warn(`JSDoc coverage: ${jsdocCoverage.score}%`);
  } else {
    logger.success(`JSDoc coverage: ${jsdocCoverage.score}%`);
  }

  // Save assessment report
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(assessment, null, 2));

  // Print summary
  printAssessmentSummary(assessment, outputPath);

  return assessment;
}

// =============================================================================
// Check Functions
// =============================================================================

/**
 * Check for missing README files in packages
 *
 * @param projectRoot - Project root path
 * @returns Array of package names without READMEs
 */
export async function checkMissingDocs(projectRoot: string): Promise<string[]> {
  const packagesDir = join(projectRoot, 'packages');
  const missing: string[] = [];

  try {
    const entries = await readdir(packagesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const readmePath = join(packagesDir, entry.name, 'README.md');
        if (!(await fileExists(readmePath))) {
          missing.push(entry.name);
        }
      }
    }
  } catch {
    // Packages dir doesn't exist
  }

  return missing;
}

/**
 * Check for broken links in markdown files
 *
 * @param projectRoot - Project root path
 * @returns Array of broken link descriptions
 */
export async function checkBrokenLinks(projectRoot: string): Promise<string[]> {
  const docsDir = join(projectRoot, 'docs');
  const brokenLinks: string[] = [];

  try {
    const files = await scanDirectoryAll(docsDir, {
      extensions: ['.md'],
    });

    for (const fullPath of files) {
      const content = await readFile(fullPath, 'utf-8');

      // Find markdown links: [text](path)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match = linkRegex.exec(content);

      while (match !== null) {
        const linkPath = match[2];

        // Check relative links (skip external URLs and anchors)
        if (!(linkPath.startsWith('http') || linkPath.startsWith('#'))) {
          const absolutePath = join(dirname(fullPath), linkPath.split('#')[0]);
          if (!(await fileExists(absolutePath))) {
            brokenLinks.push(`${relative(projectRoot, fullPath)}: ${linkPath}`);
          }
        }
        match = linkRegex.exec(content);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return brokenLinks;
}

/**
 * Check API documentation coverage
 *
 * @param projectRoot - Project root path
 * @returns Assessment result
 */
export async function checkAPICoverage(projectRoot: string): Promise<AssessmentResult> {
  const apiDir = join(projectRoot, 'apps', 'admin', 'src', 'app', 'api');
  let totalEndpoints = 0;
  let documentedEndpoints = 0;
  const undocumented: string[] = [];

  async function scan(dir: string, currentPath = ''): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath, `${currentPath}/${entry.name}`);
        } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
          const content = await readFile(fullPath, 'utf-8');
          const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

          for (const method of methods) {
            if (
              content.includes(`export async function ${method}`) ||
              content.includes(`export function ${method}`)
            ) {
              totalEndpoints++;

              // Check for JSDoc before the function
              const hasJSDoc =
                content.includes(`/**`) &&
                content.indexOf('/**') < content.indexOf(`function ${method}`);

              if (hasJSDoc) {
                documentedEndpoints++;
              } else {
                undocumented.push(`${method} ${currentPath}`);
              }
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  await scan(apiDir);

  const score = totalEndpoints > 0 ? Math.round((documentedEndpoints / totalEndpoints) * 100) : 100;

  return {
    category: 'API Documentation Coverage',
    score,
    issues: undocumented.map((e) => `Undocumented endpoint: ${e}`),
    recommendations: undocumented.length > 0 ? ['Add JSDoc comments to API route handlers'] : [],
  };
}

/**
 * Check JSDoc coverage in packages
 *
 * @param projectRoot - Project root path
 * @returns Assessment result
 */
export async function checkJSDocCoverage(projectRoot: string): Promise<AssessmentResult> {
  const packagesDir = join(projectRoot, 'packages');
  let totalExports = 0;
  let documentedExports = 0;
  const undocumented: string[] = [];

  async function scanPackage(pkgDir: string, pkgName: string): Promise<void> {
    const srcDir = join(pkgDir, 'src');

    try {
      const files = await scanDirectoryAll(srcDir, {
        extensions: ['.ts'],
        excludeDirs: ['__tests__', 'test', 'tests'],
        excludePatterns: [/\.test\.ts$/],
      });

      for (const fullPath of files) {
        const content = await readFile(fullPath, 'utf-8');

        // Count exported functions/classes
        const exportMatches = content.match(
          /export\s+(async\s+)?function\s+\w+|export\s+class\s+\w+/g,
        );
        if (exportMatches) {
          for (const match of exportMatches) {
            totalExports++;

            // Check for JSDoc before export
            const exportIndex = content.indexOf(match);
            const precedingContent = content.substring(Math.max(0, exportIndex - 500), exportIndex);

            if (precedingContent.includes('/**')) {
              documentedExports++;
            } else {
              const fileName = relative(pkgDir, fullPath);
              undocumented.push(`${pkgName}/${fileName}`);
            }
          }
        }
      }
    } catch {
      // Package doesn't have src directory
    }
  }

  try {
    const entries = await readdir(packagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await scanPackage(join(packagesDir, entry.name), entry.name);
      }
    }
  } catch {
    // Packages dir doesn't exist
  }

  const score = totalExports > 0 ? Math.round((documentedExports / totalExports) * 100) : 100;

  return {
    category: 'JSDoc Coverage',
    score,
    issues: undocumented.slice(0, 10).map((f) => `Undocumented export in ${f}`),
    recommendations:
      undocumented.length > 0
        ? [
            'Add JSDoc comments to exported functions and classes',
            `${totalExports - documentedExports} exports need documentation`,
          ]
        : [],
  };
}

// =============================================================================
// Output Utilities
// =============================================================================

/**
 * Print assessment summary to console
 *
 * @param assessment - Assessment results
 * @param outputPath - Path where report was saved
 */
export function printAssessmentSummary(
  assessment: DocumentationAssessment,
  outputPath: string,
): void {
  logger.divider();
  logger.header('Assessment Summary');
  logger.warn('⚠️ AUTOMATED ANALYSIS ONLY - NOT VERIFIED BY HUMANS');
  logger.divider();

  for (const result of assessment.results) {
    const icon = result.score >= 80 ? '[OK]' : result.score >= 50 ? '[WARN]' : '[ERROR]';
    logger.info(`${icon} ${result.category}: ${result.score}%`);
    for (const issue of result.issues.slice(0, 3)) {
      logger.info(`    - ${issue}`);
    }
    if (result.issues.length > 3) {
      logger.info(`    ... and ${result.issues.length - 3} more`);
    }
  }

  logger.divider();
  logger.warn('Overall score not calculated - requires human review');
  logger.info(`Report saved to: ${outputPath}`);
  logger.info('');
  logger.info('Required before claiming success:');
  logger.info('  - [ ] Manual code review completed');
  logger.info('  - [ ] Manual testing performed');
  logger.info('  - [ ] Stakeholder sign-off obtained');
}
