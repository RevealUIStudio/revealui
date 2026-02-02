#!/usr/bin/env tsx

/**
 * Validate Codebase Structure After Reorganization
 *
 * This script verifies that the reorganization was successful and
 * that all files are in their correct locations.
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

interface ValidationRule {
  path: string
  type: 'directory' | 'file'
  description: string
  required?: boolean
}

const VALIDATION_RULES: ValidationRule[] = [
  // Centralized configuration structure
  {
    path: 'config',
    type: 'directory',
    description: 'Centralized configuration root',
    required: true,
  },
  {
    path: 'config/build',
    type: 'directory',
    description: 'Build system configs',
    required: true,
  },
  {
    path: 'config/ci',
    type: 'directory',
    description: 'CI/CD configurations',
    required: true,
  },
  {
    path: 'config/ide',
    type: 'directory',
    description: 'IDE-specific configs',
    required: true,
  },
  {
    path: 'config/hooks',
    type: 'directory',
    description: 'Git hooks',
    required: true,
  },
  {
    path: 'config/docs',
    type: 'directory',
    description: 'Documentation configs',
    required: true,
  },
  {
    path: 'config/performance',
    type: 'directory',
    description: 'Performance configs',
    required: true,
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
    required: true,
  },

  // Simplified documentation structure
  {
    path: 'docs',
    type: 'directory',
    description: 'Documentation root',
    required: true,
  },
  {
    path: 'docs/guides',
    type: 'directory',
    description: 'User guides',
    required: true,
  },
  {
    path: 'docs/reference',
    type: 'directory',
    description: 'API references',
    required: true,
  },
  {
    path: 'docs/development',
    type: 'directory',
    description: 'Development docs',
    required: true,
  },
  {
    path: 'docs/archive',
    type: 'directory',
    description: 'Historical docs',
    required: true,
  },
  {
    path: 'docs/testing',
    type: 'directory',
    description: 'Testing documentation',
    required: true,
  },
  {
    path: 'docs/deployment',
    type: 'directory',
    description: 'Deployment documentation',
    required: true,
  },
  {
    path: 'docs/architecture',
    type: 'directory',
    description: 'Architecture documentation',
    required: true,
  },
  {
    path: 'docs/README.md',
    type: 'file',
    description: 'Docs navigation',
    required: true,
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
    required: true,
  },
  {
    path: 'scripts/dev',
    type: 'directory',
    description: 'Development tools',
    required: true,
  },
  {
    path: 'scripts/analysis',
    type: 'directory',
    description: 'Analysis tools',
    required: true,
  },
  {
    path: 'scripts/database',
    type: 'directory',
    description: 'Database scripts',
    required: true,
  },
  {
    path: 'scripts/docs',
    type: 'directory',
    description: 'Documentation tools',
    required: true,
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
]

class StructureValidator {
  validate(): boolean {
    console.log('🔍 Validating Reorganized Structure\n')

    let allValid = true
    const results: Array<{
      rule: ValidationRule
      valid: boolean
      message: string
    }> = []

    for (const rule of VALIDATION_RULES) {
      const exists = existsSync(rule.path)

      if (rule.required && !exists) {
        results.push({
          rule,
          valid: false,
          message: `❌ MISSING: ${rule.path} - ${rule.description}`,
        })
        allValid = false
      } else if (exists) {
        // Check if it's the right type
        const stats = statSync(rule.path)
        const isCorrectType =
          (rule.type === 'directory' && stats.isDirectory()) ||
          (rule.type === 'file' && stats.isFile())

        if (!isCorrectType) {
          results.push({
            rule,
            valid: false,
            message: `❌ WRONG TYPE: ${rule.path} - Expected ${rule.type}, got ${stats.isDirectory() ? 'directory' : 'file'}`,
          })
          allValid = false
        } else {
          results.push({
            rule,
            valid: true,
            message: `✅ OK: ${rule.path} - ${rule.description}`,
          })
        }
      } else if (!rule.required) {
        results.push({
          rule,
          valid: true,
          message: `⚠️  OPTIONAL: ${rule.path} - ${rule.description} (not present)`,
        })
      }
    }

    // Print results
    for (const result of results) {
      console.log(result.message)
    }

    // Additional validations
    console.log('\n🔍 Additional Validations:')

    // Check for remaining scattered files
    const ALLOWED_ROOT_DIRS = [
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
    ]

    const ALLOWED_ROOT_FILES = [
      // Documentation
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      // Package management
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      // Build config
      'turbo.json',
      'tsconfig.json',
      // Linting and formatting
      'biome.json',
      'eslint.config.js',
      // Testing
      'vitest.config.ts',
      'playwright.config.ts',
      // Docker
      'docker-compose.yml',
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
      // Reports (consider moving to reports/ folder)
      'CODE-QUALITY-REPORT.json',
      'TYPE-USAGE-REPORT.json',
    ]

    const rootFiles = readdirSync('.').filter(
      (file) => !file.startsWith('.') && !ALLOWED_ROOT_DIRS.includes(file),
    )

    // Core project files that belong in root
    const coreProjectFiles = ALLOWED_ROOT_FILES

    const scatteredFiles = rootFiles.filter((file) => {
      const stats = statSync(file)
      return stats.isFile() && !coreProjectFiles.includes(file)
    })

    if (scatteredFiles.length > 0) {
      console.log(`\n⚠️  Remaining scattered files in root:`)
      scatteredFiles.forEach((file) => {
        console.log(`   - ${file}`)
      })
      allValid = false
    } else {
      console.log('\n✅ No scattered files in root')
    }

    // Check for unauthorized markdown files in root
    const rootMarkdownFiles = readdirSync('.').filter(
      (file) => file.endsWith('.md') && !['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md'].includes(file),
    )

    if (rootMarkdownFiles.length > 0) {
      console.log(`\n❌ Unauthorized markdown files in root (should be in docs/):`)
      rootMarkdownFiles.forEach((file) => {
        console.log(`   - ${file}`)
      })
      allValid = false
    } else {
      console.log('✅ Only authorized markdown files in root')
    }

    // Check infrastructure structure
    const infrastructureDir = 'infrastructure'
    const REQUIRED_INFRASTRUCTURE_SUBDIRS = ['docker', 'k8s']

    if (existsSync(infrastructureDir)) {
      console.log('\n🔍 Checking infrastructure structure...')
      for (const subdir of REQUIRED_INFRASTRUCTURE_SUBDIRS) {
        const subdirPath = join(infrastructureDir, subdir)
        if (!existsSync(subdirPath)) {
          console.log(`❌ Missing ${subdirPath}`)
          allValid = false
        } else {
          console.log(`✅ ${subdirPath} exists`)
        }
      }
    }

    // Check that k8s/ and docker/ are not in root
    if (existsSync('k8s')) {
      console.log('\n❌ k8s/ found in root - should be in infrastructure/')
      allValid = false
    }
    if (existsSync('docker')) {
      console.log('\n❌ docker/ found in root - should be in infrastructure/')
      allValid = false
    }

    // Check that package-templates is not in root
    if (existsSync('package-templates')) {
      console.log('\n❌ package-templates/ found in root - should be in .revealui/templates/')
      allValid = false
    }

    // Check that templates exist
    if (!existsSync('.revealui/templates')) {
      console.log('\n❌ .revealui/templates/ directory not found')
      allValid = false
    } else {
      console.log('✅ .revealui/templates/ directory exists')
    }

    // Check that mcp is not in root
    if (existsSync('mcp')) {
      console.log('\n❌ mcp/ found in root - should be in packages/mcp/')
      allValid = false
    }

    // Check package structure consistency
    console.log('\n🔍 Checking package structure consistency...')
    const packagesDir = 'packages'
    if (existsSync(packagesDir)) {
      const packages = readdirSync(packagesDir).filter((item) =>
        statSync(join(packagesDir, item)).isDirectory(),
      )

      for (const pkg of packages) {
        const pkgPath = join(packagesDir, pkg)
        const hasSrc = existsSync(join(pkgPath, 'src'))
        const hasTests =
          existsSync(join(pkgPath, '__tests__')) || existsSync(join(pkgPath, 'src', '__tests__'))
        const hasPackageJson = existsSync(join(pkgPath, 'package.json'))

        if (!hasSrc) {
          console.log(`⚠️  Package ${pkg} missing src/ directory`)
          allValid = false
        }
        if (!hasTests) {
          console.log(`⚠️  Package ${pkg} missing __tests__ directory`)
        }
        if (!hasPackageJson) {
          console.log(`❌ Package ${pkg} missing package.json`)
          allValid = false
        }
      }
    }

    console.log(`\n${allValid ? '✅' : '❌'} Overall validation: ${allValid ? 'PASSED' : 'FAILED'}`)

    if (!allValid) {
      console.log('\n💡 Fix issues and re-run validation:')
      console.log('pnpm run validate:structure')
    }

    return allValid
  }
}

// CLI interface
async function main() {
  console.log('🎯 RevealUI Structure Validation')
  console.log('='.repeat(40))

  const validator = new StructureValidator()
  const success = validator.validate()

  process.exit(success ? 0 : 1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { StructureValidator, VALIDATION_RULES }
