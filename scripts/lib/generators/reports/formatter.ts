/**
 * Report Formatter Module
 *
 * Formats and displays coverage reports.
 * Extracted from coverage-report.ts for better modularity.
 *
 * @dependencies
 * - node:fs - Synchronous file operations (writeFileSync)
 * - node:path - Path utilities (join)
 * - scripts/lib/generators/reports/coverage.js - Coverage statistics types
 *
 * @example
 * ```typescript
 * import { displayReport, generateMarkdown } from './formatter.js'
 *
 * displayReport(stats)
 * const md = generateMarkdown(stats)
 * ```
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoverageStats } from './coverage.js';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate percentage
 *
 * @param value - Numerator
 * @param total - Denominator
 * @returns Percentage rounded to nearest integer
 */
export function calcPercent(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

// =============================================================================
// Console Display
// =============================================================================

/**
 * Display coverage report to console
 *
 * @param stats - Coverage statistics
 *
 * @example
 * ```typescript
 * displayReport(stats)
 * ```
 */
export function displayReport(stats: CoverageStats): void {
  console.log('\n📊 Type Coverage Report\n');
  console.log('='.repeat(70));

  // Generated contracts
  console.log('\n📦 Generated Contracts:');
  console.log(`  Tables:      ${stats.generated.tables}`);
  console.log(`  Schemas:     ${stats.generated.totalSchemas}`);
  console.log(`  Contracts:   ${stats.generated.totalContracts}`);

  // Usage statistics
  console.log('\n📈 Usage Across Codebase:');
  console.log(`  Total files analyzed:       ${stats.usage.totalFiles}`);
  console.log(
    `  Files importing contracts:  ${stats.usage.contractImports} (${calcPercent(stats.usage.contractImports, stats.usage.totalFiles)}%)`,
  );
  console.log(
    `  Files importing schemas:    ${stats.usage.schemaImports} (${calcPercent(stats.usage.schemaImports, stats.usage.totalFiles)}%)`,
  );
  console.log(`  Direct DB imports:          ${stats.usage.directDbImports}`);

  // Validation usage
  console.log('\n✅ Validation Coverage:');
  console.log(`  Using .validate():  ${stats.validation.filesUsingValidation} files`);
  console.log(`  Using .isType():    ${stats.validation.filesUsingTypeGuards} files`);
  console.log(`  Using .parse():     ${stats.validation.filesUsingParse} files`);

  // Type safety
  console.log('\n🔒 Type Safety:');
  const anyPercent = calcPercent(stats.typeAny.files.length, stats.usage.totalFiles);
  const color = anyPercent > 10 ? '🔴' : anyPercent > 5 ? '🟡' : '🟢';
  console.log(`  Files with 'any' types:  ${color} ${stats.typeAny.files.length} (${anyPercent}%)`);
  console.log(`  Total 'any' occurrences: ${stats.typeAny.count}`);

  if (stats.typeAny.files.length > 0 && stats.typeAny.files.length <= 10) {
    console.log('\n  Top files with any types:');
    for (const file of stats.typeAny.files.slice(0, 10)) {
      console.log(`    - ${file}`);
    }
  }

  // Entity contracts
  console.log('\n📋 Entity Contracts:');
  console.log(`  Total entity contracts:       ${stats.entityContracts.total}`);
  console.log(`  Extending generated:          ${stats.entityContracts.extendingGenerated}`);
  console.log(`  Standalone (manual):          ${stats.entityContracts.standalone}`);

  // Recommendations
  console.log('\n💡 Recommendations:');

  const contractAdoption = calcPercent(stats.usage.contractImports, stats.usage.totalFiles);
  if (contractAdoption < 30) {
    console.log(
      `  ⚠️  Low contract adoption (${contractAdoption}%) - Consider using contracts for validation`,
    );
  }

  if (stats.usage.directDbImports > stats.usage.contractImports) {
    console.log(`  ⚠️  More direct DB imports than contract usage - Add validation layer`);
  }

  if (stats.typeAny.files.length > stats.usage.totalFiles * 0.1) {
    console.log(`  ⚠️  High 'any' type usage (${anyPercent}%) - Replace with proper types`);
  }

  if (stats.entityContracts.standalone > stats.entityContracts.extendingGenerated) {
    console.log(`  ℹ️  Many standalone contracts - Consider extending generated schemas`);
  }

  console.log(`\n${'='.repeat(70)}`);
}

// =============================================================================
// File Output
// =============================================================================

/**
 * Save report to JSON file
 *
 * @param stats - Coverage statistics
 * @param options - Save options
 *
 * @example
 * ```typescript
 * saveReport(stats, { rootDir: process.cwd() })
 * ```
 */
export function saveReport(
  stats: CoverageStats,
  options: {
    rootDir?: string;
    outputPath?: string;
  } = {},
): void {
  const { rootDir = process.cwd(), outputPath } = options;
  const reportFile = outputPath || join(rootDir, '.type-coverage-report.json');

  const report = {
    timestamp: new Date().toISOString(),
    stats,
  };

  writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved: ${reportFile}`);
}

/**
 * Generate markdown report
 *
 * @param stats - Coverage statistics
 * @returns Markdown-formatted report
 *
 * @example
 * ```typescript
 * const md = generateMarkdown(stats)
 * writeFileSync('report.md', md)
 * ```
 */
export function generateMarkdown(stats: CoverageStats): string {
  let md = `# Type Coverage Report\n\n`;
  md += `Generated: ${new Date().toLocaleString()}\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Tables | ${stats.generated.tables} |\n`;
  md += `| Generated Contracts | ${stats.generated.totalContracts} |\n`;
  md += `| Files Analyzed | ${stats.usage.totalFiles} |\n`;
  md += `| Contract Adoption | ${calcPercent(stats.usage.contractImports, stats.usage.totalFiles)}% |\n`;
  md += `| Files with 'any' Types | ${calcPercent(stats.typeAny.files.length, stats.usage.totalFiles)}% |\n`;
  md += `\n`;

  md += `## Generated Contracts\n\n`;
  md += `- **Tables:** ${stats.generated.tables}\n`;
  md += `- **Schemas:** ${stats.generated.totalSchemas} (Select + Insert)\n`;
  md += `- **Contracts:** ${stats.generated.totalContracts}\n\n`;

  md += `## Usage Statistics\n\n`;
  md += `- **Contract imports:** ${stats.usage.contractImports} files (${calcPercent(stats.usage.contractImports, stats.usage.totalFiles)}%)\n`;
  md += `- **Schema imports:** ${stats.usage.schemaImports} files (${calcPercent(stats.usage.schemaImports, stats.usage.totalFiles)}%)\n`;
  md += `- **Direct DB imports:** ${stats.usage.directDbImports} files\n\n`;

  md += `## Validation Coverage\n\n`;
  md += `- **Using .validate():** ${stats.validation.filesUsingValidation} files\n`;
  md += `- **Using .isType():** ${stats.validation.filesUsingTypeGuards} files\n`;
  md += `- **Using .parse():** ${stats.validation.filesUsingParse} files\n\n`;

  md += `## Type Safety\n\n`;
  const anyPercent = calcPercent(stats.typeAny.files.length, stats.usage.totalFiles);
  md += `- **Files with 'any' types:** ${stats.typeAny.files.length} (${anyPercent}%)\n`;
  md += `- **Total 'any' occurrences:** ${stats.typeAny.count}\n\n`;

  if (stats.typeAny.files.length > 0 && stats.typeAny.files.length <= 20) {
    md += `### Files with 'any' Types\n\n`;
    for (const file of stats.typeAny.files.slice(0, 20)) {
      md += `- \`${file}\`\n`;
    }
    md += `\n`;
  }

  md += `## Entity Contracts\n\n`;
  md += `- **Total:** ${stats.entityContracts.total}\n`;
  md += `- **Extending Generated:** ${stats.entityContracts.extendingGenerated}\n`;
  md += `- **Standalone:** ${stats.entityContracts.standalone}\n\n`;

  return md;
}

/**
 * Save markdown report to file
 *
 * @param stats - Coverage statistics
 * @param options - Save options
 *
 * @example
 * ```typescript
 * saveMarkdownReport(stats, { rootDir: process.cwd() })
 * ```
 */
export function saveMarkdownReport(
  stats: CoverageStats,
  options: {
    rootDir?: string;
    outputPath?: string;
  } = {},
): void {
  const { rootDir = process.cwd(), outputPath } = options;
  const outputFile = outputPath || join(rootDir, 'docs/TYPE_COVERAGE.md');

  const markdown = generateMarkdown(stats);
  writeFileSync(outputFile, markdown);
  console.log(`\n✅ Markdown report generated: ${outputFile}`);
}
