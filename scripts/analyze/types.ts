#!/usr/bin/env tsx

/**
 * Type Usage Analyzer for CMS Types Migration
 *
 * Analyzes all TypeScript files to find usages of CMS types that need migration using AST parsing.
 * Outputs a comprehensive JSON report showing:
 * - Which types are used where
 * - Import patterns
 * - Migration complexity
 *
 * Usage: pnpm tsx scripts/analyze-types.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger, getProjectRoot, handleASTParseError } from '@revealui/scripts/index.js';
import fg from 'fast-glob';
import * as ts from 'typescript';

const logger = createLogger();

interface TypeUsage {
  type: string;
  file: string;
  line: number;
  context: 'import' | 'type-annotation' | 'interface-extends' | 'generic-param';
  snippet: string;
  importSource?: string;
}

interface FileAnalysis {
  path: string;
  imports: Array<{ types: string[]; source: string; line: number }>;
  usages: TypeUsage[];
}

interface AnalysisReport {
  timestamp: string;
  summary: {
    totalFiles: number;
    filesWithUsages: number;
    totalUsages: number;
    uniqueTypes: string[];
  };
  byType: Record<
    string,
    {
      totalUsages: number;
      files: string[];
      importSources: string[];
    }
  >;
  byFile: Record<string, TypeUsage[]>;
  migrationPriority: Array<{
    type: string;
    usages: number;
    files: number;
    complexity: 'low' | 'medium' | 'high';
    reason: string;
  }>;
  recommendations: string[];
}

// Target types to analyze for migration
const TARGET_TYPES = [
  // Core config types
  'CollectionConfig',
  'GlobalConfig',
  'Field',
  'Config',
  'SanitizedConfig',

  // RevealUI wrapper types (candidates for deprecation)
  'RevealCollectionConfig',
  'RevealGlobalConfig',
  'RevealConfig',
  'RevealField',

  // Hook types (need TypeScript-only contracts)
  'CollectionAfterChangeHook',
  'CollectionBeforeChangeHook',
  'CollectionAfterReadHook',
  'CollectionBeforeReadHook',
  'CollectionBeforeValidateHook',
  'CollectionAfterDeleteHook',
  'CollectionBeforeDeleteHook',

  // Access types
  'AccessFunction',
  'FieldAccess',
  'CollectionAccess',
  'FieldAccessConfig',

  // Field-specific types
  'TextField',
  'NumberField',
  'RelationshipField',
  'SelectField',
  'ArrayField',
  'BlockField',
  'GroupField',
  'UploadField',
  'RichTextField',
];

// Import sources to track
const IMPORT_SOURCES = [
  '@revealui/core',
  '@revealui/core/types',
  '@revealui/contracts',
  '@revealui/contracts/cms',
];

/**
 * Extract imported type names from import specifier
 */
function extractImportedTypes(specifiers: ts.NodeArray<ts.ImportSpecifier>): string[] {
  const types: string[] = [];
  for (const specifier of specifiers) {
    if (ts.isImportSpecifier(specifier)) {
      const name = specifier.name.text;
      const propertyName = specifier.propertyName?.text;
      types.push(propertyName || name);
    }
  }
  return types;
}

/**
 * Check if a type reference matches one of our target types
 */
function isTargetType(typeNode: ts.EntityName): boolean {
  if (ts.isIdentifier(typeNode)) {
    return TARGET_TYPES.includes(typeNode.text);
  }
  // Handle qualified names like Namespace.Type
  if (ts.isQualifiedName(typeNode)) {
    return TARGET_TYPES.includes(typeNode.right.text);
  }
  return false;
}

/**
 * Get type name from a type reference node
 */
function getTypeName(typeNode: ts.EntityName): string {
  if (ts.isIdentifier(typeNode)) {
    return typeNode.text;
  }
  if (ts.isQualifiedName(typeNode)) {
    return typeNode.right.text;
  }
  return '';
}

/**
 * Context for type analysis (caches expensive operations)
 */
interface TypeAnalysisContext {
  sourceFile: ts.SourceFile;
  lines: string[]; // Cached line array to avoid repeated split() calls
}

/**
 * Analyze AST node for type usages
 * Performance: Uses cached lines array to avoid repeated split() calls
 */
