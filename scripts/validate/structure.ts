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

import { existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// The manager module is resolved through the built dist (manager-resolver.cjs,
// the same pattern gates-resolver.cjs uses for the `./gates` subpath) rather
// than a `src/` reach-in. GAP-421 §6.2: the previous relative import bypassed
// both the export map and dist/, so the `./manager` subpath export had never
// actually been exercised by its only consumer. Resolving through dist closes
// that gap; CI builds @revealui/harnesses before running structure validation
// (see .github/workflows/ci.yml) so this always resolves there.
interface ManagerModuleShape {
  checkManager: (projectRoot: string) => {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
}

function loadManagerModule(): ManagerModuleShape | null {
  const require = createRequire(import.meta.url);
  const { resolveManagerModule } = require('./manager-resolver.cjs') as {
    resolveManagerModule: () => ManagerModuleShape | null;
  };
  return resolveManagerModule();
}

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

  // Documentation structure (flat  -  docs served at /docs/<FILE>.md by apps/docs)
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
  // Holds .dockerignore + infrastructure/docker-compose/services/{electric,test}.yml.
  // Per docs/decisions/2026-05-08-deployment-target-vercel-not-k8s.md, no k8s subdir.
  {
    path: 'infrastructure',
    type: 'directory',
    description: 'Infrastructure root',
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
    path: 'scripts/validate',
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

    // Project manager (GAP-406): monorepo always has packages/harnesses; when
    // .revealui/manager.json is committed, fail closed if it is missing or
    // invalid. Uses the same checkManager primitive as
    // `revealui-harnesses manager check` (no parallel validator).
    if (existsSync('packages/harnesses') || existsSync('.revealui/manager.json')) {
      console.log('\n🔍 Checking project manager (.revealui)...');
      const managerModule = loadManagerModule();
      if (!managerModule) {
        console.log(
          '❌ @revealui/harnesses manager module not built (packages/harnesses/dist/manager missing)',
        );
        console.log('   Run: pnpm --filter @revealui/harnesses build');
        allValid = false;
      } else {
        const managerResult = managerModule.checkManager(process.cwd());
        for (const warning of managerResult.warnings) {
          console.log(`⚠️  ${warning}`);
        }
        if (!managerResult.ok) {
          for (const error of managerResult.errors) {
            console.log(`❌ ${error}`);
          }
          console.log('   Run: pnpm exec revealui-harnesses manager materialize');
          allValid = false;
        } else {
          console.log('✅ Project manager (.revealui/manager.json) present and valid');
        }
      }
    }

    // Check that mcp is not in root
    if (existsSync('mcp')) {
      console.log('\n❌ mcp/ found in root - should be in packages/mcp/');
      allValid = false;
    }

    // Check package structure consistency
    console.log('\n🔍 Checking package structure consistency...');
    const packagesDir = 'packages';
    // Packages exempt from src/ and __tests__ checks  -  thin wrappers or delegation-only packages
    // scripts: flat layout (no src/)  -  moved from scripts/lib, predates src/ convention
    const srcExempt = new Set(['create-revealui', 'PACKAGE-CONVENTIONS.md', 'scripts']);
    if (existsSync(packagesDir)) {
      const packages = readdirSync(packagesDir).filter((item) =>
        statSync(join(packagesDir, item)).isDirectory(),
      );

      for (const pkg of packages) {
        const pkgPath = join(packagesDir, pkg);
        const hasPackageJson = existsSync(join(pkgPath, 'package.json'));

        // Skip directories without package.json  -  these are not packages
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

    console.log(
      `\n${allValid ? '✅' : '❌'} Overall validation: ${allValid ? 'PASSED' : 'FAILED'}`,
    );

    if (!allValid) {
      console.log('\n💡 Fix issues and re-run validation:');
      console.log('pnpm run validate:structure');
    }

    return allValid;
  }
}

/**
 * Focused manager check for path-gated CI (GAP-406).
 * Same primitive as `revealui-harnesses manager check` / structure validate.
 */
export function validateProjectManager(root: string = process.cwd()): boolean {
  if (
    !(
      existsSync(join(root, 'packages/harnesses')) ||
      existsSync(join(root, '.revealui/manager.json'))
    )
  ) {
    console.log('skip: no packages/harnesses or .revealui/manager.json');
    return true;
  }
  const managerModule = loadManagerModule();
  if (!managerModule) {
    console.error(
      'ERROR: @revealui/harnesses manager module not built (packages/harnesses/dist/manager missing)',
    );
    console.error('Run: pnpm --filter @revealui/harnesses build');
    return false;
  }
  const managerResult = managerModule.checkManager(root);
  for (const warning of managerResult.warnings) {
    console.warn(`WARN: ${warning}`);
  }
  if (!managerResult.ok) {
    for (const error of managerResult.errors) {
      console.error(`ERROR: ${error}`);
    }
    console.error('Run: pnpm exec revealui-harnesses manager materialize');
    return false;
  }
  console.log('✓ Project manager (.revealui/manager.json) present and valid');
  return true;
}

// CLI interface
async function main() {
  // Path-gated CI entry: `pnpm validate:structure --manager-only`
  if (process.argv.includes('--manager-only')) {
    process.exit(validateProjectManager() ? 0 : 1);
  }

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
