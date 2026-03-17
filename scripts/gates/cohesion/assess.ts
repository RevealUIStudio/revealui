#!/usr/bin/env tsx

/**
 * Cohesion Engine - Assessment Generation Command
 * Generates brutally honest assessment documents from analysis results
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/types.ts - Type definitions (CohesionAnalysis)
 * - scripts/utils/base.ts - Base utilities (createLogger, fileExists, getProjectRoot)
 * - scripts/utils/brutal-honesty.ts - Validation (enhanceWithBrutalHonesty, validateBrutalHonesty)
 * - scripts/utils/templates.ts - Template generation (generateAssessment)
 * - node:fs/promises - File system operations (readFile, writeFile via dynamic import)
 * - node:path - Path manipulation utilities (join, dynamic import)
 */

import { readFile } from 'node:fs/promises';
import { ErrorCode } from '@revealui/scripts/errors.js';
import type { CohesionAnalysis } from '../../types.ts';
import { createLogger, fileExists, getProjectRoot } from '../../utils/base.ts';
import { enhanceWithBrutalHonesty, validateBrutalHonesty } from '../../utils/brutal-honesty.ts';
import { generateAssessment } from '../../utils/templates.ts';

const logger = createLogger();

/**
 * Main function
 */
async function main() {
  try {
    const projectRoot = await getProjectRoot(import.meta.url);
    const { join } = await import('node:path');
    const analysisPath = join(projectRoot, '.cursor/cohesion-analysis.json');

    logger.header('Cohesion Engine - Assessment Generation');

    // Check if analysis exists
    if (!(await fileExists(analysisPath))) {
      logger.error(`Analysis file not found: ${analysisPath}`);
      logger.info('Run "pnpm cohesion:analyze" first to generate analysis');
      process.exit(ErrorCode.CONFIG_ERROR);
    }

    // Read analysis
    logger.info('Reading analysis results...');
    const analysisContent = await readFile(analysisPath, 'utf-8');
    const analysis: CohesionAnalysis = JSON.parse(analysisContent);

    logger.success(`Loaded analysis with ${analysis.issues.length} issues`);

    // Generate assessment
    logger.info('Generating assessment document...');
    let assessment = generateAssessment(analysis);

    // Validate and enhance with brutal honesty
    logger.info('Validating brutal honesty standards...');
    const validation = validateBrutalHonesty(assessment);

    if (!validation.valid) {
      logger.warning(`Brutal honesty score: ${validation.score}/100`);
      logger.warning(`Violations: ${validation.violations.length}`);

      // Enhance with brutal honesty
      const enhancement = enhanceWithBrutalHonesty(assessment);
      if (enhancement.changes.length > 0) {
        logger.info(`Enhancing assessment with brutal honesty...`);
        for (const change of enhancement.changes) {
          logger.info(`  - ${change}`);
        }
        assessment = enhancement.enhanced;

        // Re-validate
        const reValidation = validateBrutalHonesty(assessment);
        if (reValidation.valid) {
          logger.success('Assessment now meets brutal honesty standards');
        } else {
          logger.warning(
            `Assessment still needs improvement. Score: ${reValidation.score}/100. Suggestions:`,
          );
          for (const suggestion of reValidation.suggestions.slice(0, 3)) {
            logger.warning(`  - ${suggestion}`);
          }
        }
      }
    } else {
      logger.success(`Brutal honesty validation passed (${validation.score}/100)`);
    }

    // Write assessment
    const outputPath = join(projectRoot, 'DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outputPath, assessment);

    logger.success(`Assessment saved to: ${outputPath}`);
    logger.info(`Overall Grade: ${analysis.summary.overallGrade}`);
    logger.info(
      `Found ${analysis.summary.totalIssues} issues (${analysis.summary.criticalIssues} critical, ${analysis.summary.highIssues} high)`,
    );
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
