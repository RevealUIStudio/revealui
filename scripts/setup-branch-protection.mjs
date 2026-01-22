#!/usr/bin/env node

import { execSync } from 'child_process';

const REPO = process.env.GITHUB_REPOSITORY || 'joshua-v-dev/RevealUI';
const BRANCH = 'main';

console.log(`🔒 Setting up branch protection for ${REPO}:${BRANCH}\n`);

// Branch protection configuration
const protectionConfig = {
  required_status_checks: {
    strict: true,
    contexts: [
      "validate-config",
      "lint",
      "typecheck",
      "test",
      "security-scan",
      "docs-verification",
      "build-cms",
      "build-web",
      "validate-crdt",
      "integration-tests",
      "snyk-security",
      "secret-scanning",
      "dependency-review",
      "codeql-analysis"
    ]
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    dismissal_restrictions: {}
  },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false
};

try {
  console.log('📡 Configuring branch protection...');

  // Use GitHub CLI to set branch protection
  const cmd = `gh api repos/${REPO}/branches/${BRANCH}/protection -X PUT -H "Accept: application/vnd.github+json" --input -`;

  const child = execSync(cmd, {
    input: JSON.stringify(protectionConfig, null, 2),
    encoding: 'utf8'
  });

  console.log('✅ Branch protection configured successfully!\n');

  // Verify the configuration
  console.log('🔍 Verifying configuration...');
  execSync('pnpm verify:branch-protection', { stdio: 'inherit' });

} catch (error) {
  console.error(`❌ Failed to configure branch protection: ${error.message}`);

  if (error.message.includes('401') || error.message.includes('Unauthorized')) {
    console.error('\n💡 Solution: Run `gh auth login` to authenticate with GitHub CLI');
  } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
    console.error('\n💡 Solution: You need admin access to configure branch protection');
  } else if (error.message.includes('404')) {
    console.error(`\n💡 Solution: Repository ${REPO} not found or branch ${BRANCH} doesn't exist`);
  }

  console.error('\n📖 Alternatively, configure manually:');
  console.error('   Repository Settings → Branches → Add rule for main branch');

  process.exit(1);
}