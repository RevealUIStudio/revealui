/**
 * Tests for Dependency Graph Generator
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock problematic imports
vi.mock('@revealui/core/monitoring', () => ({
  registerProcess: vi.fn(),
  updateProcessStatus: vi.fn(),
}))

vi.mock('../../lib/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}))

import type { GraphFormat } from '../../commands/info/deps-graph.js'
import { generateDependencyGraph } from '../../commands/info/deps-graph.js'

describe('Dependency Graph Generator', () => {
  const testDir = join(process.cwd(), '.test-dep-graph')
  const scriptsDir = join(testDir, 'scripts')

  beforeEach(() => {
    // Create test directory structure
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(scriptsDir, { recursive: true })
  })

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  const createTestFile = (relativePath: string, content: string) => {
    const fullPath = join(scriptsDir, relativePath)
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(fullPath, content, 'utf-8')
  }

  describe('mermaid format', () => {
    it('should generate mermaid graph for simple dependency', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - File B
 */
import { b } from './b.js'
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
import fs from 'node:fs'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'mermaid',
      })

      expect(result).toContain('graph TD')
      expect(result).toContain('a.ts')
      expect(result).toContain('b.ts')
      expect(result).toContain('-->')
    })

    it('should highlight circular dependencies in mermaid', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - File B
 */
import { b } from './b.js'
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - scripts/a.ts - File A
 */
import { a } from './a.js'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'mermaid',
      })

      // Should highlight the cycle (typically with different styling)
      expect(result).toContain('a.ts')
      expect(result).toContain('b.ts')
      // Circular dependencies usually marked with thick arrows or different color
      expect(result).toMatch(/===|style.*fill:#ff0000/i)
    })

    it('should group nodes by directory in mermaid', () => {
      createTestFile(
        'cli/a.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
import fs from 'node:fs'
`,
      )

      createTestFile(
        'lib/b.ts',
        `/**
 * @dependencies
 * - node:path - Path operations
 */
import path from 'node:path'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'mermaid',
        groupBy: 'directory',
      })

      expect(result).toContain('subgraph')
      expect(result).toContain('cli')
      expect(result).toContain('lib')
    })
  })

  describe('json format', () => {
    it('should generate valid JSON', () => {
      createTestFile(
        'test.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
import fs from 'node:fs'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      expect(() => JSON.parse(result)).not.toThrow()
    })

    it('should include nodes and edges in JSON', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - File B
 */
import { b } from './b.js'
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
import fs from 'node:fs'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      const graph = JSON.parse(result)
      expect(graph.nodes).toBeDefined()
      expect(graph.edges).toBeDefined()
      expect(Array.isArray(graph.nodes)).toBe(true)
      expect(Array.isArray(graph.edges)).toBe(true)
    })

    it('should include circular dependency information in JSON', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - File B
 */
import { b } from './b.js'
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - scripts/a.ts - File A
 */
import { a } from './a.js'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      const graph = JSON.parse(result)
      expect(graph.cycles).toBeDefined()
      expect(Array.isArray(graph.cycles)).toBe(true)
      expect(graph.cycles.length).toBeGreaterThan(0)
    })

    it('should include missing dependency information in JSON', () => {
      createTestFile(
        'test.ts',
        `/**
 * @dependencies
 * - scripts/nonexistent.ts - Missing file
 */
import { missing } from './nonexistent.js'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      const graph = JSON.parse(result)
      expect(graph.missing).toBeDefined()
      expect(Array.isArray(graph.missing)).toBe(true)
      expect(graph.missing.length).toBeGreaterThan(0)
    })
  })

  describe('dot format', () => {
    it('should generate valid DOT format', () => {
      createTestFile(
        'test.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
import fs from 'node:fs'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'dot',
      })

      expect(result).toContain('digraph')
      expect(result).toContain('{')
      expect(result).toContain('}')
      expect(result).toContain('->')
    })

    it('should include nodes and edges in DOT', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - File B
 */
import { b } from './b.js'
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
import fs from 'node:fs'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'dot',
      })

      expect(result).toContain('a.ts')
      expect(result).toContain('b.ts')
      expect(result).toContain('->')
    })

    it('should style circular dependencies in DOT', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - File B
 */
import { b } from './b.js'
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - scripts/a.ts - File A
 */
import { a } from './a.js'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'dot',
      })

      // Circular dependencies typically have special styling
      expect(result).toMatch(/color|style|penwidth/i)
    })
  })

  describe('filtering options', () => {
    it('should filter by scope', () => {
      createTestFile(
        'cli/a.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
import fs from 'node:fs'
`,
      )

      createTestFile(
        'lib/b.ts',
        `/**
 * @dependencies
 * - node:path - Path operations
 */
import path from 'node:path'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
        scope: 'cli',
      })

      const graph = JSON.parse(result)
      expect(graph.nodes.length).toBe(1)
      expect(graph.nodes[0].relativePath).toContain('cli')
    })

    it('should filter by type', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - File dependency
 * - node:fs - Package dependency
 */
import { b } from './b.js'
import fs from 'node:fs'
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - node:path - Package dependency
 */
import path from 'node:path'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
        includeTypes: ['file'],
      })

      const graph = JSON.parse(result)
      const fileEdges = graph.edges.filter((e: any) => e.type === 'file')
      const packageEdges = graph.edges.filter((e: any) => e.type === 'package')

      expect(fileEdges.length).toBeGreaterThan(0)
      expect(packageEdges.length).toBe(0)
    })

    it('should exclude package dependencies when requested', () => {
      createTestFile(
        'test.ts',
        `/**
 * @dependencies
 * - scripts/lib.ts - Internal
 * - node:fs - External
 */
import { lib } from './lib.js'
import fs from 'node:fs'
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
        includeTypes: ['file'],
      })

      const graph = JSON.parse(result)
      const edges = graph.edges

      // Should only have file edges
      expect(edges.every((e: any) => e.type === 'file')).toBe(true)
    })
  })

  describe('grouping options', () => {
    it('should group by directory', () => {
      createTestFile(
        'cli/a.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
`,
      )

      createTestFile(
        'cli/b.ts',
        `/**
 * @dependencies
 * - node:path - Path operations
 */
`,
      )

      createTestFile(
        'lib/c.ts',
        `/**
 * @dependencies
 * - node:util - Utilities
 */
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
        groupBy: 'directory',
      })

      const graph = JSON.parse(result)
      // When grouped, nodes should have directory metadata
      expect(graph.nodes.some((n: any) => n.relativePath.startsWith('cli'))).toBe(true)
      expect(graph.nodes.some((n: any) => n.relativePath.startsWith('lib'))).toBe(true)
    })

    it('should group by type', () => {
      createTestFile(
        'test.ts',
        `/**
 * @dependencies
 * - scripts/lib.ts - Internal
 * - node:fs - External
 */
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
        groupBy: 'type',
      })

      const graph = JSON.parse(result)
      // Edges should be categorized by type
      const fileEdges = graph.edges.filter((e: any) => e.type === 'file')
      const packageEdges = graph.edges.filter((e: any) => e.type === 'package')

      expect(fileEdges.length + packageEdges.length).toBe(graph.edges.length)
    })
  })

  describe('complex dependency graphs', () => {
    it('should handle multiple levels of dependencies', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - Level 1
 */
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - scripts/c.ts - Level 2
 */
`,
      )

      createTestFile(
        'c.ts',
        `/**
 * @dependencies
 * - scripts/d.ts - Level 3
 */
`,
      )

      createTestFile(
        'd.ts',
        `/**
 * @dependencies
 * - node:fs - External
 */
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      const graph = JSON.parse(result)
      expect(graph.nodes.length).toBe(4)
      expect(graph.edges.length).toBeGreaterThanOrEqual(3)
    })

    it('should handle diamond dependencies (A -> B,C; B,C -> D)', () => {
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - Dep B
 * - scripts/c.ts - Dep C
 */
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - scripts/d.ts - Common dep
 */
`,
      )

      createTestFile(
        'c.ts',
        `/**
 * @dependencies
 * - scripts/d.ts - Common dep
 */
`,
      )

      createTestFile(
        'd.ts',
        `/**
 * @dependencies
 * - node:fs - External
 */
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      const graph = JSON.parse(result)
      expect(graph.nodes.length).toBe(4)

      // D should be referenced by both B and C
      const edgesToD = graph.edges.filter((e: any) => e.to.includes('d.ts'))
      expect(edgesToD.length).toBeGreaterThanOrEqual(2)
    })

    it('should detect multiple circular dependencies', () => {
      // Cycle 1: A <-> B
      createTestFile(
        'a.ts',
        `/**
 * @dependencies
 * - scripts/b.ts - File B
 */
`,
      )

      createTestFile(
        'b.ts',
        `/**
 * @dependencies
 * - scripts/a.ts - File A
 */
`,
      )

      // Cycle 2: C <-> D
      createTestFile(
        'c.ts',
        `/**
 * @dependencies
 * - scripts/d.ts - File D
 */
`,
      )

      createTestFile(
        'd.ts',
        `/**
 * @dependencies
 * - scripts/c.ts - File C
 */
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      const graph = JSON.parse(result)
      expect(graph.cycles.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty scripts directory', () => {
      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      const graph = JSON.parse(result)
      expect(graph.nodes).toHaveLength(0)
      expect(graph.edges).toHaveLength(0)
    })

    it('should handle files with no dependencies', () => {
      createTestFile(
        'standalone.ts',
        `/**
 * No dependencies
 */
console.log('standalone')
`,
      )

      const result = generateDependencyGraph(testDir, {
        format: 'json',
      })

      const graph = JSON.parse(result)
      expect(graph.nodes.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle all three formats without errors', () => {
      createTestFile(
        'test.ts',
        `/**
 * @dependencies
 * - node:fs - File system
 */
`,
      )

      const formats: GraphFormat[] = ['mermaid', 'json', 'dot']

      for (const format of formats) {
        expect(() => {
          generateDependencyGraph(testDir, { format })
        }).not.toThrow()
      }
    })
  })
})
