/**
 * Code Analyzers Module
 *
 * Exports specialized analyzers for code analysis tasks.
 * These analyzers are reusable across analyze/ and validate/ commands.
 *
 * @dependencies
 * - scripts/lib/analyzers/console-analyzer.ts - Console statement analysis
 */

export {
  type ApiSecurityIssue,
  type ApiSecurityIssueKind,
  findApiSecurityIssues,
} from './api-security-analyzer.js';
export {
  type AuthSecurityIssue,
  type AuthSecurityIssueKind,
  findAuthSecurityIssues,
} from './auth-security-analyzer.js';
export {
  type CodePatternIssue,
  type CodePatternIssueKind,
  findCodePatternIssues,
} from './code-pattern-analyzer.js';
export {
  type AnalysisMode,
  analyzeFile,
  analyzeFileAST,
  analyzeFileRegex,
  analyzeFiles,
  type ConsoleAnalysisResult,
  ConsoleAnalyzer,
  type ConsoleUsage,
  categorizeFile,
} from './console-analyzer.js';
