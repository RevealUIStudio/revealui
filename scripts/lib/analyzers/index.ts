/**
 * Code Analyzers Module
 *
 * Exports specialized analyzers for code analysis tasks.
 * These analyzers are reusable across analyze/ and validate/ commands.
 */

export {
  ConsoleAnalyzer,
  analyzeFile,
  analyzeFileAST,
  analyzeFileRegex,
  analyzeFiles,
  categorizeFile,
  type AnalysisMode,
  type ConsoleAnalysisResult,
  type ConsoleUsage,
} from './console-analyzer.js'
