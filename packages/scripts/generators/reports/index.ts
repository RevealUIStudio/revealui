/**
 * Report Generators
 *
 * Modularized report generation utilities.
 * Extracted from coverage-report.ts for better organization.
 *
 * @dependencies
 * - scripts/lib/generators/reports/coverage.ts - Coverage calculation utilities
 * - scripts/lib/generators/reports/formatter.ts - Report formatting utilities
 *
 * @example
 * ```typescript
 * import {
 *   generateReport,
 *   displayReport,
 *   saveReport
 * } from './reports/index.js'
 * ```
 */

// Coverage Calculation
export * from './coverage.js';

// Report Formatting
export * from './formatter.js';
