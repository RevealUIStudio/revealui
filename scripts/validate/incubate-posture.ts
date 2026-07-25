#!/usr/bin/env tsx
/**
 * C11 incubate posture gate (ADR-007 / fleet-redundancy Phase 6).
 *
 * Surfaces that must stay unmounted from apps until a dedicated WIRE ticket:
 * - MCPHypervisor (packages/mcp)
 * - @revealui/ai/skills
 * - @revealui/ai/observability
 * - @revealui/harnesses workboard (WorkboardManager) — GAP-421 §8
 * - @revealui/harnesses detection/adapters (autoDetectHarnesses,
 *   findAllHarnessProcesses/findClaudeCodeSockets/findHarnessProcesses/
 *   findProcesses) — GAP-421 §8. `adapters/` has no exported symbol of its
 *   own (the three adapter classes are not re-exported from the package
 *   root); it is only reachable through `autoDetectHarnesses`, so gating
 *   that entry point covers both modules.
 * - @revealui/harnesses registry (HarnessRegistry) — GAP-421 §8
 *
 * The harnesses entries route the GAP-421 routing audit's INCUBATE set (§7,
 * §8: `workboard/`, `adapters/`, `detection/`, `registry/`) onto this
 * existing allowlist pattern rather than a new validator, per the audit's
 * own step 7 ("Extend incubate-posture.ts with a harnesses allowlist rather
 * than writing a new validator"). Routing ratified by owner directive
 * 2026-07-25.
 *
 * Exit 0 = incubate holds. Exit 1 = app production path imports incubating surface.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function isExemptAppPath(rel: string, label?: string): boolean {
  const lower = rel.toLowerCase();
  if (lower.includes('__tests__') || lower.includes('/test/') || lower.includes('/tests/')) {
    return true;
  }
  if (lower.endsWith('.test.ts') || lower.endsWith('.test.tsx')) return true;
  if (lower.endsWith('.spec.ts') || lower.endsWith('.spec.tsx')) return true;
  if (lower.includes('/content/') || lower.includes('/public/')) return true;
  // GAP-406 WIRE: sole allowed app mounts (env-gated wire modules + consumers).
  if (label === 'MCPHypervisor' && rel === 'apps/server/src/lib/mcp-hypervisor-wire.ts') {
    return true;
  }
  // Dynamic import() strings still match needles; wire modules are the WIRE path.
  if (label === '@revealui/ai/skills' && rel === 'apps/server/src/lib/ai-skills-wire.ts') {
    return true;
  }
  if (
    label === '@revealui/ai/observability' &&
    rel === 'apps/server/src/lib/ai-observability-wire.ts'
  ) {
    return true;
  }
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
  {
    label: '@revealui/harnesses workboard',
    needles: [
      "from '@revealui/harnesses/workboard'",
      'from "@revealui/harnesses/workboard"',
      'WorkboardManager } from',
      'WorkboardManager, ',
      '{ WorkboardManager',
    ],
  },
  {
    label: '@revealui/harnesses detection/adapters',
    needles: [
      'autoDetectHarnesses } from',
      'autoDetectHarnesses, ',
      '{ autoDetectHarnesses',
      'findAllHarnessProcesses } from',
      'findAllHarnessProcesses, ',
      '{ findAllHarnessProcesses',
    ],
  },
  {
    label: '@revealui/harnesses registry',
    needles: ['HarnessRegistry } from', 'HarnessRegistry, ', '{ HarnessRegistry'],
  },
];

function main(): void {
  const errors: string[] = [];
  const files: string[] = [];
  walkFiles(join(REPO_ROOT, 'apps'), files);

  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const rule of FORBIDDEN) {
      if (isExemptAppPath(rel, rule.label)) continue;
      for (const n of rule.needles) {
        if (source.includes(n)) {
          errors.push(`${rel}: imports incubating surface ${rule.label} (needs WIRE ticket first)`);
          break;
        }
      }
    }
  }

  console.log('\n================================================================');
  console.log('  C11 incubate posture (ADR-007 + GAP-421)');
  console.log('================================================================');

  if (errors.length === 0) {
    console.log(
      '  ✓ no apps/* production imports of MCPHypervisor (except mcp-hypervisor-wire GAP-406 p1)',
    );
    console.log('  ✓ no apps/* production imports of @revealui/ai/skills');
    console.log('  ✓ no apps/* production imports of @revealui/ai/observability');
    console.log('  ✓ no apps/* production imports of @revealui/harnesses workboard');
    console.log('  ✓ no apps/* production imports of @revealui/harnesses detection/adapters');
    console.log('  ✓ no apps/* production imports of @revealui/harnesses registry');
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
