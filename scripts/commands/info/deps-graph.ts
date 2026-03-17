#!/usr/bin/env tsx
/**
 * Dependency Graph Generator
 *
 * Generates visual dependency graphs from @dependencies headers.
 * Outputs in multiple formats: Mermaid, JSON, DOT (Graphviz).
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:path - Path manipulation
 * - scripts/commands/validate/validate-dependencies.ts - Dependency validation and graph building
 * - scripts/lib/index.js - Logger utilities
 *
 * @example
 * ```bash
 * # Generate Mermaid diagram
 * pnpm info deps:graph --format mermaid --output docs/DEPENDENCY_GRAPH.md
 *
 * # Generate JSON for programmatic access
 * pnpm info deps:graph --format json --output deps.json
 *
 * # Generate DOT for Graphviz
 * pnpm info deps:graph --format dot --output deps.dot
 *
 * # Filter by scope
 * pnpm info deps:graph --scope cli --format mermaid
 * ```
 */

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ErrorCode, ScriptError } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/index.js';
import {
  type DependencyGraph,
  type ScriptNode,
  validateDependencies,
} from '../validate/validate-dependencies.js';

const logger = createLogger({ prefix: 'DepsGraph' });

// =============================================================================
// Types
// =============================================================================

export type GraphFormat = 'mermaid' | 'json' | 'dot';

export interface GraphOptions {
  format: GraphFormat;
  output?: string;
  scope?: string;
  depth?: number;
  includePackages?: boolean;
  highlightCycles?: boolean;
}

// =============================================================================
// Mermaid Generation
// =============================================================================

/**
 * Generate Mermaid flowchart diagram
 */
function generateMermaid(graph: DependencyGraph, options: Partial<GraphOptions> = {}): string {
  const { scope, includePackages = false, highlightCycles = true } = options;

  let mermaid = '```mermaid\ngraph TD\n';

  // Filter nodes by scope
  let nodes = graph.nodes;
  if (scope) {
    nodes = nodes.filter((n) => n.relativePath.startsWith(`scripts/${scope}/`));
  }

  // Create node definitions with groups
  const nodeGroups = new Map<string, ScriptNode[]>();
  for (const node of nodes) {
    const parts = node.relativePath.split('/');
    const group = parts.length > 2 ? parts[1] : 'other';

    if (!nodeGroups.has(group)) {
      nodeGroups.set(group, []);
    }
    nodeGroups.get(group)?.push(node);
  }

  // Generate subgraphs for each group
  for (const [group, groupNodes] of nodeGroups) {
    mermaid += `\n  subgraph ${group}[${group}]\n`;

    for (const node of groupNodes) {
      const id = sanitizeNodeId(node.relativePath);
      const label = node.relativePath.split('/').pop()?.replace('.ts', '') || node.relativePath;
      mermaid += `    ${id}["${label}"]\n`;
    }

    mermaid += '  end\n';
  }

  // Add edges
  mermaid += '\n  %% Dependencies\n';
  const nodeIds = new Set(nodes.map((n) => n.relativePath));
  const cycleEdges = new Set<string>();

  // Mark cycle edges
  if (highlightCycles) {
    for (const cycle of graph.cycles) {
      for (let i = 0; i < cycle.nodes.length - 1; i++) {
        const from = cycle.nodes[i];
        const to = cycle.nodes[i + 1];
        cycleEdges.add(`${from}->${to}`);
      }
    }
  }

  for (const edge of graph.edges) {
    if (edge.type === 'package' && !includePackages) continue;
    if (!nodeIds.has(edge.from)) continue;

    const toNode = nodes.find((n) => n.relativePath === edge.to);
    if (!(toNode || includePackages)) continue;

    const fromId = sanitizeNodeId(edge.from);
    const toId = edge.type === 'package' ? sanitizeNodeId(edge.to) : sanitizeNodeId(edge.to);

    const isCycle = cycleEdges.has(`${edge.from}->${edge.to}`);
    const style = isCycle ? '-.->|cycle|' : '-->';

    if (edge.type === 'package') {
      mermaid += `  ${fromId} ${style} ${toId}{{${edge.to}}}\n`;
    } else {
      mermaid += `  ${fromId} ${style} ${toId}\n`;
    }
  }

  // Add styling for cycles
  if (highlightCycles && graph.cycles.length > 0) {
    mermaid += '\n  %% Highlight cycles\n';
    for (const cycle of graph.cycles) {
      for (const node of cycle.nodes.slice(0, -1)) {
        if (nodeIds.has(node)) {
          const id = sanitizeNodeId(node);
          mermaid += `  style ${id} fill:#ff6b6b\n`;
        }
      }
    }
  }

  mermaid += '```\n';
  return mermaid;
}

/**
 * Sanitize node ID for Mermaid
 */
function sanitizeNodeId(path: string): string {
  return path.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
}

// =============================================================================
// JSON Generation
// =============================================================================

/**
 * Generate JSON representation
 */
