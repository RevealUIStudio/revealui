/**
 * Integration tests for analyze-code-quality.ts
 * Tests exported functions with realistic file structures (fast, reliable)
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { analyzeFile, runCodeQualityAnalysis, type AnalysisResult } from '../analyze-code-quality'

describe('analyze-code-quality.ts - Integration Tests', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `revealui-integration-test-${Date.now()}`)
    await mkdir(join(testDir, 'packages', 'core', 'src'), { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should analyze multiple files and aggregate results', async () => {
    const file1 = join(testDir, 'packages', 'core', 'src', 'file1.ts')
    const file2 = join(testDir, 'packages', 'core', 'src', 'file2.ts')

    await writeFile(
      file1,
      `export function func1(param: any): any {
  // TODO: fix this
  return param
}`,
    )

    await writeFile(
      file2,
      `/**
 * Documented function
 */
export function func2(): void {
  // FIXME: implement this
}`,
    )

    const summary = await runCodeQualityAnalysis(
      'packages/core/src/**/*.ts',
      testDir,
    )

    expect(summary.totalFiles).toBe(2)
    expect(summary.totalTodos).toBe(2) // TODO + FIXME
    expect(summary.totalAnyTypes).toBe(2) // param: any and return: any
    expect(summary.totalFunctions).toBe(2)
    expect(summary.totalJSDocFunctions).toBe(1) // func2 has JSDoc

    const file1Result = summary.results.find((r) => r.file.includes('file1.ts'))
    const file2Result = summary.results.find((r) => r.file.includes('file2.ts'))

    expect(file1Result?.anyTypes).toBe(2)
    expect(file1Result?.todos).toBe(1)
    expect(file1Result?.jsdocFunctions).toBe(0)

    expect(file2Result?.todos).toBe(1)
    expect(file2Result?.jsdocFunctions).toBe(1)
  })

  it('should calculate JSDoc coverage correctly', async () => {
    const documentedFile = join(testDir, 'packages', 'core', 'src', 'documented.ts')
    const undocumentedFile = join(testDir, 'packages', 'core', 'src', 'undocumented.ts')

    await writeFile(
      documentedFile,
      `/**
 * Function 1
 */
export function func1() {}

/**
 * Function 2
 */
export function func2() {}`,
    )

    await writeFile(
      undocumentedFile,
      `export function func3() {}
export function func4() {}`,
    )

    const summary = await runCodeQualityAnalysis(
      'packages/core/src/**/*.ts',
      testDir,
    )

    const coverage = summary.totalFunctions > 0
      ? (summary.totalJSDocFunctions / summary.totalFunctions) * 100
      : 0

    expect(summary.totalFunctions).toBe(4)
    expect(summary.totalJSDocFunctions).toBe(2)
    expect(coverage).toBe(50)
    expect(summary.jsdocCoverage).toMatch(/50\.0%/)
  })

  it('should detect any types across multiple files', async () => {
    const file1 = join(testDir, 'packages', 'core', 'src', 'file1.ts')
    const file2 = join(testDir, 'packages', 'core', 'src', 'file2.ts')

    await writeFile(file1, `const x: any = 1`)
    await writeFile(file2, `const y: any = 2`)

    const summary = await runCodeQualityAnalysis(
      'packages/core/src/**/*.ts',
      testDir,
    )

    expect(summary.totalAnyTypes).toBe(2)
  })

  it('should analyze a single file correctly', async () => {
    const testFile = join(testDir, 'packages', 'core', 'src', 'single.ts')
    await writeFile(
      testFile,
      `/**
 * Documented function with any type
 * @param value - The value
 */
export function test(value: any): any {
  // TODO: remove any types
  return value
}`,
    )

    const result: AnalysisResult = await analyzeFile(testFile)

    expect(result.todos).toBe(1)
    expect(result.anyTypes).toBe(2) // param and return type
    expect(result.totalFunctions).toBe(1)
    expect(result.jsdocFunctions).toBe(1) // Has JSDoc
  })

  it('should handle empty files gracefully', async () => {
    const emptyFile = join(testDir, 'packages', 'core', 'src', 'empty.ts')
    await writeFile(emptyFile, '')

    const result = await analyzeFile(emptyFile)

    expect(result.todos).toBe(0)
    expect(result.anyTypes).toBe(0)
    expect(result.totalFunctions).toBe(0)
    expect(result.jsdocFunctions).toBe(0)
  })

  it('should sort results by priority (todos + anyTypes)', async () => {
    const highPriority = join(testDir, 'packages', 'core', 'src', 'high.ts')
    const lowPriority = join(testDir, 'packages', 'core', 'src', 'low.ts')

    await writeFile(
      highPriority,
      `// TODO: fix
const x: any = 1
const y: any = 2`,
    )

    await writeFile(lowPriority, `export function clean() {}`)

    const summary = await runCodeQualityAnalysis(
      'packages/core/src/**/*.ts',
      testDir,
    )

    // First result should be high priority (todos + anyTypes = 1 + 2 = 3)
    expect(summary.results[0].todos + summary.results[0].anyTypes).toBeGreaterThanOrEqual(3)
  })
})
