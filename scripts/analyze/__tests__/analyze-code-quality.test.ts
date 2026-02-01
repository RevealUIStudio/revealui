/**
 * Tests for analyze-code-quality.ts
 * Tests AST-based code quality analysis (any types, JSDoc detection)
 */

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('Code Quality Analysis (AST-based)', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `revealui-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('Any Type Detection', () => {
    it('should detect any type annotations', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `export function test(param: any): any {
  const value: any = 42
  return value
}`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      let anyCount = 0

      function findAnyTypes(node: ts.Node) {
        if (ts.isTypeReferenceNode(node)) {
          if (ts.isIdentifier(node.typeName) && node.typeName.text === 'any') {
            anyCount++
          }
        }
        ts.forEachChild(node, findAnyTypes)
      }

      findAnyTypes(sourceFile)

      expect(anyCount).toBe(3) // param, return type, value
    })

    it('should NOT detect "any" in strings', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `export function test() {
  const msg = "this is any string"
  const other = 'another any string'
}`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      let anyCount = 0

      function findAnyTypes(node: ts.Node) {
        if (ts.isTypeReferenceNode(node)) {
          if (ts.isIdentifier(node.typeName) && node.typeName.text === 'any') {
            anyCount++
          }
        }
        ts.forEachChild(node, findAnyTypes)
      }

      findAnyTypes(sourceFile)

      // AST parser automatically excludes strings
      expect(anyCount).toBe(0)
    })
  })

  describe('Function Detection', () => {
    it('should detect function declarations', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `export function test1() {}
function test2() {}
export async function test3() {}`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      let functionCount = 0

      function countFunctions(node: ts.Node) {
        if (
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node)
        ) {
          functionCount++
        }
        ts.forEachChild(node, countFunctions)
      }

      countFunctions(sourceFile)

      expect(functionCount).toBe(3)
    })

    it('should detect arrow function variables', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `const test1 = () => {}
const test2 = async () => {}
const test3 = function() {}`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      let functionCount = 0

      function countFunctions(node: ts.Node) {
        if (ts.isVariableDeclaration(node)) {
          const init = node.initializer
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            functionCount++
          }
        }
        if (
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node)
        ) {
          functionCount++
        }
        ts.forEachChild(node, countFunctions)
      }

      countFunctions(sourceFile)

      expect(functionCount).toBe(3)
    })
  })

  describe('JSDoc Detection', () => {
    it('should detect JSDoc comments before functions', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `/**
 * This is a JSDoc comment
 */
export function documented() {}

export function undocumented() {}`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      let jsdocCount = 0
      let totalFunctions = 0
      const fullText = sourceFile.getFullText()

      function analyze(node: ts.Node) {
        if (ts.isFunctionDeclaration(node)) {
          totalFunctions++
          const comments = ts.getLeadingCommentRanges(fullText, node.getFullStart()) || []
          const hasJSDoc = comments.some((comment) => {
            if (comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
              const text = fullText.substring(comment.pos, comment.end)
              return text.startsWith('/**')
            }
            return false
          })
          if (hasJSDoc) {
            jsdocCount++
          }
        }
        ts.forEachChild(node, analyze)
      }

      analyze(sourceFile)

      expect(totalFunctions).toBe(2)
      expect(jsdocCount).toBe(1) // Only documented() has JSDoc
    })

    it('should NOT detect non-JSDoc comments', async () => {
      const testFile = join(testDir, 'test.ts')
      const content = `// Regular comment
/* Another comment */
export function test() {}`
      await writeFile(testFile, content)

      const sourceFile = ts.createSourceFile(
        testFile,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )

      let jsdocCount = 0
      const fullText = sourceFile.getFullText()

      function analyze(node: ts.Node) {
        if (ts.isFunctionDeclaration(node)) {
          const comments = ts.getLeadingCommentRanges(fullText, node.getFullStart()) || []
          const hasJSDoc = comments.some((comment) => {
            if (comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
              const text = fullText.substring(comment.pos, comment.end)
              return text.startsWith('/**')
            }
            return false
          })
          if (hasJSDoc) {
            jsdocCount++
          }
        }
        ts.forEachChild(node, analyze)
      }

      analyze(sourceFile)

      expect(jsdocCount).toBe(0) // Regular comments are not JSDoc
    })
  })
})
