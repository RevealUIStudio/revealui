import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import glob from 'fast-glob'
import { ErrorCode, ScriptError } from '../errors.js'

/**
 * Node type classification
 */
export type NodeType = 'script' | 'lib' | 'external'

/**
 * Dependency node in the graph
 */
export interface DependencyNode {
  path: string
  name: string
  imports: string[]
  importedBy: string[]
  type: NodeType
  depth: number
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>
  entryPoints: string[]
  leafNodes: string[]
  circularDependencies: string[][]
  stats: {
    totalNodes: number
    totalEdges: number
    maxDepth: number
    averageDependencies: number
    externalDependencies: number
  }
}

/**
 * Options for dependency analysis
 */
export interface AnalysisOptions {
  rootDir: string
  entryFiles?: string[]
  includeExternal?: boolean
  maxDepth?: number
  excludePatterns?: string[]
}

/**
 * Options for Mermaid diagram generation
 */
export interface MermaidOptions {
  direction?: 'TB' | 'LR' | 'RL' | 'BT'
  showExternal?: boolean
  highlightCircular?: boolean
  maxDepth?: number
  groupByDirectory?: boolean
}

/**
 * Dependency Analyzer class for visualizing script dependencies
 */
export class DependencyAnalyzer {
  private graph: DependencyGraph | null = null

  /**
   * Analyze dependencies starting from entry points
   */
  async analyze(options: AnalysisOptions): Promise<DependencyGraph> {
    const {
      rootDir,
      entryFiles = [],
      includeExternal = false,
      maxDepth = 10,
      excludePatterns = ['node_modules', '.git', 'dist', 'build'],
    } = options

    // Initialize graph
    const nodes = new Map<string, DependencyNode>()

    // Find entry files if not provided
    let entries = entryFiles
    if (entries.length === 0) {
      entries = await glob('scripts/cli/*.ts', {
        cwd: rootDir,
        absolute: true,
      })
    }

    // Build graph from each entry point
    for (const entry of entries) {
      await this.buildGraph(entry, rootDir, nodes, 0, maxDepth, includeExternal, excludePatterns)
    }

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(nodes)

    // Calculate statistics
    const stats = this.calculateStatistics(nodes)

    // Find entry points (nodes with no importedBy)
    const entryPoints = Array.from(nodes.values())
      .filter((node) => node.importedBy.length === 0)
      .map((node) => node.path)

    // Find leaf nodes (nodes with no imports)
    const leafNodes = Array.from(nodes.values())
      .filter((node) => node.imports.length === 0)
      .map((node) => node.path)

    this.graph = {
      nodes,
      entryPoints,
      leafNodes,
      circularDependencies,
      stats,
    }

    return this.graph
  }

  /**
   * Build dependency graph recursively
   */
  private async buildGraph(
    filePath: string,
    rootDir: string,
    nodes: Map<string, DependencyNode>,
    depth: number,
    maxDepth: number,
    includeExternal: boolean,
    excludePatterns: string[],
  ): Promise<void> {
    // Check depth limit
    if (depth > maxDepth) {
      return
    }

    // Skip if already processed
    if (nodes.has(filePath)) {
      return
    }

    // Check if file should be excluded
    const relativePath = relative(rootDir, filePath)
    if (excludePatterns.some((pattern) => relativePath.includes(pattern))) {
      return
    }

    // Classify node type
    const type = this.classifyNode(filePath, rootDir)

    // Skip external nodes if not including them
    if (type === 'external' && !includeExternal) {
      return
    }

    // Extract imports
    const imports = await this.extractImports(filePath, rootDir)

    // Create node
    const node: DependencyNode = {
      path: filePath,
      name: relativePath,
      imports: [],
      importedBy: [],
      type,
      depth,
    }

    nodes.set(filePath, node)

    // Process each import
    for (const importPath of imports) {
      const resolvedPath = this.resolveImport(importPath, filePath, rootDir)

      if (resolvedPath) {
        // Add to imports
        node.imports.push(resolvedPath)

        // Recursively process import
        await this.buildGraph(
          resolvedPath,
          rootDir,
          nodes,
          depth + 1,
          maxDepth,
          includeExternal,
          excludePatterns,
        )

        // Add reverse dependency
        const importedNode = nodes.get(resolvedPath)
        if (importedNode) {
          importedNode.importedBy.push(filePath)
        }
      }
    }
  }

