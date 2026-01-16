#!/usr/bin/env tsx

/**
 * API Documentation Extractor
 *
 * Extracts API documentation from TypeScript source files using the TypeScript compiler API.
 * Parses JSDoc comments, types, interfaces, classes, and functions.
 */

import ts from 'typescript'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createLogger } from '../shared/utils.js'

const logger = createLogger()

export interface ApiEntity {
  name: string
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum'
  description: string
  parameters?: Array<{
    name: string
    type: string
    description: string
    optional: boolean
  }>
  returns?: {
    type: string
    description: string
  }
  examples?: string[]
  since?: string
  deprecated?: string
  see?: string[]
  file: string
  line: number
  exported: boolean
  signature?: string
}

export interface PackageApi {
  packageName: string
  packagePath: string
  entities: ApiEntity[]
}

/**
 * Extract JSDoc comment from a node
 */
function extractJSDoc(node: ts.Node): {
  description: string
  parameters: Map<string, string>
  returns?: string
  examples: string[]
  since?: string
  deprecated?: string
  see: string[]
} {
  const result = {
    description: '',
    parameters: new Map<string, string>(),
    returns: undefined as string | undefined,
    examples: [] as string[],
    since: undefined as string | undefined,
    deprecated: undefined as string | undefined,
    see: [] as string[],
  }

  const jsDocTags = ts.getJSDocTags(node)
  const jsDocComments = ts.getJSDocCommentsAndTags(node, false)

  // Extract main description from JSDoc comment
  const comment = ts.getJSDocComment(node)
  if (comment) {
    result.description = comment.trim()
  }

  // Parse JSDoc tags
  for (const tag of jsDocTags) {
    const tagName = tag.tagName.text
    const tagComment = tag.comment

    if (tagName === 'param' || tagName === 'parameter') {
      const paramName = tag.name?.text
      const paramComment = typeof tagComment === 'string' ? tagComment : tagComment?.[0]?.text
      if (paramName && paramComment) {
        result.parameters.set(paramName, paramComment)
      }
    } else if (tagName === 'returns' || tagName === 'return') {
      result.returns = typeof tagComment === 'string' ? tagComment : tagComment?.[0]?.text
    } else if (tagName === 'example') {
      const example = typeof tagComment === 'string' ? tagComment : tagComment?.[0]?.text
      if (example) {
        result.examples.push(example)
      }
    } else if (tagName === 'since') {
      result.since = typeof tagComment === 'string' ? tagComment : tagComment?.[0]?.text
    } else if (tagName === 'deprecated') {
      result.deprecated = typeof tagComment === 'string' ? tagComment : tagComment?.[0]?.text || 'Deprecated'
    } else if (tagName === 'see') {
      const see = typeof tagComment === 'string' ? tagComment : tagComment?.[0]?.text
      if (see) {
        result.see.push(see)
      }
    }
  }

  return result
}

/**
 * Get type as string
 */
function getTypeString(type: ts.Type, checker: ts.TypeChecker): string {
  return checker.typeToString(type)
}

/**
 * Extract function signature
 */
