import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import glob from 'fast-glob'
import {
  createDependencyAnalyzer,
  type DependencyNode,
} from '../lib/visualization/dependency-analyzer.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

class DepsCLI extends BaseCLI {
  name = 'deps'
  description = 'Dependency analysis and visualization'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'analyze',
        description: 'Analyze dependency graph',
        args: [
          {
            name: 'files',
            type: 'string',
            required: false,
            description: 'Entry files (glob pattern)',
          },
          {
            name: 'max-depth',
            type: 'number',
            description: 'Maximum depth to analyze',
          },
          {
            name: 'include-external',
            type: 'boolean',
            description: 'Include external dependencies',
          },
        ],
        handler: async () => {
          await this.analyzeDependencies()
          return undefined
        },
      },
      {
        name: 'graph',
        description: 'Generate Mermaid diagram',
        args: [
          {
            name: 'files',
            type: 'string',
            required: false,
            description: 'Entry files (glob pattern)',
          },
          {
            name: 'max-depth',
            type: 'number',
            description: 'Maximum depth to visualize',
          },
          {
            name: 'direction',
            type: 'string',
            description: 'Graph direction (TB, LR, RL, BT)',
          },
          {
            name: 'output',
            short: 'o',
            type: 'string',
            description: 'Output file path',
          },
          {
            name: 'show-external',
            type: 'boolean',
            description: 'Show external dependencies',
          },
          {
            name: 'no-highlight',
            type: 'boolean',
            description: 'Disable circular dependency highlighting',
          },
        ],
        handler: async () => {
          await this.generateGraph()
          return undefined
        },
      },
      {
        name: 'circular',
        description: 'Find circular dependencies',
        args: [
          {
            name: 'max-depth',
            type: 'number',
            description: 'Maximum depth to analyze',
          },
        ],
        handler: async () => {
          await this.findCircularDependencies()
          return undefined
        },
      },
      {
        name: 'path',
        description: 'Find dependency paths between two files',
        args: [
          {
            name: 'from',
            type: 'string',
            required: true,
            description: 'Source file',
          },
          {
            name: 'to',
            type: 'string',
            required: true,
            description: 'Target file',
          },
          {
            name: 'max-paths',
            type: 'number',
            description: 'Maximum number of paths to find',
          },
        ],
        handler: async () => {
          await this.findPaths()
          return undefined
        },
      },
    ]
  }

  private async analyzeDependencies(): Promise<void> {
    const filesPattern = this.getPositional(0) || 'scripts/cli/*.ts'
    const maxDepth = this.getFlag('max-depth', 10)
    const includeExternal = this.getFlag('include-external', false)

    const analyzer = createDependencyAnalyzer(this.projectRoot)

    // Resolve entry files
    const entryFiles = await glob(filesPattern, {
      cwd: this.projectRoot,
      absolute: true,
    })

    if (entryFiles.length === 0) {
      throw new Error(`No files found matching pattern: ${filesPattern}`)
    }

    this.verbose(`Analyzing ${entryFiles.length} entry files...`)

    // Analyze dependencies
    const graph = await analyzer.analyze({
      rootDir: this.projectRoot,
      entryFiles,
      includeExternal,
      maxDepth,
    })

    if (this.args.flags.json) {
      // Convert Map to object for JSON serialization
      const nodesObj: Record<string, DependencyNode> = {}
      for (const [path, node] of graph.nodes.entries()) {
        nodesObj[path] = node
      }

      this.output.success({
        nodes: nodesObj,
        entryPoints: graph.entryPoints,
        leafNodes: graph.leafNodes,
        circularDependencies: graph.circularDependencies,
        stats: graph.stats,
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info('\n📊 Dependency Analysis\n')

    logger.info('Statistics:')
    logger.info(`  Total nodes: ${graph.stats.totalNodes}`)
    logger.info(`  Total edges: ${graph.stats.totalEdges}`)
    logger.info(`  Max depth: ${graph.stats.maxDepth}`)
    logger.info(`  Average dependencies: ${graph.stats.averageDependencies}`)
    if (includeExternal) {
      logger.info(`  External dependencies: ${graph.stats.externalDependencies}`)
    }
    logger.info('')

    logger.info(`Entry Points (${graph.entryPoints.length}):`)
    for (const entry of graph.entryPoints.slice(0, 10)) {
      const node = graph.nodes.get(entry)
      logger.info(`  • ${node?.name || entry}`)
    }
    if (graph.entryPoints.length > 10) {
      logger.info(`  ... and ${graph.entryPoints.length - 10} more`)
    }
    logger.info('')

    logger.info(`Leaf Nodes (${graph.leafNodes.length}):`)
    for (const leaf of graph.leafNodes.slice(0, 10)) {
      const node = graph.nodes.get(leaf)
      logger.info(`  • ${node?.name || leaf}`)
    }
    if (graph.leafNodes.length > 10) {
      logger.info(`  ... and ${graph.leafNodes.length - 10} more`)
    }
    logger.info('')

    if (graph.circularDependencies.length > 0) {
      logger.warning(`⚠️  Circular Dependencies Found (${graph.circularDependencies.length}):\n`)
      for (let i = 0; i < Math.min(graph.circularDependencies.length, 5); i++) {
        const cycle = graph.circularDependencies[i]
        logger.warning(`${i + 1}. Cycle of ${cycle.length - 1} files:`)
        for (let j = 0; j < cycle.length; j++) {
          const node = graph.nodes.get(cycle[j])
          const label = node?.name || cycle[j]
          const arrow = j === cycle.length - 1 ? '↻' : '↓'
          logger.warning(`   ${label} ${arrow}`)
        }
        logger.info('')
      }
    } else {
      logger.success('✓ No circular dependencies found\n')
    }
  }

  private async generateGraph(): Promise<void> {
    const filesPattern = this.getPositional(0) || 'scripts/cli/*.ts'
    const maxDepth = this.getFlag('max-depth', 3)
    const direction = this.getFlag('direction', 'TB') as 'TB' | 'LR' | 'RL' | 'BT'
    const outputPath = this.getFlag<string | undefined>('output', undefined)
    const showExternal = this.getFlag('show-external', false)
    const highlightCircular = !this.getFlag('no-highlight', false)

    const analyzer = createDependencyAnalyzer(this.projectRoot)

    // Resolve entry files
    const entryFiles = await glob(filesPattern, {
      cwd: this.projectRoot,
      absolute: true,
    })

    if (entryFiles.length === 0) {
      throw new Error(`No files found matching pattern: ${filesPattern}`)
    }

    this.verbose(`Analyzing ${entryFiles.length} entry files...`)

    // Analyze dependencies
    await analyzer.analyze({
      rootDir: this.projectRoot,
      entryFiles,
      includeExternal: showExternal,
      maxDepth,
    })

    // Generate diagram
    const diagram = analyzer.generateMermaidDiagram({
      direction,
      showExternal,
      highlightCircular,
      maxDepth,
    })

    // Save to file if output path specified
    if (outputPath) {
      const fullPath = resolve(this.projectRoot, outputPath)
      await writeFile(fullPath, diagram, 'utf-8')

      if (!this.args.flags.json) {
        this.output.getLogger().success(`✓ Saved to ${outputPath}\n`)
      }
    }

    if (this.args.flags.json) {
      this.output.success({
        diagram: diagram.split('\n'),
        saved: !!outputPath,
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info('\n📈 Mermaid Diagram\n')
    logger.info('```mermaid')
    logger.info(diagram)
    logger.info('```\n')
  }

  private async findCircularDependencies(): Promise<void> {
    const maxDepth = this.getFlag('max-depth', 10)

    const analyzer = createDependencyAnalyzer(this.projectRoot)

    // Find all TypeScript files in scripts directory
    const allFiles = await glob('scripts/**/*.ts', {
      cwd: this.projectRoot,
      absolute: true,
    })

    this.verbose(`Analyzing ${allFiles.length} files for circular dependencies...`)

    // Analyze dependencies
    const graph = await analyzer.analyze({
      rootDir: this.projectRoot,
      entryFiles: allFiles,
      includeExternal: false,
      maxDepth,
    })

    if (this.args.flags.json) {
      this.output.success({
        found: graph.circularDependencies.length > 0,
        count: graph.circularDependencies.length,
        cycles: graph.circularDependencies,
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    if (graph.circularDependencies.length === 0) {
      logger.success('\n✓ No circular dependencies found\n')
      return
    }

    logger.warning(`\n⚠️  Circular Dependencies Found (${graph.circularDependencies.length})\n`)

    for (let i = 0; i < graph.circularDependencies.length; i++) {
      const cycle = graph.circularDependencies[i]
      logger.warning(`${i + 1}. Cycle of ${cycle.length - 1} files:`)

      for (let j = 0; j < cycle.length; j++) {
        const node = graph.nodes.get(cycle[j])
        const label = node?.name || cycle[j]
        const arrow = j === cycle.length - 1 ? '↻' : '↓'
        logger.warning(`   ${label} ${arrow}`)
      }

      logger.info('')
    }

    // Exit with error code if circular dependencies found
    process.exitCode = 1
  }

  private async findPaths(): Promise<void> {
    const fromPath = this.requirePositional(0, 'from')
    const toPath = this.requirePositional(1, 'to')
    const maxPaths = this.getFlag('max-paths', 10)

    const analyzer = createDependencyAnalyzer(this.projectRoot)

    // Resolve full paths
    const fromFull = resolve(this.projectRoot, fromPath)
    const toFull = resolve(this.projectRoot, toPath)

    // Analyze dependencies starting from the 'from' file
    await analyzer.analyze({
      rootDir: this.projectRoot,
      entryFiles: [fromFull],
      includeExternal: false,
      maxDepth: 20,
    })

    // Find paths
    const paths = analyzer.findPaths(fromFull, toFull, maxPaths)

    if (this.args.flags.json) {
      this.output.success({
        from: fromPath,
        to: toPath,
        pathsFound: paths.length,
        paths,
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(`\n🔍 Dependency Paths: ${fromPath} → ${toPath}\n`)

    if (paths.length === 0) {
      logger.info('No paths found.\n')
      return
    }

    logger.info(`Found ${paths.length} path${paths.length > 1 ? 's' : ''}:\n`)

    const graph = analyzer.getGraph()

    for (let i = 0; i < paths.length; i++) {
      logger.info(`Path ${i + 1}:`)
      for (let j = 0; j < paths[i].length; j++) {
        const node = graph?.nodes.get(paths[i][j])
        const label = node?.name || paths[i][j]
        const arrow = j === paths[i].length - 1 ? '' : ' →'
        logger.info(`  ${label}${arrow}`)
      }
      logger.info('')
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(DepsCLI)
}

export { DepsCLI }
