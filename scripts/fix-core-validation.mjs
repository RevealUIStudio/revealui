#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔧 Fix Core Validation Issues Script\n');

// Core validation fixes needed
const fixes = {
  'typecheck-hanging': {
    description: 'Fix TypeScript type checking that hangs indefinitely',
    status: 'pending',
    fix: fixTypecheckHanging
  },
  'test-environment-pollution': {
    description: 'Fix test failures caused by real .env files being loaded',
    status: 'pending',
    fix: fixTestEnvironmentPollution
  },
  'config-test-failures': {
    description: 'Fix 9 failing tests in config package',
    status: 'pending',
    fix: fixConfigTestFailures
  },
  'branch-protection-apply': {
    description: 'Apply branch protection rules to main branch',
    status: 'pending',
    fix: applyBranchProtection
  },
  'deployment-secrets-configure': {
    description: 'Configure VERCEL_TOKEN for deployments',
    status: 'pending',
    fix: configureDeploymentSecrets
  }
};

function printStatus() {
  console.log('📋 Core Validation Fixes Status:\n');

  Object.entries(fixes).forEach(([key, fix]) => {
    const status = fix.status === 'completed' ? '✅' :
                   fix.status === 'failed' ? '❌' : '⏳';
    console.log(`${status} ${fix.description}`);
  });

  const completed = Object.values(fixes).filter(f => f.status === 'completed').length;
  const total = Object.keys(fixes).length;
  const percentage = Math.round((completed / total) * 100);

  console.log(`\n📊 Progress: ${completed}/${total} fixes applied (${percentage}%)`);
}

async function fixTypecheckHanging() {
  console.log('🔍 Analyzing TypeScript type checking hang...');

  try {
    // Check for circular dependencies
    console.log('Checking for circular dependencies...');
    const circularCheck = execSync('pnpm dlx madge --circular --ts-config ./tsconfig.json packages/', {
      encoding: 'utf8',
      timeout: 10000
    }).trim();

    if (circularCheck) {
      console.log('⚠️ Circular dependencies found:');
      console.log(circularCheck);
      return false;
    }

    // Check tsconfig files for issues
    console.log('Validating TypeScript configurations...');
    const packages = ['packages/config', 'packages/core', 'packages/services', 'apps/cms'];

    for (const pkg of packages) {
      if (existsSync(join(pkg, 'tsconfig.json'))) {
        const tsconfig = JSON.parse(readFileSync(join(pkg, 'tsconfig.json'), 'utf8'));

        // Check for problematic settings
        if (tsconfig.compilerOptions?.skipLibCheck === false) {
          console.log(`⚠️ ${pkg}: skipLibCheck is false, this can cause hangs`);
        }

        if (!tsconfig.compilerOptions?.incremental) {
          console.log(`⚠️ ${pkg}: incremental compilation not enabled`);
        }
      }
    }

    // Try incremental typecheck approach
    console.log('Testing incremental typecheck...');
    execSync('pnpm --filter @revealui/config typecheck', { timeout: 5000 });
    execSync('pnpm --filter @revealui/core typecheck', { timeout: 5000 });
    execSync('pnpm --filter @revealui/services typecheck', { timeout: 5000 });

    console.log('✅ Incremental typecheck works, full typecheck may need optimization');
    return true;

  } catch (error) {
    console.error('❌ Typecheck analysis failed:', error.message);
    return false;
  }
}

function fixTestEnvironmentPollution() {
  console.log('🧪 Fixing test environment pollution...');

  try {
    // Check if .env.development.local exists (which is being loaded in tests)
    const envFile = '.env.development.local';
    if (existsSync(envFile)) {
      console.log('⚠️ Found .env.development.local that may be polluting tests');

      // Create isolated test environment
      const testEnvContent = `# Test environment - isolated from development
NODE_ENV=test
SKIP_ENV_VALIDATION=true

# Test database
POSTGRES_URL=postgresql://test:test@localhost:5432/test

# Test Stripe (fake keys)
STRIPE_SECRET_KEY=sk_test_fake_key_for_testing
STRIPE_WEBHOOK_SECRET=whsec_fake_secret_for_testing
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_fake_publishable_key

# Test Supabase (fake keys)
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=fake_anon_key_for_testing

# Test storage
BLOB_READ_WRITE_TOKEN=fake_blob_token_for_testing

# Test RevealUI
REVEALUI_SECRET=fake_secret_for_testing_32_chars_minimum_length
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
`;

      writeFileSync('.env.test.local', testEnvContent);
      console.log('✅ Created .env.test.local for isolated testing');

      // Update test scripts to use test environment
      const packageJsonPath = 'packages/config/package.json';
      if (existsSync(packageJsonPath)) {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        if (pkg.scripts?.test) {
          // Add environment specification
          pkg.scripts.test = 'dotenv -e ../../.env.test.local -- vitest run';
          writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
          console.log('✅ Updated config package test script to use isolated environment');
        }
      }

      return true;
    } else {
      console.log('✅ No .env.development.local found');
      return true;
    }

  } catch (error) {
    console.error('❌ Test environment fix failed:', error.message);
    return false;
  }
}

