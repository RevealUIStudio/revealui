/**
 * Validators Module
 *
 * Exports specialized validators for documentation and code validation.
 * These validators provide pass/fail checks and are reusable across commands.
 */

export {
  DocumentationValidator,
  calculateJSDocCoverage,
  calculateQualityMetrics,
  findDocumentationFiles,
  validateDeprecated,
  validateFalseClaims,
  validateJSDoc,
  validateLinks,
  validateScriptRefs,
  type DocValidationOptions,
  type JSDocCoverage,
  type QualityMetrics,
  type ValidationCategory,
  type ValidationIssue,
  type ValidationResult,
} from './documentation-validator.js'
