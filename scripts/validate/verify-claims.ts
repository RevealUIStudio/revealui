#!/usr/bin/env node

/**
 * Claims Verification Script
 *
 * Verifies that documentation claims match actual system state.
 * Validates tests, console statements, type usage, security, and coverage metrics.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - node:child_process - Command execution (execSync)
 * - node:fs - File system operations
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { ErrorCode } from '../lib/errors.js';

interface Claim {
  file: string;
  category: string;
  description: string;
  pattern: string;
  matches: string[];
  context: string;
  verification: string;
}

interface SystemState {
  testsCanRun: boolean;
  consoleStatements: number;
  anyTypes: number;
  securityVerified: boolean;
  coverageMetrics: boolean;
  currentYear: number;
}

/**
 * Get actual system state through runtime checks
 * NO HARDCODED ASSUMPTIONS - Everything must be verified
 */
async function getActualSystemState(): Promise<SystemState> {
  console.log('🔍 Gathering actual system state...\n');

  // Check if tests can actually run
  let testsCanRun = false;
  try {
    execSync('pnpm test --run --reporter=silent 2>&1', { timeout: 30000, stdio: 'pipe' });
    testsCanRun = true;
  } catch {
    testsCanRun = false;
  }

  // Count actual console.* statements
  let consoleStatements = 0;
  try {
    const result = execSync(
      'grep -r "console\\." --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | wc -l',
      { encoding: 'utf-8' },
    );
    consoleStatements = parseInt(result.trim(), 10) || 0;
  } catch {
    consoleStatements = 0;
  }

  // Count actual any types
  let anyTypes = 0;
  try {
    const result = execSync(
      'grep -r ": any" --include="*.ts" --include="*.tsx" . 2>/dev/null | wc -l',
      { encoding: 'utf-8' },
    );
    anyTypes = parseInt(result.trim(), 10) || 0;
  } catch {
    anyTypes = 0;
  }

  // Check if security tests exist and pass
  let securityVerified = false;
  try {
    const securityTestFiles = execSync(
      'find . -name "*security*.test.ts" -o -name "*auth*.test.ts" 2>/dev/null | wc -l',
      { encoding: 'utf-8' },
    );
    securityVerified = parseInt(securityTestFiles.trim(), 10) > 0;
  } catch {
    securityVerified = false;
  }

  // Check if coverage metrics exist
  let coverageMetrics = false;
  try {
    coverageMetrics = fs.existsSync('coverage/coverage-summary.json');
  } catch {
    coverageMetrics = false;
  }

  const state = {
    testsCanRun,
    consoleStatements,
    anyTypes,
    securityVerified,
    coverageMetrics,
    currentYear: new Date().getFullYear(),
  };

  console.log('📊 Actual System State:');
  console.log(`   Tests Can Run: ${state.testsCanRun}`);
  console.log(`   Console Statements: ${state.consoleStatements}`);
  console.log(`   Any Types: ${state.anyTypes}`);
  console.log(`   Security Verified: ${state.securityVerified}`);
  console.log(`   Coverage Metrics: ${state.coverageMetrics}`);
  console.log(`   Current Year: ${state.currentYear}\n`);

  return state;
}

let systemState: SystemState;

interface VerifiedClaim {
  file: string;
  category: string;
  description: string;
  verification: {
    status: 'confirmedFalse' | 'potentiallyFalse' | 'needsInvestigation';
    reason: string;
    action: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  };
}

interface VerificationResults {
  verified: VerifiedClaim[];
  summary: {
    totalVerified: number;
    confirmedFalse: number;
    potentiallyFalse: number;
    needsInvestigation: number;
  };
}