function analyzeNodeForTypeUsages(
  node: ts.Node,
  context: TypeAnalysisContext,
  importedTypes: Map<string, string>,
  usages: TypeUsage[],
  filePath: string,
): void {
  // Helper to get line text (uses cached lines array)
  const getLineText = (pos: number): string => {
    const { line } = context.sourceFile.getLineAndCharacterOfPosition(pos);
    return context.lines[line]?.trim() || '';
  };

  // Check type annotations (e.g., `const x: TypeName = ...`)
  if (ts.isTypeReferenceNode(node)) {
    if (isTargetType(node.typeName)) {
      const typeName = getTypeName(node.typeName);
      const lineText = getLineText(node.getStart());

      usages.push({
        type: typeName,
        file: filePath,
        line: context.sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        context: 'type-annotation',
        snippet: lineText.substring(0, 100),
        importSource: importedTypes.get(typeName),
      });
    }
  }

  // Check interface extends (e.g., `interface X extends TypeName`)
  if (ts.isInterfaceDeclaration(node) && node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        for (const type of clause.types) {
          if (ts.isExpressionWithTypeArguments(type)) {
            const expr = type.expression;
            if (ts.isIdentifier(expr) || ts.isQualifiedName(expr)) {
              if (isTargetType(expr)) {
                const typeName = getTypeName(expr);
                const lineText = getLineText(type.getStart());

                usages.push({
                  type: typeName,
                  file: filePath,
                  line: context.sourceFile.getLineAndCharacterOfPosition(type.getStart()).line + 1,
                  context: 'interface-extends',
                  snippet: lineText.substring(0, 100),
                  importSource: importedTypes.get(typeName),
                });
              }
            }
          }
        }
      }
    }
  }

  // Check generic type parameters (e.g., `Array<TypeName>` or `Map<TypeName, string>`)
  // Handle TypeReferenceNode with type arguments (proper type guard)
  if (ts.isTypeReferenceNode(node) && node.typeArguments) {
    for (const typeArg of node.typeArguments) {
      // Recursively check nested type arguments (handles cases like Array<Map<TypeName>>)
      if (ts.isTypeReferenceNode(typeArg)) {
        if (isTargetType(typeArg.typeName)) {
          const typeName = getTypeName(typeArg.typeName);
          const lineText = getLineText(typeArg.getStart());

          usages.push({
            type: typeName,
            file: filePath,
            line: context.sourceFile.getLineAndCharacterOfPosition(typeArg.getStart()).line + 1,
            context: 'generic-param',
            snippet: lineText.substring(0, 100),
            importSource: importedTypes.get(typeName),
          });
        }
        // Recursively check nested generics
        if (typeArg.typeArguments) {
          analyzeNodeForTypeUsages(typeArg, context, importedTypes, usages, filePath);
        }
      }
    }
  }

  // Also handle ExpressionWithTypeArguments (for interface extends with generics)
  if (ts.isExpressionWithTypeArguments(node) && node.typeArguments) {
    for (const typeArg of node.typeArguments) {
      if (ts.isTypeReferenceNode(typeArg) && isTargetType(typeArg.typeName)) {
        const typeName = getTypeName(typeArg.typeName);
        const lineText = getLineText(typeArg.getStart());

        usages.push({
          type: typeName,
          file: filePath,
          line: context.sourceFile.getLineAndCharacterOfPosition(typeArg.getStart()).line + 1,
          context: 'generic-param',
          snippet: lineText.substring(0, 100),
          importSource: importedTypes.get(typeName),
        });
      }
    }
  }

  // Recurse into children
  ts.forEachChild(node, (child) => {
    analyzeNodeForTypeUsages(child, context, importedTypes, usages, filePath);
  });
}

