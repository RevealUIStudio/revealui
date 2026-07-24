#!/usr/bin/env tsx
/**
 * Engines package posture gate (ADR-006 / fleet-redundancy Phase 6).
 *
 * Enforces incubate posture for `@revealui/engines`:
 * 1. No production importers under apps/ (apps use direct package imports).
 * 2. package.json remains `"private": true`.
 * 3. Surface docs (CLAUDE.md, README.md) do not call engines "the" unified
 *    app entry without incubating/optional language.
 *
 * Exit 0 = posture holds. Exit 1 = drift.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const ENGINES_PKG = join(REPO_ROOT, 'packages', 'engines', 'package.json');

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** Paths under apps/ that may mention engines (tests / docs samples only). */
function isExemptAppPath(rel: string): boolean {
  const lower = rel.toLowerCase();
  if (lower.includes('__tests__') || lower.includes('/test/') || lower.includes('/tests/')) {
    return true;
  }
  if (lower.endsWith('.test.ts') || lower.endsWith('.test.tsx')) return true;
  if (lower.endsWith('.spec.ts') || lower.endsWith('.spec.tsx')) return true;
  // Public marketing/docs content may list engines as a Pro package name.
  if (lower.includes('/content/') || lower.includes('/public/')) return true;
  return false;
}

function walkFiles(dir: string, out: string[]): void {
  // No existsSync→readdir TOCTOU: attempt readdir and skip on failure.
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === 'node_modules' || name === 'dist' || name === '.next') {
      continue;
    }
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      walkFiles(full, out);
      continue;
    }
    const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
    if (SOURCE_EXT.has(ext)) {
      out.push(full);
    }
  }
}

function hasEnginesImport(source: string): boolean {
  // No regex (repo no-regex posture): substring checks on common import forms.
  const needles = [
    "from '@revealui/engines'",
    'from "@revealui/engines"',
    "from '@revealui/engines/",
    'from "@revealui/engines/',
    "require('@revealui/engines'",
    'require("@revealui/engines"',
  ];
  return needles.some((n) => source.includes(n));
}

function checkPrivatePackage(): string[] {
  const errors: string[] = [];
  let raw: string;
  try {
    raw = readFileSync(ENGINES_PKG, 'utf8');
  } catch {
    errors.push('packages/engines/package.json missing');
    return errors;
  }
  const pj = JSON.parse(raw) as {
    private?: boolean;
    name?: string;
  };
  if (pj.private !== true) {
    errors.push(
      'packages/engines/package.json must set "private": true (ADR-006 incubate; not published)',
    );
  }
  if (pj.name !== '@revealui/engines') {
    errors.push(`unexpected package name: ${pj.name ?? '(missing)'}`);
  }
  return errors;
}

function checkAppImporters(): string[] {
  const errors: string[] = [];
  const appsRoot = join(REPO_ROOT, 'apps');
  const files: string[] = [];
  walkFiles(appsRoot, files);

  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
    if (isExemptAppPath(rel)) continue;
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (hasEnginesImport(source)) {
      errors.push(
        `production app import of @revealui/engines: ${rel} (ADR-006: apps use direct packages until adopt decision)`,
      );
    }
  }
  return errors;
}

/**
 * Surface docs that historically over-claimed "unified entry".
 * Each listed file must not contain a bare "Unified entry point" engines line
 * without incubating/optional language on the same line.
 */
function checkSurfaceDocHonesty(): string[] {
  const errors: string[] = [];
  const files = ['CLAUDE.md', 'README.md', 'AGENTS.md'];

  for (const rel of files) {
    const full = join(REPO_ROOT, rel);
    // Single open: avoid existsSync/statSync then read (CodeQL TOCTOU).
    let content: string;
    try {
      content = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (!line.includes('@revealui/engines') && !line.includes('engines]')) {
        // README table uses packages/engines link text
        if (!(rel === 'README.md' && line.includes('packages/engines'))) {
          continue;
        }
      }
      const lower = line.toLowerCase();
      const claimsUnified =
        lower.includes('unified entry') ||
        lower.includes('the entry point for the five') ||
        lower.includes('required application entry');
      if (!claimsUnified) continue;

      const honest =
        lower.includes('incubat') ||
        lower.includes('optional') ||
        lower.includes('not the app entry') ||
        lower.includes('not the required');

      if (!honest) {
        errors.push(
          `${rel}:${i + 1}: engines described as unified entry without incubating/optional language (ADR-006)`,
        );
      }
    }
  }
  return errors;
}

function main(): void {
  const errors = [...checkPrivatePackage(), ...checkAppImporters(), ...checkSurfaceDocHonesty()];

  console.log('\n================================================================');
  console.log('  Engines package posture (ADR-006)');
  console.log('================================================================');

  if (errors.length === 0) {
    console.log('  ✓ private workspace package');
    console.log('  ✓ no production apps/* importers');
    console.log('  ✓ surface docs use incubating/optional language where relevant');
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
