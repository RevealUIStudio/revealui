/**
 * Code Validator Types
 *
 * Type definitions for the AI code standards enforcer
 */

export interface ValidationRule {
  id: string;
  name: string;
  pattern: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestedFix?: string;
  exemptions?: {
    paths?: string[];
    comments?: string[];
  };
}

export interface AutoFixRule {
  id: string;
  find: string;
  replace: string;
}

export interface CodeStandards {
  $schema?: string;
  title: string;
  description: string;
  version: string;
  rules: ValidationRule[];
  autoFix?: {
    enabled: boolean;
    rules: AutoFixRule[];
  };
  reporting?: {
    format: 'detailed' | 'summary';
    showContext: boolean;
    contextLines: number;
  };
}

export interface ValidationViolation {
  ruleId: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  lineContent: string;
  context?: string[];
  suggestedFix?: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  errors: number;
  warnings: number;
  info: number;
  stats: {
    linesScanned: number;
    rulesApplied: number;
    exemptionsApplied: number;
  };
}

export interface ValidateCodeOptions {
  filePath?: string;
  autoFix?: boolean;
  exemptionComments?: string[];
}