async function analyzeFile(filePath: string): Promise<FileAnalysis> {
  const content = await fs.readFile(filePath, 'utf-8');

  const analysis: FileAnalysis = {
    path: filePath,
    imports: [],
    usages: [],
  };

  const importedTypes: Map<string, string> = new Map();

  try {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const scriptKind =
      ext === 'tsx' || ext === 'jsx'
        ? ts.ScriptKind.TSX
        : ext === 'ts' || ext === 'js'
          ? ts.ScriptKind.TS
          : ts.ScriptKind.Unknown;

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    // First pass: collect imports
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const source = moduleSpecifier.text;

          // Use exact match or subpath match (same pattern as migrate-types.ts)
          if (IMPORT_SOURCES.some((s) => source === s || source.startsWith(`${s}/`))) {
            if (node.importClause) {
              const namedImports = node.importClause.namedBindings;
              if (namedImports && ts.isNamedImports(namedImports)) {
                const types = extractImportedTypes(namedImports.elements);
                const targetTypes = types.filter((t) => TARGET_TYPES.includes(t));

                if (targetTypes.length > 0) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                  analysis.imports.push({
                    types: targetTypes,
                    source,
                    line: line + 1,
                  });
                  targetTypes.forEach((t) => {
                    importedTypes.set(t, source);
                  });
                }
              }
            }
          }
        }
      }
    });

    // Second pass: find type usages
    // Cache lines array once to avoid repeated split() calls (performance optimization)
    const context: TypeAnalysisContext = {
      sourceFile,
      lines: content.split('\n'),
    };
    analyzeNodeForTypeUsages(sourceFile, context, importedTypes, analysis.usages, filePath);
  } catch (error) {
    // Use standardized error handler
    handleASTParseError(filePath, error, logger);
  }

  return analysis;
}

function calculateComplexity(
  type: string,
  usageCount: number,
  fileCount: number,
): {
  complexity: 'low' | 'medium' | 'high';
  reason: string;
} {
  // Hook types are always high complexity (need TypeScript generics)
  if (type.includes('Hook')) {
    return {
      complexity: 'high',
      reason: 'Hook types require TypeScript generic signatures, cannot use Zod',
    };
  }

  // Access types are medium complexity
  if (type.includes('Access')) {
    return {
      complexity: 'medium',
      reason: 'Access functions need TypeScript types but simpler signatures',
    };
  }

  // Deprecated RevealUI types need careful migration
  if (type.startsWith('Reveal')) {
    return {
      complexity: 'medium',
      reason: 'Deprecated type - needs migration path to base type',
    };
  }

  // Field types based on usage count
  if (usageCount > 20 || fileCount > 10) {
    return {
      complexity: 'high',
      reason: `High usage count (${usageCount} usages across ${fileCount} files)`,
    };
  }

  if (usageCount > 5 || fileCount > 3) {
    return {
      complexity: 'medium',
      reason: `Moderate usage (${usageCount} usages across ${fileCount} files)`,
    };
  }

  return {
    complexity: 'low',
    reason: `Low usage (${usageCount} usages across ${fileCount} files)`,
  };
}