function generateJSON(graph: DependencyGraph, options: Partial<GraphOptions> = {}): string {
  const { scope, includePackages = false } = options;

  // Filter by scope
  let nodes = graph.nodes;
  let edges = graph.edges;

  if (scope) {
    nodes = nodes.filter((n) => n.relativePath.startsWith(`scripts/${scope}/`));
    const nodeIds = new Set(nodes.map((n) => n.relativePath));
    edges = edges.filter((e) => nodeIds.has(e.from));
  }

  if (!includePackages) {
    edges = edges.filter((e) => e.type !== 'package');
  }

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalNodes: nodes.length,
      totalEdges: edges.length,
      cycles: graph.cycles.length,
    },
    nodes: nodes.map((n) => ({
      path: n.relativePath,
      hasDocumentation: n.hasDocumentation,
      dependencies: {
        files: n.fileDependencies.map((d) => ({
          path: d.path,
          description: d.description,
          exists: d.exists,
        })),
        packages: n.packageDependencies,
        envVariables: n.envVariables,
        externalTools: n.externalTools,
        scripts: n.scriptDependencies,
      },
      imports: n.actualImports,
    })),
    edges: edges.map((e) => ({
      from: e.from,
      to: e.to,
      type: e.type,
    })),
    cycles: graph.cycles.map((c) => ({
      nodes: c.nodes,
      severity: c.severity,
    })),
    missing: graph.missing.map((m) => ({
      from: m.from,
      to: m.to,
      type: m.type,
    })),
  };

  return JSON.stringify(output, null, 2);
}

// =============================================================================
// DOT Generation
// =============================================================================

/**
 * Generate DOT (Graphviz) format
 */
function generateDOT(graph: DependencyGraph, options: Partial<GraphOptions> = {}): string {
  const { scope, includePackages = false, highlightCycles = true } = options;

  let dot = 'digraph Dependencies {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style=rounded];\n\n';

  // Filter nodes
  let nodes = graph.nodes;
  if (scope) {
    nodes = nodes.filter((n) => n.relativePath.startsWith(`scripts/${scope}/`));
  }

  // Group nodes by directory
  const nodeGroups = new Map<string, ScriptNode[]>();
  for (const node of nodes) {
    const parts = node.relativePath.split('/');
    const group = parts.length > 2 ? parts[1] : 'other';

    if (!nodeGroups.has(group)) {
      nodeGroups.set(group, []);
    }
    nodeGroups.get(group)?.push(node);
  }

  // Generate clusters for each group
  let clusterIndex = 0;
  for (const [group, groupNodes] of nodeGroups) {
    dot += `  subgraph cluster_${clusterIndex} {\n`;
    dot += `    label="${group}";\n`;
    dot += `    style=filled;\n`;
    dot += `    color=lightgrey;\n\n`;

    for (const node of groupNodes) {
      const id = sanitizeDOTNodeId(node.relativePath);
      const label = node.relativePath.split('/').pop()?.replace('.ts', '') || node.relativePath;
      dot += `    "${id}" [label="${label}"];\n`;
    }

    dot += '  }\n\n';
    clusterIndex++;
  }

  // Add edges
  const nodeIds = new Set(nodes.map((n) => n.relativePath));
  const cycleEdges = new Set<string>();

  if (highlightCycles) {
    for (const cycle of graph.cycles) {
      for (let i = 0; i < cycle.nodes.length - 1; i++) {
        cycleEdges.add(`${cycle.nodes[i]}->${cycle.nodes[i + 1]}`);
      }
    }
  }

  for (const edge of graph.edges) {
    if (edge.type === 'package' && !includePackages) continue;
    if (!nodeIds.has(edge.from)) continue;

    const toNode = nodes.find((n) => n.relativePath === edge.to);
    if (!toNode && edge.type !== 'package') continue;

    const fromId = sanitizeDOTNodeId(edge.from);
    const toId = sanitizeDOTNodeId(edge.to);

    const isCycle = cycleEdges.has(`${edge.from}->${edge.to}`);
    const style = isCycle ? ' [color=red, style=dashed]' : '';

    if (edge.type === 'package') {
      dot += `  "${fromId}" -> "${toId}" [label="pkg"${style}];\n`;
    } else {
      dot += `  "${fromId}" -> "${toId}"${style};\n`;
    }
  }

  dot += '}\n';
  return dot;
}

/**
 * Sanitize node ID for DOT
 */
function sanitizeDOTNodeId(path: string): string {
  return path.replace(/\//g, '_').replace(/\./g, '_');
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate dependency graph in specified format
 */
export function generateDependencyGraph(rootDir: string, options: GraphOptions): string {
  logger.info(`Generating dependency graph (format: ${options.format})`);

  // Get dependency graph from validator
  const result = validateDependencies(rootDir, { verbose: false });
  const graph = result.graph;

  // Generate based on format
  switch (options.format) {
    case 'mermaid':
      return generateMermaid(graph, options);
    case 'json':
      return generateJSON(graph, options);
    case 'dot':
      return generateDOT(graph, options);
    default:
      throw new ScriptError(`Unsupported format: ${options.format}`, ErrorCode.VALIDATION_ERROR);
  }
}

// =============================================================================
// CLI
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootDir = resolve(join(import.meta.dirname, '../../..'));

  // Parse arguments
  const args = process.argv.slice(2);

  const formatArg = args.find((arg) => arg.startsWith('--format='));
  const outputArg = args.find((arg) => arg.startsWith('--output='));
  const scopeArg = args.find((arg) => arg.startsWith('--scope='));
  const depthArg = args.find((arg) => arg.startsWith('--depth='));

  const format = (formatArg?.split('=')[1] || 'mermaid') as GraphFormat;
  const output = outputArg?.split('=')[1];
  const scope = scopeArg?.split('=')[1];
  const depth = depthArg ? Number.parseInt(depthArg.split('=')[1], 10) : undefined;
  const includePackages = args.includes('--include-packages');

  // Generate graph
  const graphContent = generateDependencyGraph(rootDir, {
    format,
    scope,
    depth,
    includePackages,
    highlightCycles: true,
  });

  // Output
  if (output) {
    const outputPath = resolve(rootDir, output);
    writeFileSync(outputPath, graphContent);
    logger.info(`Graph saved to: ${output}`);
  } else {
    console.log(graphContent);
  }
}