  /**
   * Extract import statements from a file
   */
  private async extractImports(filePath: string, _rootDir: string): Promise<string[]> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const imports: string[] = []

      // Match ES6 imports: import ... from '...'
      const importRegex = /import\s+(?:[\w\s{},*]*\s+from\s+)?['"](.*?)['"]/g
      let match: RegExpExecArray | null

      // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1])
      }

      // Match dynamic imports: import('...')
      const dynamicImportRegex = /import\s*\(\s*['"](.*?)['"]\s*\)/g

      // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
      while ((match = dynamicImportRegex.exec(content)) !== null) {
        imports.push(match[1])
      }

      // Match require: require('...')
      const requireRegex = /require\s*\(\s*['"](.*?)['"]\s*\)/g

      // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
      while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1])
      }

      return imports
    } catch (_error) {
      // File not readable or doesn't exist
      return []
    }
  }

  /**
   * Classify node type based on path
   */
  private classifyNode(filePath: string, rootDir: string): NodeType {
    const relativePath = relative(rootDir, filePath)

    // Check if it's outside the project or in node_modules
    if (relativePath.startsWith('..') || relativePath.includes('node_modules')) {
      return 'external'
    }

    // Check if it's a CLI script
    if (relativePath.startsWith('scripts/cli/')) {
      return 'script'
    }

    // Check if it's a library file
    if (relativePath.startsWith('scripts/lib/')) {
      return 'lib'
    }

    // Default to lib
    return 'lib'
  }

  /**
   * Resolve import path to absolute path
   */
  private resolveImport(importPath: string, fromFile: string, _rootDir: string): string | null {
    // Skip external packages (non-relative imports)
    if (!importPath.startsWith('.')) {
      // External package
      return null
    }

    try {
      const fromDir = dirname(fromFile)
      let resolved = resolve(fromDir, importPath)

      // Handle TypeScript ESM: imports use .js but files are .ts
      if (resolved.endsWith('.js')) {
        resolved = resolved.replace(/\.js$/, '.ts')
      } else if (!(resolved.endsWith('.ts') || resolved.endsWith('.js'))) {
        // Add .ts extension if no extension
        resolved = `${resolved}.ts`
      }

      return resolved
    } catch (_error) {
      return null
    }
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(nodes: Map<string, DependencyNode>): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const pathStack: string[] = []

    const dfs = (nodePath: string): void => {
      visited.add(nodePath)
      recursionStack.add(nodePath)
      pathStack.push(nodePath)

      const node = nodes.get(nodePath)
      if (!node) return

      for (const importPath of node.imports) {
        if (!nodes.has(importPath)) continue

        if (!visited.has(importPath)) {
          dfs(importPath)
        } else if (recursionStack.has(importPath)) {
          // Found a cycle
          const cycleStart = pathStack.indexOf(importPath)
          const cycle = pathStack.slice(cycleStart)
          cycle.push(importPath) // Complete the cycle

          // Check if this cycle is already recorded (in any rotation)
          const cycleKey = cycle.join('|')
          const isDuplicate = cycles.some((existingCycle) => {
            const existingKey = existingCycle.join('|')
            return cycleKey.includes(existingKey) || existingKey.includes(cycleKey)
          })

          if (!isDuplicate) {
            cycles.push(cycle)
          }
        }
      }

      pathStack.pop()
      recursionStack.delete(nodePath)
    }

    // Run DFS from each unvisited node
    for (const nodePath of nodes.keys()) {
      if (!visited.has(nodePath)) {
        dfs(nodePath)
      }
    }

    return cycles
  }

  /**
   * Calculate graph statistics
   */
  private calculateStatistics(nodes: Map<string, DependencyNode>): DependencyGraph['stats'] {
    let totalEdges = 0
    let maxDepth = 0
    let externalDependencies = 0

    for (const node of nodes.values()) {
      totalEdges += node.imports.length
      maxDepth = Math.max(maxDepth, node.depth)
      if (node.type === 'external') {
        externalDependencies++
      }
    }

    const averageDependencies = nodes.size > 0 ? totalEdges / nodes.size : 0

    return {
      totalNodes: nodes.size,
      totalEdges,
      maxDepth,
      averageDependencies: Number(averageDependencies.toFixed(2)),
      externalDependencies,
    }
  }

  /**
   * Generate Mermaid diagram
   */
  generateMermaidDiagram(options: MermaidOptions = {}): string {
    if (!this.graph) {
      throw new ScriptError('No graph available. Run analyze() first.', ErrorCode.INVALID_STATE)
    }

    const { direction = 'TB', showExternal = false, highlightCircular = true, maxDepth } = options

    const lines: string[] = []
    lines.push(`graph ${direction}`)

    // Flatten circular dependencies for quick lookup
    const circularNodes = new Set<string>()
    const circularEdges = new Set<string>()

    if (highlightCircular) {
      for (const cycle of this.graph.circularDependencies) {
        for (let i = 0; i < cycle.length - 1; i++) {
          circularNodes.add(cycle[i])
          circularEdges.add(`${cycle[i]}|${cycle[i + 1]}`)
        }
      }
    }

    // Generate node declarations
    for (const node of this.graph.nodes.values()) {
      // Skip external nodes if not showing them
      if (node.type === 'external' && !showExternal) continue

      // Skip nodes beyond maxDepth if specified
      if (maxDepth !== undefined && node.depth > maxDepth) continue

      // Create a safe node ID (replace special characters)
      const nodeId = this.sanitizeNodeId(node.path)
      const label = this.getNodeLabel(node)

      // Determine node shape based on type
      let nodeDeclaration: string
      if (node.type === 'script') {
        nodeDeclaration = `  ${nodeId}([${label}])`
      } else if (node.type === 'external') {
        nodeDeclaration = `  ${nodeId}{{${label}}}`
      } else {
        nodeDeclaration = `  ${nodeId}[${label}]`
      }

      // Add circular highlight
      if (circularNodes.has(node.path)) {
        nodeDeclaration += ':::circular'
      }

      lines.push(nodeDeclaration)
    }

    // Generate edges
    for (const node of this.graph.nodes.values()) {
      // Skip external nodes if not showing them
      if (node.type === 'external' && !showExternal) continue

      // Skip nodes beyond maxDepth if specified
      if (maxDepth !== undefined && node.depth > maxDepth) continue

      const fromId = this.sanitizeNodeId(node.path)

      for (const importPath of node.imports) {
        const importNode = this.graph.nodes.get(importPath)
        if (!importNode) continue

        // Skip external nodes if not showing them
        if (importNode.type === 'external' && !showExternal) continue

        // Skip nodes beyond maxDepth if specified
        if (maxDepth !== undefined && importNode.depth > maxDepth) continue

        const toId = this.sanitizeNodeId(importPath)
        const edgeKey = `${node.path}|${importPath}`

        // Use different edge style for circular dependencies
        if (circularEdges.has(edgeKey)) {
          lines.push(`  ${fromId} -.->|circular| ${toId}`)
        } else {
          lines.push(`  ${fromId} --> ${toId}`)
        }
      }
    }

    // Add styling for circular nodes
    if (circularNodes.size > 0) {
      lines.push('  classDef circular fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px')
    }

    return lines.join('\n')
  }

  /**
   * Find all paths between two nodes
   */
  findPaths(fromPath: string, toPath: string, maxPaths = 10): string[][] {
    if (!this.graph) {
      throw new ScriptError('No graph available. Run analyze() first.', ErrorCode.INVALID_STATE)
    }

    const paths: string[][] = []
    const visited = new Set<string>()

    const dfs = (currentPath: string, path: string[]): void => {
      if (paths.length >= maxPaths) return

      if (currentPath === toPath) {
        paths.push([...path, currentPath])
        return
      }

      if (visited.has(currentPath)) return

      visited.add(currentPath)
      path.push(currentPath)

      const node = this.graph?.nodes.get(currentPath)
      if (node) {
        for (const importPath of node.imports) {
          dfs(importPath, path)
        }
      }

      path.pop()
      visited.delete(currentPath)
    }

    dfs(fromPath, [])

    return paths
  }

  /**
   * Get the current graph
   */
  getGraph(): DependencyGraph | null {
    return this.graph
  }

  /**
   * Sanitize node ID for Mermaid
   */
  private sanitizeNodeId(path: string): string {
    return path.replace(/[^a-zA-Z0-9]/g, '_')
  }

  /**
   * Get display label for node
   */
  private getNodeLabel(node: DependencyNode): string {
    const parts = node.name.split('/')
    return parts[parts.length - 1].replace(/\.(ts|js)$/, '')
  }
}

/**
 * Create a dependency analyzer instance
 */
export function createDependencyAnalyzer(projectRoot: string): DependencyAnalyzer {
  return new DependencyAnalyzer(projectRoot)
}
