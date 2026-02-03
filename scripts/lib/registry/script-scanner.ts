/**
 * Script Scanner
 *
 * AST-based metadata extraction from TypeScript script files.
 * Analyzes BaseCLI subclasses to extract commands, arguments, and metadata.
 *
 * @example
 * ```typescript
 * const scanner = new ScriptScanner({ projectRoot: process.cwd() })
 * const metadata = await scanner.scanScript('/path/to/script.ts')
 * console.log(metadata.commands) // ['list', 'get', 'create']
 * ```
 */

import { readFile, stat } from 'node:fs/promises'
import { basename, relative } from 'node:path'
import * as ts from 'typescript'
import type {
  ArgumentMetadata,
  ASTAnalysisResult,
  CommandMetadata,
  DependencyMetadata,
  ExtractionOptions,
  PerformanceMetadata,
  RiskMetadata,
  ScriptMetadata,
} from './script-metadata.js'

// =============================================================================
// Script Scanner Class
// =============================================================================

export class ScriptScanner {
  private options: ExtractionOptions

  constructor(options: ExtractionOptions) {
    this.options = options
  }

  /**
   * Scan a single TypeScript script file and extract metadata
   */
  async scanScript(filePath: string): Promise<ScriptMetadata | null> {
    try {
      // Read file content
      const content = await readFile(filePath, 'utf-8')
      const stats = await stat(filePath)

      // Parse TypeScript AST
      const astResult = this.analyzeAST(content, filePath)

      // Check if this is a CLI script (extends BaseCLI or EnhancedCLI)
      if (
        !astResult.baseClass ||
        !(astResult.baseClass.includes('BaseCLI') || astResult.baseClass.includes('EnhancedCLI'))
      ) {
        return null // Not a CLI script
      }

      // Extract metadata from AST
      const metadata = this.extractMetadata(astResult, filePath, stats.mtime, content)

      // Enhance with additional analysis if requested
      if (this.options.extractPerformance) {
        metadata.performance = this.extractPerformance(astResult, content)
      }

      if (this.options.assessRisk) {
        metadata.risk = this.assessRisk(astResult, content)
      }

      return metadata
    } catch (error) {
      console.warn(
        `Failed to scan script ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      )
      return null
    }
  }

  /**
   * Analyze TypeScript AST to extract structural information
   */
  private analyzeAST(content: string, filePath: string): ASTAnalysisResult {
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)

    const result: ASTAnalysisResult = {
      properties: [],
      methods: [],
      imports: [],
      exports: [],
    }

    // Visit all nodes in the AST
    const visit = (node: ts.Node) => {
      // Extract class declarations
      if (ts.isClassDeclaration(node)) {
        if (node.name) {
          result.className = node.name.text
        }

        // Extract base class
        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              const type = clause.types[0]
              if (ts.isExpressionWithTypeArguments(type)) {
                const expression = type.expression
                if (ts.isIdentifier(expression)) {
                  result.baseClass = expression.text
                }
              }
            }
          }
        }

        // Extract class members
        for (const member of node.members) {
          // Properties
          if (ts.isPropertyDeclaration(member) && member.name) {
            const name = member.name.getText(sourceFile)
            let value: unknown

            if (member.initializer) {
              const initText = member.initializer.getText(sourceFile)
              // Try to parse simple literal values
              if (ts.isStringLiteral(member.initializer)) {
                value = member.initializer.text
              } else if (ts.isNumericLiteral(member.initializer)) {
                value = Number(member.initializer.text)
              } else if (member.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                value = true
              } else if (member.initializer.kind === ts.SyntaxKind.FalseKeyword) {
                value = false
              } else {
                value = initText
              }
            }

            result.properties.push({ name, value })
          }

          // Methods
          if (ts.isMethodDeclaration(member) && member.name) {
            result.methods.push(member.name.getText(sourceFile))
          }
        }
      }

      // Extract imports
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier
        if (ts.isStringLiteral(moduleSpecifier)) {
          const source = moduleSpecifier.text
          const specifiers: string[] = []

          if (node.importClause) {
            // Named imports
            if (
              node.importClause.namedBindings &&
              ts.isNamedImports(node.importClause.namedBindings)
            ) {
              for (const element of node.importClause.namedBindings.elements) {
                specifiers.push(element.name.text)
              }
            }

            // Default import
            if (node.importClause.name) {
              specifiers.push(node.importClause.name.text)
            }
          }

          result.imports.push({ source, specifiers })
        }
      }

      // Extract exports
      if (ts.isExportDeclaration(node)) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            result.exports.push(element.name.text)
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    return result
  }

  /**
   * Extract metadata from AST analysis result
   */
  private extractMetadata(
    astResult: ASTAnalysisResult,
    filePath: string,
    lastModified: Date,
    content: string,
  ): ScriptMetadata {
    // Extract basic info from properties
    const name =
      (this.findProperty(astResult, 'name') as string) ||
      astResult.className ||
      basename(filePath, '.ts')
    const description = (this.findProperty(astResult, 'description') as string) || 'No description'
    const version = this.findProperty(astResult, 'version') as string | undefined

    // Determine category from file path
    const relativePath = relative(this.options.projectRoot, filePath)
    const category = this.determineCategory(relativePath)

    // Extract commands
    const commands = this.extractCommands(astResult, content)

    // Extract global arguments
    const globalArgs = this.extractGlobalArgs(astResult)

    // Check for dry-run support
    const supportsDryRun = this.checkDryRunSupport(astResult)

    // Check for confirmation requirement
    const requiresConfirmation = this.checkConfirmationRequirement(commands)

    // Extract dependencies
    const dependencies = this.extractDependencies(astResult)

    // Extract imports
    const imports = astResult.imports.map((imp) => imp.source)

    // Generate tags
    const tags = this.generateTags(name, description, category, commands)

    // Check base class
    const extendsBaseCLI =
      astResult.baseClass === 'BaseCLI' || astResult.baseClass === 'EnhancedCLI'
    const extendsEnhancedCLI = astResult.baseClass === 'EnhancedCLI'

    return {
      name,
      filePath,
      relativePath,
      category,
      description,
      commands,
      globalArgs,
      extendsBaseCLI,
      extendsEnhancedCLI,
      supportsDryRun,
      requiresConfirmation,
      dependencies,
      imports,
      tags,
      version,
      lastModified,
    }
  }

  /**
   * Extract command definitions from defineCommands method
   */
  private extractCommands(astResult: ASTAnalysisResult, content: string): CommandMetadata[] {
    const commands: CommandMetadata[] = []

    // Check if defineCommands method exists
    if (!astResult.methods.includes('defineCommands')) {
      return commands
    }

    // Extract command objects using regex (simple approach)
    // Pattern: { name: 'commandName', description: 'desc', ... }
    const commandPattern = /\{\s*name:\s*['"]([^'"]+)['"],\s*description:\s*['"]([^'"]+)['"]/g

    let match
    while ((match = commandPattern.exec(content)) !== null) {
      const [, name, description] = match
      commands.push({
        name,
        description,
        args: [], // Could be enhanced to extract args
      })
    }

    return commands
  }

  /**
   * Extract global argument definitions
   */
  private extractGlobalArgs(astResult: ASTAnalysisResult): ArgumentMetadata[] | undefined {
    // Check if defineGlobalArgs method exists
    if (astResult.methods.includes('defineGlobalArgs')) {
      // Default global args from BaseCLI
      return [
        { name: 'json', short: 'j', type: 'boolean', description: 'Output in JSON format' },
        { name: 'verbose', short: 'v', type: 'boolean', description: 'Enable verbose output' },
        { name: 'force', short: 'f', type: 'boolean', description: 'Skip confirmation prompts' },
      ]
    }
    return undefined
  }

  /**
   * Check if script supports dry-run mode
   */
  private checkDryRunSupport(astResult: ASTAnalysisResult): boolean {
    // Check for dry-run flag in properties or methods
    const supportsProp = this.findProperty(astResult, 'supportsDryRun')
    if (supportsProp !== undefined) {
      return Boolean(supportsProp)
    }

    // Check for --dry-run flag in global args
    if (astResult.methods.includes('defineGlobalArgs')) {
      return true // Assume dry-run support if custom global args defined
    }

    return false
  }

  /**
   * Check if script requires confirmation
   */
  private checkConfirmationRequirement(commands: CommandMetadata[]): boolean {
    return commands.some((cmd) => cmd.confirmPrompt !== undefined)
  }

  /**
   * Extract npm dependencies from imports
   */
  private extractDependencies(astResult: ASTAnalysisResult): DependencyMetadata[] {
    const dependencies: DependencyMetadata[] = []
    const seen = new Set<string>()

    for (const imp of astResult.imports) {
      // Skip relative imports
      if (imp.source.startsWith('.') || imp.source.startsWith('/')) {
        continue
      }

      // Skip node: imports
      if (imp.source.startsWith('node:')) {
        continue
      }

      // Extract package name (handle scoped packages)
      const pkgName = imp.source.startsWith('@')
        ? imp.source.split('/').slice(0, 2).join('/')
        : imp.source.split('/')[0]

      if (!seen.has(pkgName)) {
        seen.add(pkgName)
        dependencies.push({
          name: pkgName,
          required: true,
        })
      }
    }

    return dependencies
  }

  /**
   * Generate tags based on script characteristics
   */
  private generateTags(
    name: string,
    description: string,
    category: string,
    commands: CommandMetadata[],
  ): string[] {
    const tags = new Set<string>()

    // Add category as tag
    tags.add(category)

    // Extract keywords from name and description
    const text = `${name} ${description}`.toLowerCase()

    const keywords = [
      'database',
      'db',
      'migration',
      'backup',
      'restore',
      'deploy',
      'deployment',
      'rollback',
      'test',
      'testing',
      'validate',
      'validation',
      'build',
      'compile',
      'bundle',
      'config',
      'configuration',
      'setup',
      'clean',
      'cleanup',
      'maintain',
      'maintenance',
      'analyze',
      'analysis',
      'profile',
      'profiling',
      'security',
      'auth',
      'authentication',
    ]

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        tags.add(keyword)
      }
    }

    // Add command names as tags
    for (const cmd of commands) {
      tags.add(cmd.name)
    }

    return Array.from(tags)
  }

  /**
   * Determine category from file path
   */
  private determineCategory(relativePath: string): ScriptMetadata['category'] {
    if (relativePath.includes('/cli/')) return 'cli'
    if (relativePath.includes('/database/') || relativePath.includes('/db/')) return 'database'
    if (relativePath.includes('/deploy/') || relativePath.includes('/deployment/'))
      return 'deployment'
    if (relativePath.includes('/maintain/') || relativePath.includes('/maintenance/'))
      return 'maintenance'
    if (relativePath.includes('/validate/') || relativePath.includes('/validation/'))
      return 'validation'
    if (relativePath.includes('/automation/')) return 'automation'
    return 'other'
  }

  /**
   * Extract performance metadata from code analysis
   */
  private extractPerformance(
    _astResult: ASTAnalysisResult,
    content: string,
  ): PerformanceMetadata | undefined {
    const metadata: PerformanceMetadata = {}

    // Check for database operations (I/O intensive)
    if (content.includes('connection.query') || content.includes('db.query')) {
      metadata.ioIntensive = true
      metadata.memoryUsage = 'medium'
    }

    // Check for file operations
    if (content.includes('fs.') || content.includes('readFile') || content.includes('writeFile')) {
      metadata.ioIntensive = true
    }

    // Check for child process spawning (CPU intensive)
    if (content.includes('exec(') || content.includes('spawn(')) {
      metadata.cpuUsage = 'medium'
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined
  }

  /**
   * Assess risk level based on operations
   */
  private assessRisk(_astResult: ASTAnalysisResult, content: string): RiskMetadata | undefined {
    const operations: RiskMetadata['operations'] = []
    let level: RiskMetadata['level'] = 'low'
    let reversible = true

    // Check for file write operations
    if (content.includes('writeFile') || content.includes('fs.write')) {
      operations.push('file-write')
      level = 'medium'
    }

    // Check for file delete operations
    if (content.includes('unlink') || content.includes('rm ') || content.includes('fs.remove')) {
      operations.push('file-delete')
      level = 'high'
      reversible = false
    }

    // Check for database write operations
    if (
      content.includes('INSERT') ||
      content.includes('UPDATE') ||
      content.includes('CREATE TABLE')
    ) {
      operations.push('db-write')
      level = level === 'high' ? 'high' : 'medium'
    }

    // Check for database delete operations
    if (
      content.includes('DELETE FROM') ||
      content.includes('DROP TABLE') ||
      content.includes('TRUNCATE')
    ) {
      operations.push('db-delete')
      level = 'critical'
      reversible = false
    }

    // Check for external commands
    if (content.includes('exec(') || content.includes('spawn(')) {
      operations.push('external-command')
      level = level === 'critical' ? 'critical' : 'high'
    }

    if (operations.length === 0) {
      return undefined
    }

    return {
      level,
      operations,
      reversible,
      rollbackComplexity: reversible ? 'simple' : 'complex',
    }
  }

  /**
   * Helper to find a property value by name
   */
  private findProperty(astResult: ASTAnalysisResult, name: string): unknown {
    const prop = astResult.properties.find((p) => p.name === name)
    return prop?.value
  }
}
