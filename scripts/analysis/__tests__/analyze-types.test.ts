/**
 * Tests for analyze-types.ts
 * Tests AST-based type usage detection (imports, type annotations, extends, generics)
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as ts from 'typescript'

const TARGET_TYPES = ['CollectionConfig', 'GlobalConfig', 'Field', 'RevealCollectionConfig']
const IMPORT_SOURCES = ['@revealui/core', '@revealui/core/types', '@revealui/contracts']

/**
 * Extract imported type names from import specifier (same as analyze-types.ts)
 */
function extractImportedTypes(specifiers: ts.NodeArray<ts.ImportSpecifier>): string[] {
  const types: string[] = []
  for (const specifier of specifiers) {
    if (ts.isImportSpecifier(specifier)) {
      const name = specifier.name.text
      const propertyName = specifier.propertyName?.text
      types.push(propertyName || name)
    }
  }
  return types
}

/**
 * Check if a type reference matches one of our target types
 */
function isTargetType(typeNode: ts.EntityName): boolean {
  if (ts.isIdentifier(typeNode)) {
    return TARGET_TYPES.includes(typeNode.text)
  }
  if (ts.isQualifiedName(typeNode)) {
    return TARGET_TYPES.includes(typeNode.right.text)
  }
  return false
}

describe('Type Usage Analysis (AST-based)', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `revealui-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('Import Statement Parsing', () => {
    it('should extract imported types from named imports', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `import { CollectionConfig, GlobalConfig, Field } from '@revealui/core'`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      const importedTypes: string[] = []

      ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier
          if (ts.isStringLiteral(moduleSpecifier)) {
            const source = moduleSpecifier.text

            if (IMPORT_SOURCES.some((s) => source.includes(s))) {
              if (node.importClause) {
                const namedImports = node.importClause.namedBindings
                if (namedImports && ts.isNamedImports(namedImports)) {
                  const types = extractImportedTypes(namedImports.elements)
                  importedTypes.push(...types)
                }
              }
            }
          }
        }
      })

      expect(importedTypes).toHaveLength(3)
      expect(importedTypes).toContain('CollectionConfig')
      expect(importedTypes).toContain('GlobalConfig')
      expect(importedTypes).toContain('Field')
    })

    it('should handle type imports', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `import type { CollectionConfig } from '@revealui/core'`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      const importedTypes: string[] = []

      ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier
          if (ts.isStringLiteral(moduleSpecifier)) {
            const source = moduleSpecifier.text

            if (IMPORT_SOURCES.some((s) => source.includes(s))) {
              if (node.importClause) {
                const namedImports = node.importClause.namedBindings
                if (namedImports && ts.isNamedImports(namedImports)) {
                  const types = extractImportedTypes(namedImports.elements)
                  importedTypes.push(...types)
                }
              }
            }
          }
        }
      })

      expect(importedTypes).toHaveLength(1)
      expect(importedTypes).toContain('CollectionConfig')
    })

    it('should handle import aliases correctly', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `import { CollectionConfig as RevealCollectionConfig } from '@revealui/core'`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      const importedTypes: string[] = []

      ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier
          if (ts.isStringLiteral(moduleSpecifier)) {
            const source = moduleSpecifier.text

            if (IMPORT_SOURCES.some((s) => source.includes(s))) {
              if (node.importClause) {
                const namedImports = node.importClause.namedBindings
                if (namedImports && ts.isNamedImports(namedImports)) {
                  const types = extractImportedTypes(namedImports.elements)
                  // Should extract the propertyName (CollectionConfig), not the alias
                  importedTypes.push(...types)
                }
              }
            }
          }
        }
      })

      expect(importedTypes).toHaveLength(1)
      expect(importedTypes).toContain('CollectionConfig')
    })
  })

  describe('Type Annotation Detection', () => {
    it('should detect type annotations', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `const config: CollectionConfig = {}
function test(param: GlobalConfig): Field {}`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      const usages: string[] = []

      function analyze(node: ts.Node) {
        if (ts.isTypeReferenceNode(node)) {
          if (isTargetType(node.typeName)) {
            const typeName = ts.isIdentifier(node.typeName) ? node.typeName.text : ''
            if (typeName) {
              usages.push(typeName)
            }
          }
        }
        ts.forEachChild(node, analyze)
      }

      analyze(sourceFile)

      expect(usages).toHaveLength(3)
      expect(usages).toContain('CollectionConfig')
      expect(usages).toContain('GlobalConfig')
      expect(usages).toContain('Field')
    })
  })

  describe('Interface Extends Detection', () => {
    it('should detect interface extends', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `interface MyConfig extends CollectionConfig {}
interface OtherConfig extends GlobalConfig {}`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      const usages: string[] = []

      function analyze(node: ts.Node) {
        if (ts.isInterfaceDeclaration(node) && node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              for (const type of clause.types) {
                if (ts.isExpressionWithTypeArguments(type)) {
                  const expr = type.expression
                  if (ts.isIdentifier(expr) || ts.isQualifiedName(expr)) {
                    if (isTargetType(expr)) {
                      const typeName = ts.isIdentifier(expr) ? expr.text : expr.right.text
                      usages.push(typeName)
                    }
                  }
                }
              }
            }
          }
        }
        ts.forEachChild(node, analyze)
      }

      analyze(sourceFile)

      expect(usages).toHaveLength(2)
      expect(usages).toContain('CollectionConfig')
      expect(usages).toContain('GlobalConfig')
    })
  })

  describe('Generic Type Parameter Detection', () => {
    it('should detect generic type parameters', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `const config: Array<CollectionConfig> = []
const map: Map<string, GlobalConfig> = new Map()`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      const usages: string[] = []

      function analyze(node: ts.Node) {
        if (ts.isTypeReferenceNode(node) && node.typeArguments) {
          for (const typeArg of node.typeArguments) {
            if (ts.isTypeReferenceNode(typeArg)) {
              if (isTargetType(typeArg.typeName)) {
                const typeName = ts.isIdentifier(typeArg.typeName) ? typeArg.typeName.text : ''
                if (typeName) {
                  usages.push(typeName)
                }
              }
            }
          }
        }
        ts.forEachChild(node, analyze)
      }

      analyze(sourceFile)

      expect(usages).toHaveLength(2)
      expect(usages).toContain('CollectionConfig')
      expect(usages).toContain('GlobalConfig')
    })

    it('should detect nested generic types', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `const config: Array<Map<string, CollectionConfig>> = []`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      const usages: string[] = []

      function analyze(node: ts.Node) {
        if (ts.isTypeReferenceNode(node) && node.typeArguments) {
          for (const typeArg of node.typeArguments) {
            if (ts.isTypeReferenceNode(typeArg)) {
              if (isTargetType(typeArg.typeName)) {
                const typeName = ts.isIdentifier(typeArg.typeName) ? typeArg.typeName.text : ''
                if (typeName) {
                  usages.push(typeName)
                }
              }
              // Recursively check nested generics
              if (typeArg.typeArguments) {
                analyze(typeArg)
              }
            }
          }
        }
        ts.forEachChild(node, analyze)
      }

      analyze(sourceFile)

      // Should find CollectionConfig inside nested Map generic
      expect(usages).toHaveLength(1)
      expect(usages).toContain('CollectionConfig')
    })
  })

  describe('Type Usage Context', () => {
    it('should distinguish between different usage contexts', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `import { CollectionConfig } from '@revealui/core'

interface MyConfig extends CollectionConfig {}
const config: CollectionConfig = {}
const arr: Array<CollectionConfig> = []`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      const contexts: Array<'import' | 'type-annotation' | 'interface-extends' | 'generic-param'> =
        []

      // Check imports
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
          contexts.push('import')
        }
      })

      // Check other usages
      function analyze(node: ts.Node) {
        // Type annotation
        if (ts.isTypeReferenceNode(node) && node.parent) {
          if (ts.isVariableDeclaration(node.parent) || ts.isParameter(node.parent)) {
            if (isTargetType(node.typeName)) {
              contexts.push('type-annotation')
            }
          }
        }

        // Interface extends
        if (ts.isInterfaceDeclaration(node) && node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              contexts.push('interface-extends')
            }
          }
        }

        // Generic parameter
        if (ts.isTypeReferenceNode(node) && node.typeArguments) {
          for (const typeArg of node.typeArguments) {
            if (ts.isTypeReferenceNode(typeArg) && isTargetType(typeArg.typeName)) {
              contexts.push('generic-param')
            }
          }
        }

        ts.forEachChild(node, analyze)
      }

      analyze(sourceFile)

      // Should have all contexts represented
      expect(contexts).toContain('import')
      expect(contexts).toContain('interface-extends')
      expect(contexts).toContain('type-annotation')
      expect(contexts).toContain('generic-param')
    })
  })
})
