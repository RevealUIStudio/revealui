/**
 * Code Analyzers Module
 *
 * Exports specialized analyzers for code analysis tasks.
 * These analyzers are reusable across analyze/ and validate/ commands.
 */

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
} from './console-analyzer.js'
