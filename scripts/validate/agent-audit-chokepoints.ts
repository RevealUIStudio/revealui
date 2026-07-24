#!/usr/bin/env tsx
// console-allowed

/**
 * GAP-355 Stage 5 S5-4 — agent audit chokepoint checklist.
 *
 * Ensures named agent execution surfaces still carry the integrity audit
 * wiring (substring presence in source files). Complements
 * `audit-log-single-door.ts` (which guards WHO may insert audit_log) by
 * guarding WHERE agent paths must call the door.
 *
 * Config: scripts/validate/agent-audit-chokepoints.json
 * Matching is literal `includes` only (no authored regex).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const CONFIG_PATH = join(REPO_ROOT, 'scripts/validate/agent-audit-chokepoints.json');

interface Chokepoint {
  id: string;
  file: string;
  mustContain: string[];
}

interface Residual {
  id: string;
  note: string;
}

interface Config {
  chokepoints: Chokepoint[];
  residuals?: Residual[];
}

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Missing config: ${CONFIG_PATH}`);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Config;
}

function main(): number {
  const config = loadConfig();
  const failures: string[] = [];

  out('============================================================');
  out('GAP-355 Stage 5 — agent audit chokepoint checklist');
  out('============================================================');

  for (const cp of config.chokepoints) {
    const abs = join(REPO_ROOT, cp.file);
    if (!existsSync(abs)) {
      failures.push(`[${cp.id}] missing file: ${cp.file}`);
      out(`  ✗ ${cp.id} — file missing (${cp.file})`);
      continue;
    }
    const src = readFileSync(abs, 'utf8');
    const missing = cp.mustContain.filter((needle) => !src.includes(needle));
    if (missing.length > 0) {
      failures.push(`[${cp.id}] missing markers in ${cp.file}: ${missing.join(', ')}`);
      out(`  ✗ ${cp.id} — missing: ${missing.join(', ')}`);
    } else {
      out(`  ✓ ${cp.id}`);
    }
  }

  if (config.residuals && config.residuals.length > 0) {
    out('');
    out('Documented residuals (informational):');
    for (const r of config.residuals) {
      out(`  · ${r.id}: ${r.note}`);
    }
  }

  out('');
  if (failures.length > 0) {
    out(`Result: FAIL (${failures.length} chokepoint(s))`);
    for (const f of failures) out(`  - ${f}`);
    return 1;
  }

  out(`Result: PASS (${config.chokepoints.length} chokepoints)`);
  return 0;
}

process.exit(main());