function extractFunction(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ApiEntity | null {
  if (!node.name) return null

  const name = node.name.text
  const jsDoc = extractJSDoc(node)
  const signature = checker.getSignatureFromDeclaration(node as ts.SignatureDeclaration)
  const parameters: ApiEntity['parameters'] = []

  if (signature) {
    signature.getParameters().forEach((param, index) => {
      const paramDecl = param.valueDeclaration
      if (paramDecl && ts.isParameter(paramDecl)) {
        const paramType = checker.getTypeOfSymbolAtLocation(param, node)
        const paramName = param.name
        const isOptional = paramDecl.questionToken !== undefined || paramDecl.initializer !== undefined

        parameters.push({
          name: paramName,
          type: getTypeString(paramType, checker),
          description: jsDoc.parameters.get(paramName) || '',
          optional: isOptional,
        })
      }
    })
  }

  const returnType = signature ? checker.getReturnTypeOfSignature(signature) : undefined
  const returns = returnType
    ? {
        type: getTypeString(returnType, checker),
        description: jsDoc.returns || '',
      }
    : undefined

  return {
    name,
    kind: 'function',
    description: jsDoc.description,
    parameters,
    returns,
    examples: jsDoc.examples,
    since: jsDoc.since,
    deprecated: jsDoc.deprecated,
    see: jsDoc.see,
    file: sourceFile.fileName,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    exported: ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
    signature: checker.signatureToString(signature!),
  }
}

/**
 * Extract class information
 */
function extractClass(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ApiEntity | null {
  if (!node.name) return null

  const name = node.name.text
  const jsDoc = extractJSDoc(node)

  // Extract constructor parameters
  const constructor = node.members.find((m) => ts.isConstructorDeclaration(m)) as ts.ConstructorDeclaration | undefined
  const parameters: ApiEntity['parameters'] = []

  if (constructor) {
    constructor.parameters.forEach((param) => {
      if (ts.isIdentifier(param.name) || ts.isObjectBindingPattern(param.name)) {
        const paramName = ts.isIdentifier(param.name) ? param.name.text : 'options'
        const paramType = checker.getTypeAtLocation(param)
        const isOptional = param.questionToken !== undefined || param.initializer !== undefined

        parameters.push({
          name: paramName,
          type: getTypeString(paramType, checker),
          description: jsDoc.parameters.get(paramName) || '',
          optional: isOptional,
        })
      }
    })
  }

  return {
    name,
    kind: 'class',
    description: jsDoc.description,
    parameters: parameters.length > 0 ? parameters : undefined,
    examples: jsDoc.examples,
    since: jsDoc.since,
    deprecated: jsDoc.deprecated,
    see: jsDoc.see,
    file: sourceFile.fileName,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    exported: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || false,
  }
}

/**
 * Extract interface information
 */
function extractInterface(
  node: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ApiEntity | null {
  if (!node.name) return null

  const name = node.name.text
  const jsDoc = extractJSDoc(node)
  const parameters: ApiEntity['parameters'] = []

  node.members.forEach((member) => {
    if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
      const propType = member.type ? checker.getTypeAtLocation(member.type) : checker.getAnyType()
      const isOptional = member.questionToken !== undefined

      parameters.push({
        name: member.name.text,
        type: getTypeString(propType, checker),
        description: jsDoc.parameters.get(member.name.text) || '',
        optional: isOptional,
      })
    }
  })

  return {
    name,
    kind: 'interface',
    description: jsDoc.description,
    parameters: parameters.length > 0 ? parameters : undefined,
    examples: jsDoc.examples,
    since: jsDoc.since,
    deprecated: jsDoc.deprecated,
    see: jsDoc.see,
    file: sourceFile.fileName,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    exported: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || false,
  }
}

/**
 * Extract type alias information
 */
function extractTypeAlias(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ApiEntity | null {
  if (!node.name) return null

  const name = node.name.text
  const jsDoc = extractJSDoc(node)
  const type = checker.getTypeAtLocation(node)

  return {
    name,
    kind: 'type',
    description: jsDoc.description,
    returns: {
      type: getTypeString(type, checker),
      description: '',
    },
    examples: jsDoc.examples,
    since: jsDoc.since,
    deprecated: jsDoc.deprecated,
    see: jsDoc.see,
    file: sourceFile.fileName,
    line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    exported: node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || false,
  }
}

/**
 * Read and parse tsconfig.json from a directory
 * Note: TypeScript's API is synchronous, so we use fs.readFileSync
 */
async function readTsConfig(configPath: string): Promise<ts.CompilerOptions> {
  try {
    // Use synchronous read since TypeScript API expects sync
    const { readFileSync, existsSync } = await import('node:fs')
    
    if (!existsSync(configPath)) {
      return {}
    }

    const configFile = ts.readConfigFile(configPath, (filePath) => {
      try {
        return readFileSync(filePath, 'utf-8')
      } catch {
        return undefined
      }
    })
    
    if (configFile.error) {
      logger.warning(`Failed to read tsconfig at ${configPath}: ${String(configFile.error.messageText)}`)
      return {}
    }

    // Parse with extended configs support
    const configDir = path.dirname(configPath)
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      configDir,
      {},
      path.basename(configPath),
    )

    return parsed.options
  } catch (error) {
    logger.warning(`Error parsing tsconfig at ${configPath}: ${error instanceof Error ? error.message : String(error)}`)
    return {}
  }
}

/**
 * Find tsconfig.json file in directory or parent directories
 */
async function findTsConfig(startDir: string): Promise<string | null> {
  let currentDir = startDir

  for (let i = 0; i < 5; i++) {
    const configPath = path.join(currentDir, 'tsconfig.json')
    try {
      await fs.access(configPath)
      return configPath
    } catch {
      // Continue searching
    }
    const parent = path.dirname(currentDir)
    if (parent === currentDir) break // Reached root
    currentDir = parent
  }

  return null
}

/**
 * Extract API entities from a TypeScript source file
 */
export async function extractFromFile(
  filePath: string,
  packagePath?: string,
): Promise<ApiEntity[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)

  // Find and read tsconfig.json
  let compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
    skipLibCheck: true,
  }

  if (packagePath) {
    const tsConfigPath = await findTsConfig(packagePath)
    if (tsConfigPath) {
      const packageOptions = await readTsConfig(tsConfigPath)
      compilerOptions = { ...compilerOptions, ...packageOptions }
    }
  } else {
    // Try to find tsconfig relative to file
    const fileDir = path.dirname(filePath)
    const tsConfigPath = await findTsConfig(fileDir)
    if (tsConfigPath) {
      const fileOptions = await readTsConfig(tsConfigPath)
      compilerOptions = { ...compilerOptions, ...fileOptions }
    }
  }

  // Find all TypeScript files in the same package for proper type resolution
  const allFiles: string[] = []
  if (packagePath) {
    try {
      const { glob } = await import('fast-glob')
      const files = await glob(['**/*.ts', '**/*.tsx'], {
        cwd: packagePath,
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
        absolute: true,
      })
      allFiles.push(...files)
    } catch (error) {
      logger.warning(`Failed to find all files in package, using single file: ${error instanceof Error ? error.message : String(error)}`)
      allFiles.push(filePath)
    }
  } else {
    allFiles.push(filePath)
  }

  const program = ts.createProgram(allFiles, compilerOptions)
  const checker = program.getTypeChecker()
  const entities: ApiEntity[] = []

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      const entity = extractFunction(node, sourceFile, checker)
      if (entity) entities.push(entity)
    } else if (ts.isClassDeclaration(node)) {
      const entity = extractClass(node, sourceFile, checker)
      if (entity) entities.push(entity)
    } else if (ts.isInterfaceDeclaration(node)) {
      const entity = extractInterface(node, sourceFile, checker)
      if (entity) entities.push(entity)
    } else if (ts.isTypeAliasDeclaration(node)) {
      const entity = extractTypeAlias(node, sourceFile, checker)
      if (entity) entities.push(entity)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return entities
}

/**
 * Extract API from a package directory
 */
export async function extractFromPackage(
  packagePath: string,
  packageName: string,
): Promise<PackageApi> {
  const entities: ApiEntity[] = []

  // Find all TypeScript source files
  const files = await findSourceFiles(packagePath)

  for (const file of files) {
    try {
      const fileEntities = await extractFromFile(file, packagePath)
      entities.push(...fileEntities)
    } catch (error) {
      logger.warning(`Failed to extract from ${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    packageName,
    packagePath,
    entities: entities.filter((e) => e.exported), // Only exported entities
  }
}

/**
 * Find all TypeScript source files in a directory
 */
async function findSourceFiles(dir: string): Promise<string[]> {
  const { glob } = await import('fast-glob')
  const files = await glob(['**/*.ts', '**/*.tsx'], {
    cwd: dir,
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
    absolute: true,
  })

  return files
}