async function runAnalysis() {
  try {
    await getProjectRoot(import.meta.url);
    logger.header('Type Usage Analyzer for CMS Types Migration');

    // Find all TypeScript files
    const files = await fg(
      [
        'packages/core/src/**/*.ts',
        'packages/core/src/**/*.tsx',
        'packages/contracts/src/**/*.ts',
        'apps/admin/src/**/*.ts',
        'apps/admin/src/**/*.tsx',
      ],
      {
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**', '**/.next/**'],
        cwd: process.cwd(),
        absolute: false,
      },
    );

    logger.info(`📁 Found ${files.length} TypeScript files to analyze\n`);

    const report: AnalysisReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: files.length,
        filesWithUsages: 0,
        totalUsages: 0,
        uniqueTypes: [],
      },
      byType: {},
      byFile: {},
      migrationPriority: [],
      recommendations: [],
    };

    // Analyze each file
    const analyses: FileAnalysis[] = [];
    for (const file of files) {
      try {
        const analysis = await analyzeFile(file);
        analyses.push(analysis);

        if (analysis.usages.length > 0) {
          report.summary.filesWithUsages++;
          report.byFile[file] = analysis.usages;
        }

        for (const usage of analysis.usages) {
          report.summary.totalUsages++;

          if (!report.byType[usage.type]) {
            report.byType[usage.type] = {
              totalUsages: 0,
              files: [],
              importSources: [],
            };
          }

          report.byType[usage.type].totalUsages++;
          if (!report.byType[usage.type].files.includes(file)) {
            report.byType[usage.type].files.push(file);
          }
          if (
            usage.importSource &&
            !report.byType[usage.type].importSources.includes(usage.importSource)
          ) {
            report.byType[usage.type].importSources.push(usage.importSource);
          }
        }
      } catch (error) {
        logger.warning(
          `Error analyzing ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    report.summary.uniqueTypes = Object.keys(report.byType);

    // Calculate migration priority
    for (const [type, data] of Object.entries(report.byType)) {
      const { complexity, reason } = calculateComplexity(type, data.totalUsages, data.files.length);
      report.migrationPriority.push({
        type,
        usages: data.totalUsages,
        files: data.files.length,
        complexity,
        reason,
      });
    }

    // Sort by complexity (high first) then by usage count
    const complexityOrder = { high: 0, medium: 1, low: 2 };
    report.migrationPriority.sort((a, b) => {
      const complexityDiff = complexityOrder[a.complexity] - complexityOrder[b.complexity];
      if (complexityDiff !== 0) return complexityDiff;
      return b.usages - a.usages;
    });

    // Generate recommendations
    const hookTypes = report.migrationPriority.filter((p) => p.type.includes('Hook'));
    const revealTypes = report.migrationPriority.filter((p) => p.type.startsWith('Reveal'));
    const coreTypes = report.migrationPriority.filter((p) =>
      ['CollectionConfig', 'GlobalConfig', 'Field'].includes(p.type),
    );

    if (hookTypes.length > 0) {
      report.recommendations.push(
        `🔴 HIGH PRIORITY: ${hookTypes.length} hook types found. These CANNOT be validated by Zod. ` +
          `Create TypeScript-only contracts in contracts/functions.ts`,
      );
    }

    if (revealTypes.length > 0) {
      report.recommendations.push(
        `🟡 DEPRECATION: ${revealTypes.length} RevealUI wrapper types found (${revealTypes.map((t) => t.type).join(', ')}). ` +
          `Mark as @deprecated and provide migration path to base types.`,
      );
    }

    if (coreTypes.length > 0) {
      report.recommendations.push(
        `🟢 CORE TYPES: ${coreTypes.map((t) => `${t.type} (${t.usages} usages)`).join(', ')}. ` +
          `These should be derived from Zod schemas for structure validation.`,
      );
    }

    // Print summary
    logger.header('Analysis Summary');
    logger.info(`Total files analyzed: ${report.summary.totalFiles}`);
    logger.info(`Files with type usages: ${report.summary.filesWithUsages}`);
    logger.info(`Total type usages: ${report.summary.totalUsages}`);
    logger.info(`Unique types found: ${report.summary.uniqueTypes.length}`);
    logger.info('');

    logger.header('Migration Priority');
    for (const item of report.migrationPriority.slice(0, 15)) {
      const icon = item.complexity === 'high' ? '🔴' : item.complexity === 'medium' ? '🟡' : '🟢';
      logger.info(`${icon} ${item.type}`);
      logger.info(`   ${item.usages} usages across ${item.files} files`);
      logger.info(`   Reason: ${item.reason}`);
    }
    if (report.migrationPriority.length > 15) {
      logger.info(`   ... and ${report.migrationPriority.length - 15} more types`);
    }
    logger.info('');

    logger.header('Recommendations');
    for (const rec of report.recommendations) {
      logger.info(rec);
    }
    logger.info('');

    // Write detailed report
    const reportPath = path.join(process.cwd(), 'TYPE-USAGE-REPORT.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    logger.success(`📄 Detailed report written to: ${reportPath}`);

    // Checkpoint output
    logger.header('Phase 0.1 Checkpoint');
    logger.success(`Analyzer completed successfully`);
    logger.info(`✓ Found ${report.summary.uniqueTypes.length} target types`);
    logger.info(
      `✓ High complexity types: ${report.migrationPriority.filter((p) => p.complexity === 'high').length}`,
    );
    logger.info(
      `✓ Medium complexity types: ${report.migrationPriority.filter((p) => p.complexity === 'medium').length}`,
    );
    logger.info(
      `✓ Low complexity types: ${report.migrationPriority.filter((p) => p.complexity === 'low').length}`,
    );
    logger.info(`\nProceed to Phase 0.2 if report looks correct.`);
  } catch (error) {
    logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runAnalysis();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
