#!/usr/bin/env tsx

/**
 * Validate Codebase Structure After Reorganization
 *
 * This script verifies that the reorganization was successful and
 * that all files are in their correct locations.
 *
 * @dependencies
 * - node:fs - File system operations (existsSync, readdirSync, statSync)
 * - node:path - Path manipulation utilities (join)
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface ValidationRule {
  path: string;
  type: 'directory' | 'file';
  description: string;
  required?: boolean;
}

interface ValidationResult {
  rule: ValidationRule;
  valid: boolean;
  message: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  // Centralized configuration structure
  {
    path: 'config',
    type: 'directory',
    description: 'Centralized configuration root',
    required: false,
  },
  {
    path: 'config/build',
    type: 'directory',
    description: 'Build system configs',
    required: false,
  },
  {
    path: 'config/ci',
    type: 'directory',
    description: 'CI/CD configurations',
    required: false,
  },
  {
    path: 'config/ide',
    type: 'directory',
    description: 'IDE-specific configs',
    required: false,
  },
  {
    path: 'config/hooks',
    type: 'directory',
    description: 'Git hooks',
    required: false,
  },
  {
    path: 'config/docs',
    type: 'directory',
    description: 'Documentation configs',
    required: false,
  },
  {
    path: 'config/performance',
    type: 'directory',
    description: 'Performance configs',
    required: false,
  },
  {
    path: 'packages/config/src',
    type: 'directory',
    description: 'Core project configs',
    required: true,
  },
  {
    path: 'config/README.md',
    type: 'file',
    description: 'Config documentation',
    required: false,
  },

  // Documentation structure (flat — docs served at /docs/<FILE>.md by apps/docs)
  {
    path: 'docs',
    type: 'directory',
    description: 'Documentation root',
    required: true,
  },
  {
    path: 'docs/INDEX.md',
    type: 'file',
    description: 'Docs index (entry point for docs site)',
    required: true,
  },
  {
    path: 'docs/QUICK_START.md',
    type: 'file',
    description: 'Quick start guide',
    required: true,
  },
  {
    path: 'docs/PRO.md',
    type: 'file',
    description: 'Pro tier documentation',
    required: true,
  },
  {
    path: 'docs/REFERENCE.md',
    type: 'file',
    description: 'API reference index',
    required: false,
  },

  // Infrastructure structure
  {
    path: 'infrastructure',
    type: 'directory',
    description: 'Infrastructure root',
    required: true,
  },
  {
    path: 'infrastructure/docker',
    type: 'directory',
    description: 'Docker configurations',
    required: true,
  },
  {
    path: 'infrastructure/k8s',
    type: 'directory',
    description: 'Kubernetes configurations',
    required: true,
  },

  // Streamlined scripts structure
  {
    path: 'scripts',
    type: 'directory',
    description: 'Scripts root',
    required: true,
  },
  {
    path: 'scripts/build',
    type: 'directory',
    description: 'Build scripts',
    required: false,
  },
  {
    path: 'scripts/dev',
    type: 'directory',
    description: 'Development tools',
    required: false,
  },
  {
    path: 'scripts/analysis',
    type: 'directory',
    description: 'Analysis tools',
    required: false,
  },
  {
    path: 'scripts/database',
    type: 'directory',
    description: 'Database scripts',
    required: false,
  },
  {
    path: 'scripts/docs',
    type: 'directory',
    description: 'Documentation tools',
    required: false,
  },
  {
    path: 'scripts/validation',
    type: 'directory',
    description: 'Quality checks',
    required: true,
  },
  {
    path: 'scripts/utils',
    type: 'directory',
    description: 'Shared utilities',
    required: true,
  },
  {
    path: 'scripts/README.md',
    type: 'file',
    description: 'Scripts documentation',
    required: true,
  },

  // Clean root validation
  {
    path: 'README.md',
    type: 'file',
    description: 'Project README',
    required: true,
  },
  {
    path: 'LICENSE',
    type: 'file',
    description: 'License file',
    required: false,
  },
];

class StructureValidator {
  private packageHasTests(pkgPath: string): boolean {
    const ignoredDirectories = new Set([
      'node_modules',
      'dist',
      '.next',
      '.turbo',
      'coverage',
      '.git',
      'results',
    ]);

    function isTestFile(entry: string): boolean {
      return (
        entry.endsWith('.test.ts') ||
        entry.endsWith('.test.tsx') ||
        entry.endsWith('.test.js') ||
        entry.endsWith('.test.jsx') ||
        entry.endsWith('.spec.ts') ||
        entry.endsWith('.spec.tsx') ||
        entry.endsWith('.spec.js') ||
        entry.endsWith('.spec.jsx') ||
        entry.endsWith('.integration.test.ts') ||
        entry.endsWith('.integration.test.tsx')
      );
    }

    function walk(dir: string): boolean {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);

        if (stat.isDirectory()) {
          if (entry === '__tests__') {
            return true;
          }
          if (ignoredDirectories.has(entry)) {
            continue;
          }
          if (walk(full)) {
            return true;
          }
          continue;
        }

        if (isTestFile(entry)) {
          return true;
        }
      }

      return false;
    }

    return walk(pkgPath);
  }

  validate(): boolean {
    console.log('🔍 Validating Reorganized Structure\n');

    let allValid = true;
    const results: ValidationResult[] = [];
    const optionalMissing: ValidationRule[] = [];

    for (const rule of VALIDATION_RULES) {
      const exists = existsSync(rule.path);

      if (rule.required && !exists) {
        results.push({
          rule,
          valid: false,
          message: `❌ MISSING: ${rule.path} - ${rule.description}`,
        });
        allValid = false;
      } else if (exists) {
        // Check if it's the right type
        const stats = statSync(rule.path);
        const isCorrectType =
          (rule.type === 'directory' && stats.isDirectory()) ||
          (rule.type === 'file' && stats.isFile());

        if (!isCorrectType) {
          results.push({
            rule,
            valid: false,
            message: `❌ WRONG TYPE: ${rule.path} - Expected ${rule.type}, got ${stats.isDirectory() ? 'directory' : 'file'}`,
          });
          allValid = false;
        } else {
          results.push({
            rule,
            valid: true,
            message: `✅ OK: ${rule.path} - ${rule.description}`,
          });
        }
      } else if (!rule.required) {
        optionalMissing.push(rule);
      }
    }

    // Print results
    for (const result of results) {
      console.log(result.message);
    }

    if (optionalMissing.length > 0) {
      const groupedOptionalMissing = new Map<string, ValidationRule[]>();

      for (const rule of optionalMissing) {
        const [groupKey] = rule.path.split('/');
        const rules = groupedOptionalMissing.get(groupKey) ?? [];
        rules.push(rule);
        groupedOptionalMissing.set(groupKey, rules);
      }

      console.log(
        `\nℹ️  Optional paths not present (${optionalMissing.length}) — informational only:`,
      );

      for (const [group, rules] of groupedOptionalMissing) {
        console.log(`   - ${group}: ${rules.map((rule) => rule.path).join(', ')}`);
      }
    }

    // Additional validations
    console.log('\n🔍 Additional Validations:');

    // Check for remaining scattered files
    const AllowedRootDirs = [
      'apps',
      'packages',
      'docs',
      'scripts',
      'config',
      'examples',
      'infrastructure',
      'e2e',
      'node_modules',
      '.git',
      '.github',
      '.turbo',
      '.vscode',
      '.cursor',
      '.claude',
      '.devcontainer',
      '.direnv',
      '.archive',
      '.revealui',
    ];

    const AllowedRootFiles = [
      // Documentation
      'AGENTS.md',
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'CLAUDE.md',
      'CODE_OF_CONDUCT.md',
      'SECURITY.md',
      'DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md',
      'DEPENDENCY_DIAGRAM.txt',
      // Package management
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      // Build config
      'turbo.json',
      'tsconfig.json',
      // Linting and formatting
      'biome.json',
      // Testing
      'vitest.config.ts',
      'playwright.config.ts',
      'playwright.smoke.config.ts',
      // Docker
      'docker-compose.yml',
      'docker-compose.forge.yml',
      // Nix
      'flake.nix',
      'flake.lock',
      // Dotfiles
      '.gitignore',
      '.gitattributes',
      '.dockerignore',
      '.npmrc',
      '.nvmrc',
      '.envrc',
      '.env.template',
      '.env.test',
      '.lighthouserc.json',
      '.size-limit.json',
      'skills-lock.json',
      // Infrastructure
      'vultr-inference.json',
      // Reports (consider moving to reports/ folder)
      'CODE-QUALITY-REPORT.json',
      'TYPE-USAGE-REPORT.json',
    ];

    const rootFiles = readdirSync('.').filter(
      (file) => !(file.startsWith('.') || AllowedRootDirs.includes(file)),
    );

    // Core project files that belong in root
    const coreProjectFiles = AllowedRootFiles;

    const scatteredFiles = rootFiles.filter((file) => {
      const stats = statSync(file);
      return stats.isFile() && !coreProjectFiles.includes(file);
    });

    if (scatteredFiles.length > 0) {
      console.log(`\n⚠️  Remaining scattered files in root (warning only):`);
      scatteredFiles.forEach((file) => {
        console.log(`   - ${file}`);
      });
    } else {
      console.log('\n✅ No scattered files in root');
    }

    // Check for unauthorized markdown files in root
    const rootMarkdownFiles = readdirSync('.').filter(
      (file) =>
        file.endsWith('.md') &&
        ![
          'AGENTS.md',
          'README.md',
          'CHANGELOG.md',
          'CONTRIBUTING.md',
          'CLAUDE.md',
          'CODE_OF_CONDUCT.md',
          'SECURITY.md',
          'DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md',
        ].includes(file),
    );

    if (rootMarkdownFiles.length > 0) {
      console.log(`\n❌ Unauthorized markdown files in root (should be in docs/):`);
      rootMarkdownFiles.forEach((file) => {
        console.log(`   - ${file}`);
      });
      allValid = false;
    } else {
      console.log('✅ Only authorized markdown files in root');
    }

    // Check infrastructure structure
    const infrastructureDir = 'infrastructure';
    const RequiredInfrastructureSubdirs = ['docker', 'k8s'];

    if (existsSync(infrastructureDir)) {
      console.log('\n🔍 Checking infrastructure structure...');
      for (const subdir of RequiredInfrastructureSubdirs) {
        const subdirPath = join(infrastructureDir, subdir);
        if (!existsSync(subdirPath)) {
          console.log(`❌ Missing ${subdirPath}`);
          allValid = false;
        } else {
          console.log(`✅ ${subdirPath} exists`);
        }
      }
    }

    // Check that k8s/ and docker/ are not in root
    if (existsSync('k8s')) {
      console.log('\n❌ k8s/ found in root - should be in infrastructure/');
      allValid = false;
    }
    if (existsSync('docker')) {
      console.log('\n❌ docker/ found in root - should be in infrastructure/');
      allValid = false;
    }

    // Check that package-templates is not in root
    if (existsSync('package-templates')) {
      console.log('\n❌ package-templates/ found in root - should be in .revealui/templates/');
      allValid = false;
    }

    // Check that templates exist
    if (!existsSync('.revealui/templates')) {
      console.log('\n❌ .revealui/templates/ directory not found');
      allValid = false;
    } else {
      console.log('✅ .revealui/templates/ directory exists');
    }

    // Check that mcp is not in root
    if (existsSync('mcp')) {
      console.log('\n❌ mcp/ found in root - should be in packages/mcp/');
      allValid = false;
    }

    // Check package structure consistency
    console.log('\n🔍 Checking package structure consistency...');
    const packagesDir = 'packages';
    // Packages exempt from src/ and __tests__ checks — thin wrappers or delegation-only packages
    // scripts: flat layout (no src/) — moved from scripts/lib, predates src/ convention
    const srcExempt = new Set(['create-revealui', 'PACKAGE-CONVENTIONS.md', 'scripts']);
    if (existsSync(packagesDir)) {
      const packages = readdirSync(packagesDir).filter((item) =>
        statSync(join(packagesDir, item)).isDirectory(),
      );

      for (const pkg of packages) {
        const pkgPath = join(packagesDir, pkg);
        const hasPackageJson = existsSync(join(pkgPath, 'package.json'));

        // Skip directories without package.json — these are not packages
        // (e.g. build artifacts from gitignored Pro packages before Fair Source migration)
        if (!hasPackageJson) continue;

        if (!srcExempt.has(pkg)) {
          const hasSrc = existsSync(join(pkgPath, 'src'));
          const hasTests = this.packageHasTests(pkgPath);
          if (!hasSrc) {
            console.log(`⚠️  Package ${pkg} missing src/ directory`);
            allValid = false;
          }
          if (!hasTests) {
            console.log(`⚠️  Package ${pkg} missing test files`);
          }
        }
      }
    }

    // Check dual-database boundary enforcement
    console.log('\n🔍 Checking dual-DB boundary (Supabase outside permitted paths)...');
    this.checkDualDbBoundary(results);

    console.log(
      `\n${allValid ? '✅' : '❌'} Overall validation: ${allValid ? 'PASSED' : 'FAILED'}`,
    );

    if (!allValid) {
      console.log('\n💡 Fix issues and re-run validation:');
      console.log('pnpm run validate:structure');
    }

    return allValid;
  }

  /**
   * Verify that @supabase/supabase-js is only imported in designated modules.
   * Violations are warnings (not failures) to avoid blocking builds for legacy code.
   */
  private checkDualDbBoundary(
    _results: Array<{ rule: ValidationRule; valid: boolean; message: string }>,
  ): void {
    // Paths where Supabase imports are explicitly allowed
    const allowedSupabasePaths = [
      'packages/db/src/vector',
      'packages/db/src/auth',
      'packages/auth/src',
      'packages/ai/src',
      'packages/services/src/supabase',
      'packages/mcp/src',
      // Integration tests for Supabase services are expected to import supabase-js
      'packages/test/src/integration',
    ];

    let output = '';
    try {
      // Use grep to find all TypeScript files with actual import statements for @supabase/supabase-js.
      // Match only import/from declarations (Biome enforces single quotes), not string literals
      // that merely mention the package name as documentation or test assertions.
      // Exclude .claude/worktrees/ — those are agent sandbox directories, not production source.
      output = execSync(
        `grep -r --include="*.ts" --include="*.tsx" --exclude-dir=".next" --exclude-dir="dist" --exclude-dir="node_modules" --exclude-dir=".turbo" --exclude-dir="worktrees" -l "from '@supabase/supabase-js" . 2>/dev/null || true`,
        { encoding: 'utf8', cwd: process.cwd() },
      );
    } catch {
      // grep exits non-zero if no matches — that's fine
      output = '';
    }

    const files = output
      .trim()
      .split('\n')
      .filter(Boolean)
      // Normalize: strip leading ./
      .map((f) => f.replace(/^\.\//, ''))
      // Only consider source code in packages/ and apps/ — exclude scripts (they contain
      // the pattern as string literals), dist, node_modules, and agent worktrees.
      .filter(
        (f) =>
          (f.startsWith('packages/') || f.startsWith('apps/')) &&
          !f.includes('node_modules') &&
          !f.includes('/dist/') &&
          !f.startsWith('.claude/worktrees/'),
      );

    const violations: string[] = [];
    const permitted: string[] = [];

    for (const file of files) {
      const isAllowed = allowedSupabasePaths.some((allowedPath) => file.startsWith(allowedPath));
      // Also allow app-level supabase utility directories
      const isAppAllowed = /^apps\/[^/]+\/src\/lib\/supabase\//.test(file);

      if (isAllowed || isAppAllowed) {
        permitted.push(file);
      } else {
        violations.push(file);
      }
    }

    if (permitted.length > 0) {
      console.log(`✅ ${permitted.length} file(s) use Supabase within permitted paths`);
    }

    if (violations.length > 0) {
      console.log(
        `⚠️  ${violations.length} file(s) import @supabase/supabase-js outside permitted paths:`,
      );
      for (const v of violations) {
        console.log(`   - ${v}`);
      }
      console.log(
        '   Permitted paths: @revealui/db vector/auth modules, @revealui/auth, @revealui/ai memory modules, @revealui/services supabase integration, @revealui/mcp, packages/test integration helpers, apps/*/src/lib/supabase/',
      );
      console.log('   See .claude/rules/database.md for the dual-DB boundary policy.');
    } else if (files.length === 0) {
      console.log('✅ No @supabase/supabase-js imports found (or grep unavailable)');
    } else {
      console.log('✅ All Supabase imports are within permitted paths');
    }
  }
}

// CLI interface
async function main() {
  console.log('🎯 RevealUI Structure Validation');
  console.log('='.repeat(40));

  const validator = new StructureValidator();
  const success = validator.validate();

  process.exit(success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { StructureValidator, VALIDATION_RULES };