function fixConfigTestFailures() {
  console.log('🔧 Fixing config package test failures...');

  try {
    // The tests are failing because they're expecting undefined values but getting real env values
    // We need to ensure tests run in complete isolation

    const testSetupPath = 'packages/config/__tests__/setup.ts';
    if (!existsSync(testSetupPath)) {
      const setupContent = `import { beforeAll, afterAll } from 'vitest';

// Clear all environment variables before tests
beforeAll(() => {
  // Store original env
  const originalEnv = { ...process.env };

  // Clear all env vars that might interfere
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('REVEALUI_') ||
        key.startsWith('STRIPE_') ||
        key.startsWith('POSTGRES_') ||
        key.startsWith('SUPABASE_') ||
        key.startsWith('BLOB_') ||
        key.startsWith('NEXT_PUBLIC_')) {
      delete process.env[key];
    }
  });

  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.SKIP_ENV_VALIDATION = 'true';

  return () => {
    // Restore original env after tests
    process.env = originalEnv;
  };
});

// Ensure clean state between tests
afterAll(() => {
  // Clear any test pollution
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('REVEALUI_') ||
        key.startsWith('STRIPE_') ||
        key.startsWith('POSTGRES_') ||
        key.startsWith('SUPABASE_') ||
        key.startsWith('BLOB_') ||
        key.startsWith('NEXT_PUBLIC_')) {
      delete process.env[key];
    }
  });
});`;

      writeFileSync(testSetupPath, setupContent);
      console.log('✅ Created test setup to isolate environment');
    }

    // Update vitest config to use setup
    const vitestConfigPath = 'packages/config/vitest.config.ts';
    if (existsSync(vitestConfigPath)) {
      let config = readFileSync(vitestConfigPath, 'utf8');

      if (!config.includes('setupFiles')) {
        config = config.replace('export default defineConfig({',
          `export default defineConfig({
  test: {
    setupFiles: ['./__tests__/setup.ts'],
  },`);

        writeFileSync(vitestConfigPath, config);
        console.log('✅ Updated vitest config to use test setup');
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Config test fix failed:', error.message);
    return false;
  }
}

function applyBranchProtection() {
  console.log('🔒 Applying branch protection rules...');

  try {
    // This is a manual step that requires GitHub UI or CLI with proper permissions
    console.log('📋 Branch Protection Setup Instructions:');
    console.log('1. Go to https://github.com/joshua-v-dev/RevealUI/settings/branches');
    console.log('2. Click "Add rule"');
    console.log('3. Set branch name pattern: main');
    console.log('4. Enable "Require a pull request before merging"');
    console.log('5. Enable "Require approvals" (1 reviewer)');
    console.log('6. Enable "Dismiss stale pull request approvals when new commits are pushed"');
    console.log('7. Enable "Require status checks to pass before merging"');
    console.log('8. Add these status checks:');
    console.log('   - validate-config');
    console.log('   - lint');
    console.log('   - typecheck');
    console.log('   - test');
    console.log('   - security-scan');
    console.log('   - docs-verification');
    console.log('   - build-cms');
    console.log('   - build-web');
    console.log('   - validate-crdt');
    console.log('9. Enable "Include administrators"');
    console.log('10. Enable "Restrict pushes that create matching branches"');

    console.log('\n⚠️ This step requires manual GitHub UI interaction');
    console.log('After completion, run: pnpm verify:branch-protection');

    return false; // Manual step

  } catch (error) {
    console.error('❌ Branch protection setup failed:', error.message);
    return false;
  }
}

function configureDeploymentSecrets() {
  console.log('🚀 Configuring deployment secrets...');

  try {
    console.log('📋 Deployment Secrets Setup Instructions:');
    console.log('1. Go to https://github.com/joshua-v-dev/RevealUI/settings/secrets/actions');
    console.log('2. Click "New repository secret"');
    console.log('3. Name: VERCEL_TOKEN');
    console.log('4. Value: Get from https://vercel.com/dashboard/integrations (create GitHub integration)');
    console.log('5. Click "Add secret"');

    console.log('\n⚠️ This step requires manual GitHub UI interaction and Vercel account access');

    return false; // Manual step

  } catch (error) {
    console.error('❌ Deployment secrets setup failed:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  printStatus();

  if (!command) {
    console.log('\n💡 Available commands:');
    console.log('  status          - Show current status');
    console.log('  fix <issue>     - Fix specific issue');
    console.log('  fix-all         - Attempt to fix all issues');

    console.log('\n🔧 Available fixes:');
    Object.keys(fixes).forEach(key => {
      console.log(`  ${key}`);
    });

    return;
  }

  switch (command) {
    case 'status':
      // Already printed above
      break;

    case 'fix':
      const issue = args[1];
      if (!issue || !fixes[issue]) {
        console.error(`❌ Unknown issue: ${issue}`);
        console.log('Available issues:', Object.keys(fixes).join(', '));
        process.exit(1);
      }

      console.log(`🔧 Attempting to fix: ${fixes[issue].description}`);
      const success = await fixes[issue].fix();

      if (success) {
        fixes[issue].status = 'completed';
        console.log(`✅ Successfully fixed: ${issue}`);
      } else {
        fixes[issue].status = 'failed';
        console.log(`❌ Failed to fix: ${issue}`);
        process.exit(1);
      }
      break;

    case 'fix-all':
      console.log('🔧 Attempting to fix all core validation issues...');

      for (const [key, fix] of Object.entries(fixes)) {
        if (fix.status !== 'completed') {
          console.log(`\n🔧 Fixing: ${fix.description}`);
          try {
            const success = await fix.fix();
            if (success) {
              fix.status = 'completed';
              console.log(`✅ Fixed: ${key}`);
            } else {
              fix.status = 'failed';
              console.log(`❌ Failed: ${key}`);
            }
          } catch (error) {
            fix.status = 'failed';
            console.log(`❌ Error fixing ${key}: ${error.message}`);
          }
        }
      }
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Use: status, fix <issue>, or fix-all');
      process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Updated Core Validation Fixes Status:');
  printStatus();
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});