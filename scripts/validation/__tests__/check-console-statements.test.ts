/**
 * Tests for check-console-statements.ts
 * Tests AST-based console statement detection
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as ts from 'typescript'

// Mock the logger and utilities
vi.mock('../shared/utils.js', async () => {
  const actual = await vi.importActual('../shared/utils.js')
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    }),
    getProjectRoot: async () => '/tmp/test-project',
    fileExists: async (path: string) => {
      const fs = await import('node:fs/promises')
      try {
        await fs.access(path)
        return true
      } catch {
        return false
      }
    },
  }
})

describe('Console Statement Detection (AST-based)', () => {
  let testDir: string
  let srcDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `revealui-test-${Date.now()}`)
    srcDir = join(testDir, 'packages', 'core', 'src')
    await mkdir(srcDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should detect console.log() calls', async () => {
    const testFile = join(srcDir, 'test.ts')
    const content = `export function test() {
  console.log('hello')
}`
    await writeFile(testFile, content)

    const sourceFile = ts.createSourceFile(
      testFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const matches: Array<{ line: number; content: string }> = []
    const lines = content.split('\n')

    function findConsole(node: ts.Node) {
      if (ts.isPropertyAccessExpression(node)) {
        const expr = node.expression
        if (ts.isIdentifier(expr) && expr.text === 'console') {
          const methodName = node.name.text
          if (methodName === 'log') {
            const parent = node.parent
            if (parent && ts.isCallExpression(parent)) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
              matches.push({
                line: line + 1,
                content: lines[line]?.trim() || '',
              })
            }
          }
        }
      }
      ts.forEachChild(node, findConsole)
    }

    findConsole(sourceFile)

    expect(matches).toHaveLength(1)
    expect(matches[0].line).toBe(2)
    expect(matches[0].content).toContain("console.log('hello')")
  })

  it('should NOT detect console in strings', async () => {
    const testFile = join(srcDir, 'test.ts')
    const content = `export function test() {
  const msg = "console.log() is not a real call"
  const other = 'also console.error() here'
  const template = \`and console.warn() here\`
}`
    await writeFile(testFile, content)

    const sourceFile = ts.createSourceFile(
      testFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const matches: Array<{ line: number }> = []

    function findConsole(node: ts.Node) {
      if (ts.isPropertyAccessExpression(node)) {
        const expr = node.expression
        if (ts.isIdentifier(expr) && expr.text === 'console') {
          const parent = node.parent
          if (parent && ts.isCallExpression(parent)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
            matches.push({ line: line + 1 })
          }
        }
      }
      ts.forEachChild(node, findConsole)
    }

    findConsole(sourceFile)

    // Should find 0 matches because console is inside strings, not actual calls
    expect(matches).toHaveLength(0)
  })

  it('should NOT detect console in comments', async () => {
    const testFile = join(srcDir, 'test.ts')
    const content = `export function test() {
  // console.log('commented out')
  /* console.error('also commented') */
}`
    await writeFile(testFile, content)

    const sourceFile = ts.createSourceFile(
      testFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const matches: Array<{ line: number }> = []

    function findConsole(node: ts.Node) {
      if (ts.isPropertyAccessExpression(node)) {
        const expr = node.expression
        if (ts.isIdentifier(expr) && expr.text === 'console') {
          const parent = node.parent
          if (parent && ts.isCallExpression(parent)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
            matches.push({ line: line + 1 })
          }
        }
      }
      ts.forEachChild(node, findConsole)
    }

    findConsole(sourceFile)

    // AST parser automatically excludes comments
    expect(matches).toHaveLength(0)
  })

  it('should detect multiple console methods', async () => {
    const testFile = join(srcDir, 'test.ts')
    const content = `export function test() {
  console.log('info')
  console.error('error')
  console.warn('warning')
  console.debug('debug')
}`
    await writeFile(testFile, content)

    const sourceFile = ts.createSourceFile(
      testFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const matches: string[] = []

    function findConsole(node: ts.Node) {
      if (ts.isPropertyAccessExpression(node)) {
        const expr = node.expression
        if (ts.isIdentifier(expr) && expr.text === 'console') {
          const methodName = node.name.text
          const parent = node.parent
          if (parent && ts.isCallExpression(parent)) {
            matches.push(methodName)
          }
        }
      }
      ts.forEachChild(node, findConsole)
    }

    findConsole(sourceFile)

    expect(matches).toHaveLength(4)
    expect(matches).toContain('log')
    expect(matches).toContain('error')
    expect(matches).toContain('warn')
    expect(matches).toContain('debug')
  })

  it('should handle arrow functions with console', async () => {
    const testFile = join(srcDir, 'test.ts')
    const content = `export const test = () => {
  console.log('arrow function')
}`
    await writeFile(testFile, content)

    const sourceFile = ts.createSourceFile(
      testFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const matches: number[] = []

    function findConsole(node: ts.Node) {
      if (ts.isPropertyAccessExpression(node)) {
        const expr = node.expression
        if (ts.isIdentifier(expr) && expr.text === 'console') {
          const parent = node.parent
          if (parent && ts.isCallExpression(parent)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
            matches.push(line + 1)
          }
        }
      }
      ts.forEachChild(node, findConsole)
    }

    findConsole(sourceFile)

    expect(matches).toHaveLength(1)
    expect(matches[0]).toBe(2)
  })
})