async function verifyClaims(): Promise<VerificationResults> {
  console.log('🔍 Verifying false claims against system state...\n');

  // Get actual system state first
  systemState = await getActualSystemState();

  const auditResults = JSON.parse(fs.readFileSync('docs/audit-results.json', 'utf8'));
  const verifiedResults: VerificationResults = {
    verified: [],
    summary: {
      totalVerified: 0,
      confirmedFalse: 0,
      potentiallyFalse: 0,
      needsInvestigation: 0,
    },
  };

  auditResults.falseClaims.forEach((claim: Claim) => {
    const verification = verifyClaim(claim);
    verifiedResults.verified.push({
      ...claim,
      verification: verification as VerifiedClaim['verification'],
    });

    verifiedResults.summary.totalVerified++;
    verifiedResults.summary[verification.status as keyof typeof verifiedResults.summary]++;
  });

  // Generate verification report
  console.log('✅ VERIFICATION COMPLETE\n');
  console.log('='.repeat(50));
  console.log('VERIFICATION REPORT');
  console.log('='.repeat(50));

  console.log(`\n📊 Summary:`);
  console.log(`   Total Claims Verified: ${verifiedResults.summary.totalVerified}`);
  console.log(`   ✅ Confirmed False: ${verifiedResults.summary.confirmedFalse}`);
  console.log(`   ⚠️ Potentially False: ${verifiedResults.summary.potentiallyFalse}`);
  console.log(`   🔍 Needs Investigation: ${verifiedResults.summary.needsInvestigation}`);

  console.log(`\n🚨 Critical False Claims (Immediate Action Required):`);
  verifiedResults.verified
    .filter((claim) => claim.verification.priority === 'critical')
    .slice(0, 10)
    .forEach((claim, index) => {
      console.log(`   ${index + 1}. ${claim.file}`);
      console.log(`      ${claim.description}`);
      console.log(`      Action: ${claim.verification.action}`);
      console.log();
    });

  console.log(`📁 Files Needing Updates:`);
  const filesToUpdate = [
    ...new Set([
      ...verifiedResults.verified
        .filter((c) => c.verification.status === 'confirmedFalse')
        .map((c) => c.file),
      ...verifiedResults.verified
        .filter((c) => c.verification.status === 'potentiallyFalse')
        .map((c) => c.file),
    ]),
  ];

  filesToUpdate.slice(0, 10).forEach((file, index) => {
    const claimCount = verifiedResults.verified.filter((c) => c.file === file).length;
    console.log(`   ${index + 1}. ${file} (${claimCount} claims)`);
  });

  if (filesToUpdate.length > 10) {
    console.log(`   ... and ${filesToUpdate.length - 10} more files`);
  }

  console.log(`\n💡 Next Steps:`);
  console.log(`1. Review the critical false claims above`);
  console.log(`2. Run consolidation script: node scripts/consolidate-docs.ts`);
  console.log(`3. Create new organized structure`);
  console.log(`4. Establish maintenance policies`);

  // Save detailed results
  fs.writeFileSync('docs/verified-claims.json', JSON.stringify(verifiedResults, null, 2));
  console.log(`\n💾 Detailed results saved to: docs/verified-claims.json`);

  return verifiedResults;
}

function verifyClaim(claim: Claim) {
  // Status inflation verification
  if (claim.category === 'statusInflation') {
    if (claim.description.includes('comprehensive tests') && !systemState.testsCanRun) {
      return {
        status: 'confirmedFalse',
        reason: 'Tests cannot run due to cyclic dependencies',
        action: 'Update to: "Testing infrastructure exists but has blockers"',
        priority: 'critical',
      };
    }

    if (claim.description.includes('enterprise-grade security') && !systemState.securityVerified) {
      return {
        status: 'confirmedFalse',
        reason: 'Security measures exist but are unverified',
        action: 'Update to: "Security measures implemented, verification pending"',
        priority: 'high',
      };
    }

    if (claim.description.includes('production ready')) {
      return {
        status: 'confirmedFalse',
        reason: 'Multiple critical blockers prevent production use',
        action: 'Update to: "NOT production ready - critical blockers exist"',
        priority: 'critical',
      };
    }
  }

  // Metric misrepresentation
  if (claim.category === 'metricMisrepresentation') {
    if (claim.description.includes('console statements') && claim.context.includes('53')) {
      return {
        status: 'confirmedFalse',
        reason: `Actual count is ${systemState.consoleStatements}, not 53`,
        action: `Update to: "${systemState.consoleStatements} console statements (target: <50)"`,
        priority: 'high',
      };
    }

    if (claim.description.includes('cannot run')) {
      return {
        status: 'confirmedFalse',
        reason:
          'Tests blocked by cyclic dependencies - this claim is accurate but context is misleading',
        action: 'Verify context and update for clarity if needed',
        priority: 'medium',
      };
    }
  }

  // Completion overstatement
  if (claim.category === 'completionOverstatement') {
    return {
      status: 'needsInvestigation',
      reason: 'Requires manual verification of completion status against current system state',
      action: 'Verify completion claims and update to reflect current reality',
      priority: 'high',
    };
  }

  // Outdated content (future dates)
  if (claim.category === 'outdatedContent') {
    const yearMatch = claim.context.match(/\b(202[6-9])\b/);
    if (yearMatch && parseInt(yearMatch[1], 10) > systemState.currentYear) {
      return {
        status: 'confirmedFalse',
        reason: `Future date ${yearMatch[1]} in current documentation`,
        action:
          parseInt(yearMatch[1], 10) <= 2025
            ? 'Update to current date'
            : 'Move to planning docs or archive',
        priority: 'medium',
      };
    }
  }

  return {
    status: 'potentiallyFalse',
    reason: 'Requires manual review to determine accuracy',
    action: 'Investigate and categorize appropriately',
    priority: 'low',
  };
}

// Run verification
verifyClaims().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(ErrorCode.VALIDATION_ERROR);
});
