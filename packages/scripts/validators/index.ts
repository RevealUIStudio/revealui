/**
 * Validators Module
 *
 * Exports specialized validators for documentation and code validation.
 * These validators provide pass/fail checks and are reusable across commands.
 *
 * @dependencies
 * - scripts/lib/validators/documentation-validator.ts - Documentation validation utilities
 */

export {
  calculateJSDocCoverage,
  calculateQualityMetrics,
  DocumentationValidator,
  type DocValidationOptions,
  findDocumentationFiles,
  type JSDocCoverage,
  type QualityMetrics,
  type ValidationCategory,
  type ValidationIssue,
  type ValidationResult,
  validateDeprecated,
  validateFalseClaims,
  validateJSDoc,
  validateLinks,
  validateScriptRefs,
} from './documentation-validator.js';
