#!/usr/bin/env tsx
/**
 * C11 incubate posture gate (ADR-007 / fleet-redundancy Phase 6).
 *
 * Surfaces that must stay unmounted from apps until a dedicated WIRE ticket:
 * - MCPHypervisor (packages/mcp)
 * - @revealui/ai/skills
 * - @revealui/ai/observability
 *
 * Exit 0 = incubate holds. Exit 1 = app production path imports incubating surface.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function isExemptAppPath(rel: string): boolean {
  const lower = rel.toLowerCase();
  if (lower.includes('__tests__') || lower.includes('/test/') || lower.includes('/tests/')) {
    return true;
  }
  if (lower.endsWith('.test.ts') || lower.endsWith('.test.tsx')) return true;
  if (lower.endsWith('.spec.ts') || lower.endsWith('.spec.tsx')) return true;
  if (lower.includes('/content/') || lower.includes('/public/')) return true;
  return false;
}

function walkFiles(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.next' ||
      entry.name === 'coverage'
    ) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    const ext = entry.name.includes('.') ? `.${entry.name.split('.').pop()}` : '';
    if (SOURCE_EXT.has(ext)) out.push(full);
  }
}

// Import/require forms only (comments may name the type without mounting it).
const FORBIDDEN: { label: string; needles: string[] }[] = [
  {
    label: 'MCPHypervisor',
    needles: [
      "from '@revealui/mcp/hypervisor'",
      'from "@revealui/mcp/hypervisor"',
      "from '@revealui/mcp/src/hypervisor",
      'from "@revealui/mcp/src/hypervisor',
      "require('@revealui/mcp/hypervisor'",
      'require("@revealui/mcp/hypervisor"',
      // named import of the class from package root
      'MCPHypervisor } from',
      'MCPHypervisor, ',
      '{ MCPHypervisor',
    ],
  },
  {
    label: '@revealui/ai/skills',
    needles: [
      "from '@revealui/ai/skills'",
      'from "@revealui/ai/skills"',
      "from '@revealui/ai/skills/",
      'from "@revealui/ai/skills/',
    ],
  },
  {
    label: '@revealui/ai/observability',
    needles: [
      "from '@revealui/ai/observability'",
      'from "@revealui/ai/observability"',
      "from '@revealui/ai/observability/",
      'from "@revealui/ai/observability/',
    ],
  },
];

function main(): void {
  const errors: string[] = [];
  const files: string[] = [];
  walkFiles(join(REPO_ROOT, 'apps'), files);

  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
    if (isExemptAppPath(rel)) continue;
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const rule of FORBIDDEN) {
      for (const n of rule.needles) {
        if (source.includes(n)) {
          errors.push(
            `${rel}: imports incubating surface ${rule.label} (ADR-007; needs WIRE ticket first)`,
          );
          break;
        }
      }
    }
  }

  console.log('\n================================================================');
  console.log('  C11 incubate posture (ADR-007)');
  console.log('================================================================');

  if (errors.length === 0) {
    console.log('  ✓ no apps/* production imports of MCPHypervisor');
    console.log('  ✓ no apps/* production imports of @revealui/ai/skills');
    console.log('  ✓ no apps/* production imports of @revealui/ai/observability');
    console.log('================================================================\n');
    process.exit(0);
  }

  for (const e of errors) {
    console.log(`  ✗ ${e}`);
  }
  console.log('================================================================\n');
  process.exit(1);
}

main();
